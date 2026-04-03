

## Fix Voucher System: Multi-Bank Tracking, Safe Numbering, Bank Expenses

### Database Migration

Add 3 columns across 2 tables:

```sql
-- Payments: bank tracking + voucher numbering
ALTER TABLE public.payments ADD COLUMN bank_contact_id uuid;
ALTER TABLE public.payments ADD COLUMN voucher_number text;

-- Expenses: bank tracking
ALTER TABLE public.expenses ADD COLUMN bank_contact_id uuid;

-- Sequence for collision-safe voucher numbering
CREATE SEQUENCE IF NOT EXISTS voucher_receipt_seq START 1;
CREATE SEQUENCE IF NOT EXISTS voucher_payment_seq START 1;

-- Initialize sequences to current max
DO $$
DECLARE rv_max int; pv_max int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM 4) AS int)), 0)
    INTO rv_max FROM payments WHERE voucher_number LIKE 'RV-%';
  SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM 4) AS int)), 0)
    INTO pv_max FROM payments WHERE voucher_number LIKE 'PV-%';
  PERFORM setval('voucher_receipt_seq', GREATEST(rv_max, 1), rv_max > 0);
  PERFORM setval('voucher_payment_seq', GREATEST(pv_max, 1), pv_max > 0);
END $$;

-- DB function for collision-safe voucher number generation
CREATE OR REPLACE FUNCTION public.next_voucher_number(v_type text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF v_type = 'receipt' THEN
    RETURN 'RV-' || LPAD(nextval('voucher_receipt_seq')::text, 4, '0');
  ELSE
    RETURN 'PV-' || LPAD(nextval('voucher_payment_seq')::text, 4, '0');
  END IF;
END;
$$;
```

### Type Safety for BreakdownType

Use a template literal type instead of generic `string`:

```typescript
type BreakdownType = "cash" | "receivables" | "payables" | "employee" | `bank-${string}` | null;
```

This preserves type safety while allowing dynamic bank IDs.

---

### File Changes

#### 1. `src/pages/VoucherNew.tsx`
- Add `bankContactId` state; show bank selector (combobox filtered to `account_category='bank'`) when `payment_method = 'bank'`
- On save: call `supabase.rpc('next_voucher_number', { v_type: voucherType })` to get the number, then insert with `bank_contact_id` and `voucher_number`

#### 2. `src/pages/Index.tsx`
- Remove single "Bank Balance" card
- Fetch bank contacts (`account_category='bank'`), create one card per bank
- Each bank's balance: `opening_balance + receipts(bank_contact_id=id) - payments(bank_contact_id=id) - expenses(bank_contact_id=id)`
- Update `BreakdownType` to `"cash" | "receivables" | "payables" | "employee" | \`bank-${string}\` | null`
- Pass `bank-{uuid}` as breakdown key

#### 3. `src/components/dashboard/DashboardBreakdown.tsx`
- Update `BreakdownType` to match
- Replace `BankBreakdown` with `BankBreakdown({ bankId })` — takes a specific bank contact ID
- Renders that bank's opening balance, receipts, payments, expenses, and total
- Parse `bank-{id}` from the type prop to extract UUID

#### 4. `src/pages/ExpenseNew.tsx` + `src/pages/ExpenseEdit.tsx`
- Add `bankContactId` state; show bank selector when `payment_method = 'bank'`
- Store `bank_contact_id` on insert/update

#### 5. `src/pages/ReceiptVouchers.tsx` + `src/pages/PaymentVouchers.tsx`
- Show `voucher_number` column
- Show bank name (lookup from bank contacts) when `bank_contact_id` exists

#### 6. `src/pages/ContactLedger.tsx`
- Show bank name on voucher entries (e.g., "Direct Payment — MCB 4575")

#### 7. `src/contexts/LanguageContext.tsx`
- Add keys: `voucher.voucherNumber`, `voucher.selectBank`, `voucher.bankRequired`

#### 8. `src/lib/financial-utils.ts`
- Add `fetchBankBalances()` helper returning per-bank balances

---

### What Will NOT Change
- Receivables/Payables logic (invoice-based only)
- Opening balances
- Invoice-linked voucher logic
- Cash in Hand calculation

