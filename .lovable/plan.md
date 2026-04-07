

## Fix Dashboard Financial Calculations (4 Issues)

### ISSUE 1 — Fix "Cash in Hand" contact category
**Database migration**: `UPDATE contacts SET account_category = 'cash' WHERE name = 'Cash in Hand' AND account_category = 'bank';`

### ISSUE 2 — Remove untracked cash logic
**File: `src/lib/financial-utils.ts`**
- Remove `untrackedSaleCash` and `untrackedPurchaseCash` from `CashInHandResult` interface
- Simplify `calculateCashInHand()`: remove the invoice fetch, voucherTotalsByInvoice map, and untracked calculation. New formula: `total = opening + cashReceipts - cashPayments - cashExpenses`
- Return only `{ total, opening, cashReceipts, cashPayments, cashExpenses }`
- Add new `calculateEmployeeAdvances()` function (for Issue 4)

**File: `src/components/reports/BalanceSheetProfessional.tsx`**
- Remove the two conditional `DetailLine` rows for `untrackedSaleCash` and `untrackedPurchaseCash`

**File: `src/components/reports/FinancialReports.tsx`**
- Remove the two conditional `BSSubLine` rows for untracked amounts

**File: `src/components/dashboard/DashboardBreakdown.tsx`**
- Remove the two conditional `LineItem` rows for untracked amounts

### ISSUE 3 — Pass BU filter to receivables/payables on dashboard
**File: `src/pages/Index.tsx`**
- Change receivables query: `queryKey: ["dashboard-receivables", selectedBU]`, `queryFn: () => calculateReceivables(buFilter)`
- Change payables query: `queryKey: ["dashboard-payables", selectedBU]`, `queryFn: () => calculatePayables(buFilter)`

### ISSUE 4 — Employee advances includes vouchers
**File: `src/lib/financial-utils.ts`**
- Add `calculateEmployeeAdvances()`: fetches employee contacts (account_category = 'employee'), sums opening balances, then fetches payments where contact_id is in the employee list, adds payment vouchers (money sent to employees), subtracts receipt vouchers (money received back from employees)

**File: `src/pages/Index.tsx`**
- Replace the current employee advances query with: `queryFn: () => calculateEmployeeAdvances()`

### Summary

| File | Changes |
|---|---|
| DB migration | Update "Cash in Hand" contact category to 'cash' |
| `src/lib/financial-utils.ts` | Remove untracked logic, add `calculateEmployeeAdvances()` |
| `src/pages/Index.tsx` | Pass buFilter to receivables/payables, use new employee advances function |
| `src/components/reports/BalanceSheetProfessional.tsx` | Remove untracked cash lines |
| `src/components/reports/FinancialReports.tsx` | Remove untracked cash lines |
| `src/components/dashboard/DashboardBreakdown.tsx` | Remove untracked cash lines |

