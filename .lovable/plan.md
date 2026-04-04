

## Add Business Unit Filter to Balance Sheet Report

### What's Already Working
- **P&L**: Already has a BU filter dropdown — works correctly
- **Expenses page** (`/expenses`): Already has a BU filter — works correctly
- **Dashboard**: BU filter applies to Sales/Purchases cards only (by design)

### What's Missing
The **Balance Sheet** report has no Business Unit filter. The user wants to view the balance sheet separately for Flour Mill vs Rice Hullar.

### Approach
Add a BU filter dropdown to the Balance Sheet (both summary and professional views). Since some accounts are global (Cash, Bank, Employee), only invoice-linked data can be filtered:

| Line Item | Filterable? | How |
|---|---|---|
| Cash in Hand | No (global) | Shown as-is |
| Bank Accounts | No (global) | Shown as-is |
| Customer Receivables | Yes | Filter invoices by `business_unit` |
| Employee Receivables | No (global) | Shown as-is |
| Inventory | No (no BU field on products) | Shown as-is |
| Supplier Payables | Yes | Filter invoices by `business_unit` |
| Retained Earnings | Recalculated | Based on filtered totals |

When a specific BU is selected, a note will appear: "Cash, Bank, Employee, and Inventory balances are shared across all business units."

### Changes

**File: `src/components/reports/FinancialReports.tsx`** (BalanceSheetReport)
1. Add `buFilter` state and BU dropdown next to the Professional View / Export buttons
2. Modify the receivables query (`bs-customer-list-rich`) to filter invoices by `business_unit` when BU is selected
3. Modify the payables query (`bs-supplier-list-rich`) to filter invoices by `business_unit` when BU is selected
4. Modify `calculateReceivables` and `calculatePayables` calls — since those are shared utils, instead override the invoice balance portion inline with BU-filtered queries
5. Show info banner when BU filter is active explaining global items

**File: `src/components/reports/BalanceSheetProfessional.tsx`**
1. Accept `buFilter` prop from parent
2. Filter customer/supplier invoice queries by `business_unit` when BU is active
3. Pass BU context to all drill-down queries

**File: `src/lib/financial-utils.ts`**
- Add optional `businessUnit` parameter to `calculateReceivables()` and `calculatePayables()` so invoice queries can be filtered by BU without breaking existing callers

No database changes needed. No changes to P&L, Expenses, or Dashboard.

