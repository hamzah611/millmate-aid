

## Add Custom Date Range Picker to All Reports

### Problem
All report tabs currently use preset period dropdowns (e.g., "This Month", "Last 6 Months") or fixed ranges. You need to select exact from/to dates since you're also entering historical data.

### Solution
Create a reusable `DateRangePicker` component and integrate it into all 8 report tabs, replacing or supplementing the existing period selectors.

### 1. Create Shared DateRangePicker Component

New file: `src/components/reports/DateRangePicker.tsx`

A reusable component with two date inputs (From / To) using the Popover + Calendar pattern. Will include preset shortcuts (This Month, Last 3 Months, etc.) as quick-select buttons alongside the custom date fields.

### 2. Update Each Report Component

| Report | File | Current Filter | Change |
|--------|------|----------------|--------|
| Top Products | `TopProductsChart.tsx` | Period dropdown (this/last month, 90 days) | Replace with DateRangePicker |
| Sales vs Purchases | `SalesPurchasesChart.tsx` | Range dropdown (6/12/24 months) | Replace with DateRangePicker |
| Profit Margins | `ProfitMarginsChart.tsx` | No date filter | Add DateRangePicker |
| Aging Report | `AgingReport.tsx` | No date filter (uses current balances) | Add DateRangePicker to filter invoices by date |
| Profit & Loss | `FinancialReports.tsx` (ProfitLossReport) | Period dropdown | Replace with DateRangePicker |
| Cash Flow | `FinancialReports.tsx` (CashFlowReport) | Period dropdown | Replace with DateRangePicker |
| Balance Sheet | `FinancialReports.tsx` (BalanceSheetReport) | Period dropdown | Replace with DateRangePicker |
| Cash Closing | `CashClosingReport.tsx` | Single date input | Keep single date (it's a daily report by nature) |

For each report, the date range will be passed to the database query's `.gte()` and `.lte()` filters on the relevant date column.

### 3. Translation Keys

Add labels: "From Date", "To Date", "Custom Range" to LanguageContext.

### Files Changed

| File | Change |
|------|--------|
| `src/components/reports/DateRangePicker.tsx` | New shared component |
| `src/components/reports/TopProductsChart.tsx` | Use DateRangePicker |
| `src/components/reports/SalesPurchasesChart.tsx` | Use DateRangePicker |
| `src/components/reports/ProfitMarginsChart.tsx` | Add DateRangePicker |
| `src/components/reports/AgingReport.tsx` | Add DateRangePicker |
| `src/components/reports/FinancialReports.tsx` | Replace PeriodSelector with DateRangePicker in all 3 reports |
| `src/contexts/LanguageContext.tsx` | Add translation keys |

