
Implementation plan

1. Verify and minimize scope
- I inspected the current report files first.
- `BalanceSheetProfessional.tsx` already appears to have the requested fixes for:
  - customer closing balance split into receipt/payment voucher totals
  - supplier closing balance split into receipt/payment voucher totals
  - cash contacts query/block removed
  - professional retained earnings already based on actual P&L
- To honor “do not touch anything not mentioned”, I will only re-check that file for any stale duplicate references, and otherwise leave it unchanged.

2. Update `src/components/reports/FinancialReports.tsx`
- In `BalanceSheetReport`:
  - add 3 summary-view queries for total sales, purchases, and expenses
  - replace forced retained earnings formula with:
    `retainedEarnings = (salesData || 0) - (purchasesData || 0) - (expensesData || 0)`
  - add those query results to the loading guard
  - update the Retained Earnings collapsible breakdown to show:
    - Total Revenue (Sales)
    - Less COGS (Purchases)
    - Less Operating Expenses
    - = Retained Earnings
- In the same file, fix employee receivables:
  - add the `employeeAdvancesData` query using `calculateEmployeeAdvances()`
  - replace `bal.employeeReceivables` with `employeeAdvancesData?.total || 0`
- In `CashFlowReport`:
  - remove the invoices query completely
  - expand the payments query to include `payment_method`, `voucher_type`, and linked invoice type
  - recalculate flow using only cash payments table rows plus existing cash expenses:
    - inflows = cash receipts
    - outflows = cash payments
    - net = inflows - outflows - cash expenses

3. Update `src/components/reports/CashClosingReport.tsx`
- Keep the invoice query for the daily invoice listing/cards.
- Stop using `invoice.amount_paid` to compute cash movement totals.
- Extend the payments query to include `voucher_type`.
- Recompute cash movement only from cash vouchers linked to invoices:
  - sales cash in = sale invoice + cash + receipt
  - purchase cash out = purchase invoice + cash + payment
- Keep invoice list display and credit calculations intact unless a line is directly tied to the removed double-counted cash logic.

4. No changes planned in `src/lib/financial-utils.ts`
- `calculateEmployeeAdvances()` already exists and matches the requested purpose.
- I will reuse it from the reports layer instead of changing utility logic unless I find a direct mismatch during final verification.

5. Guardrails
- No database changes.
- No changes to other pages/components.
- No unrelated refactors, styling changes, or feature additions.
