

## Fix Balance Sheet: Remove Capital/Closing + Fresh Data

### ISSUE 1 — Add Net Profit/(Loss) to Liabilities Section

Both files already have capital/equity/closing sections removed. The missing piece is showing retained earnings (Net Profit/Loss) as a line item under Liabilities.

**BalanceSheetProfessional.tsx:**
- Add a `retainedEarningsData` query that fetches total sales, total purchases, and total expenses (3 simple aggregations), then computes `retainedEarnings = sales - purchases - expenses`
- Add `staleTime: 0, refetchOnMount: true` to this query
- After the Supplier Payables section (before TOTAL LIABILITIES), add a `DottedLine` and an `AccountLine` labeled "Net Profit / (Loss)" showing the retained earnings value
- Do NOT add retained earnings to `totalLiabilities` — it's shown separately as an informational line
- Add retainedEarningsData to the `isLoading` check

**FinancialReports.tsx (summary view):**
- Already has `bsSalesData`, `bsPurchasesData`, `bsExpensesData` — compute `retainedEarnings = bsSalesData - bsPurchasesData - bsExpensesData`
- In the Liabilities card, after Supplier Payables collapsible and before the total rows, add a `BSLineItem` labeled "Net Profit / (Loss)" with `indent` showing the retained earnings value
- Do NOT add it to `totalLiabilities`

### ISSUE 2 — Add staleTime: 0 to All Balance Sheet Queries

**BalanceSheetProfessional.tsx** — add `staleTime: 0, refetchOnMount: true` to these queries:
- bs-cash, bs-banks, bs-ledger-customers, bs-ledger-employees, bs-ledger-inventory, bs-ledger-suppliers, bs-categories (+ new retained earnings query)

**FinancialReports.tsx** — add `staleTime: 0, refetchOnMount: true` to these queries:
- bs-cash, bs-banks, bs-receivables, bs-payables, bs-inventory, bs-categories, bs-employee-advances, bs-sales-total, bs-purchases-total, bs-expenses-total

### Files Changed
1. `src/components/reports/BalanceSheetProfessional.tsx`
2. `src/components/reports/FinancialReports.tsx`

No database changes needed.

