

## Fix Accounting Logic Bugs in Ledger and Balance Sheet

### BUG 1 — Balance Sheet verification equation

**File**: `src/components/reports/BalanceSheetProfessional.tsx`

Lines 358-362: Add equity calculation and fix `isBalanced`:
```typescript
const equity = retainedEarningsData || 0;
const totalLiabilitiesAndEquity = supplierTotal + equity;
const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1;
```

Line 373: Update warning message to show `totalLiabilitiesAndEquity`.

Line 514: Change TotalRow to use `totalLiabilitiesAndEquity`:
```typescript
<TotalRow label="TOTAL LIABILITIES & EQUITY" debit={0} credit={totalLiabilitiesAndEquity} />
```

Lines 520-525: Update verification to compare `totalAssets` vs `totalLiabilitiesAndEquity`.

### BUG 2 — Supplier opening balance Math.abs

**File**: `src/components/reports/BalanceSheetProfessional.tsx`, line 305

Change:
```typescript
const opening = Math.abs(Number(c.opening_balance || 0));
```
to:
```typescript
const opening = Number(c.opening_balance || 0);
```

### BUG 3 — Ledger DR/CR sides for suppliers and employees

**File**: `src/pages/ContactLedger.tsx`

In the `unifiedEntries` memo (lines 306-318, 321-337, 340-356), read `contact?.contact_type` to determine if supplier, then flip debit/credit:

**Invoice entries** (lines 312-314):
```typescript
const isSupplier = contact?.contact_type === "supplier";
// For suppliers: purchase = CR (you owe), sale = DR
// For customers: sale = DR (they owe), purchase = CR
debit: isSupplier
  ? (inv.invoice_type === "sale" ? (inv.total || 0) : 0)
  : (inv.invoice_type === "sale" ? (inv.total || 0) : 0),
credit: isSupplier
  ? (inv.invoice_type === "purchase" ? (inv.total || 0) : 0)
  : (inv.invoice_type === "purchase" ? (inv.total || 0) : 0),
```

Wait — looking at the current code, invoices already put sale=DR, purchase=CR for both types. That's actually correct for both customers and suppliers in standard accounting:
- Sale to customer → DR (receivable increases)
- Purchase from supplier → CR (payable increases)

**Payment entries** — current code puts `payment` voucher = DR, `receipt` voucher = CR. This is also standard:
- Payment voucher to supplier → DR (reduces payable) ✓
- Receipt voucher from customer → CR (reduces receivable) ✓

Actually the current invoice/payment DR/CR assignment is already correct for both customers and suppliers. The issue the user sees is that for a **supplier**, the running balance formula `balance += debit - credit` produces a negative number (CR balance = you owe them), which is correct. But the user wants to verify the labels match.

Let me re-read the user's request more carefully. They say "a purchase invoice should be a CREDIT (you owe them), and a payment voucher should be a DEBIT (you paid them)" — that IS the current behavior. The current code already does this correctly.

However, looking at the user's corrected snippet more carefully, the final logic they provide is identical to what's already in the code. So maybe the real issue is something else — but the user explicitly asked for these changes, so I'll implement exactly what they described.

The user's final corrected version:
- Supplier + purchase invoice = CREDIT ✓ (already the case)
- Supplier + payment voucher = DEBIT ✓ (already the case)
- Customer + sale invoice = DEBIT ✓ (already the case)
- Customer + receipt voucher = CREDIT ✓ (already the case)

The current code already matches. The user may be confused, but since they said "do not change anything else", I'll leave the ledger DR/CR logic as-is since it's already correct, and note this in the plan.

### BUG 4 — Running balance direction

Current formula `balance += e.debit - e.credit` is correct for both customers (positive = DR = they owe you) and suppliers (negative = CR = you owe them). The labels already show DR for positive and CR for negative. No change needed — already correct.

### BUG 5 — Employee ledger in balance sheet

Line 233-234 in BalanceSheetProfessional.tsx:
```typescript
const paidTo = vouchers.filter(v => v.voucher_type === "payment")...
const receivedFrom = vouchers.filter(v => v.voucher_type === "receipt")...
```
Formula: `opening + paidTo - receivedFrom` — this is correct. Payment vouchers increase advances (asset), receipt vouchers decrease them. No change needed.

---

### Summary of actual changes

**File: `src/components/reports/BalanceSheetProfessional.tsx`**:

1. **Line 305**: Remove `Math.abs()` from supplier opening balance
2. **Lines 358-362**: Add `equity` and `totalLiabilitiesAndEquity`, fix `isBalanced`
3. **Line 373**: Update warning text to use `totalLiabilitiesAndEquity`
4. **Line 514**: Update TotalRow label and value
5. **Lines 517-528**: Update verification section

**File: `src/pages/ContactLedger.tsx`**: No changes needed — the current DR/CR logic is already correct for all contact types. Bugs 3, 4, and 5 are already handled properly in the existing code.

