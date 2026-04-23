

## Plan: Link Payment Vouchers to Products (replace legacy expenses.product_id linkage)

### 1. Database migration
Add a nullable `product_id` to `payments`:
```sql
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL;
```
The generated `src/integrations/supabase/types.ts` will pick up `product_id: string | null` automatically — no manual edit.

### 2. `src/pages/VoucherNew.tsx` — capture product link
- Extend `contacts-for-voucher` query to also select `account_category`.
- Add `products-for-voucher` query: `id, name` where `is_tradeable = true`, ordered by name.
- Add `const [productId, setProductId] = useState("")`.
- Reset `productId` when contact changes (alongside `setInvoiceId("")`) and on voucher type change.
- In the non-transfer JSX, after the invoice selector and before the amount field, render a `SearchableCombobox` for products **only when** the selected contact has `account_category === "expense"`. Helper text below confirms it will appear in that product's history.
- In `saveMutation` (non-transfer branch), include `product_id: productId || null` in the inserted `paymentData`.

### 3. `src/pages/ProductHistory.tsx` — show voucher expenses (additive only)
- Keep the existing `product-expenses` query untouched.
- Add `product-voucher-expenses` query reading `payments` filtered by `product_id = id`, `voucher_type = "payment"`, with embedded contact `name` and `account_category`.
- In the `history` `useMemo`, after the existing expenses loop, push one entry per voucher expense:
  - `type: "Expense — <contact name or 'Voucher'>"`, `reference: notes || "—"`, `totalValue: amount`.
  - Add `voucherExpenses` to the dependency array.
- Update `totalExpenses` to sum legacy expenses **and** voucher expenses so the KPI card and PDF stay consistent.
- The badge condition `e.type.startsWith("Expense")` already styles the new rows correctly.

### 4. `src/components/reports/FinancialReports.tsx` — include voucher expenses
**ProfitLossReport:**
- Add `financial-voucher-expenses` query: fetch contact ids where `account_category = "expense"`, then fetch `payments` (`amount, payment_method, contact_id`) with `voucher_type = "payment"`, those contact ids, in date range. Returns `[]` if no expense contacts exist.
- Include `voucherExpensesData` in the loading gate and `pnl` `useMemo` deps.
- Replace the `operatingExpenses` calculation to add the sum of voucher expense amounts to the existing legacy-expenses sum. (BU filter still applies to the legacy expenses table only — voucher expenses don't carry `business_unit`.)

**CashFlowReport:**
- Add `cashflow-voucher-expenses` query mirroring above but additionally filtered to `payment_method = "cash"`, returning a numeric total.
- Include in loading gate and `flow` `useMemo` deps.
- Update `totalCashExpenses = (cashExpenses || 0) + (cashVoucherExpenses || 0)`.

### Out of scope
- `ContactLedger.tsx` — untouched.
- `BalanceSheetProfessional.tsx` — untouched.
- Existing `expenses` table queries everywhere — kept as-is.
- No other files modified.

### Files changed
1. New migration adding `payments.product_id`
2. `src/pages/VoucherNew.tsx`
3. `src/pages/ProductHistory.tsx`
4. `src/components/reports/FinancialReports.tsx`

