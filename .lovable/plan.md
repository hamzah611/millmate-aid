

## P&L Breakdown Table by Business Unit and Account Category

### Overview
Add a new breakdown table section inside `ProfitLossReport` that cross-references Business Units (columns) with Revenue + Account Categories (rows). Uses already-fetched data with one small query change. No changes to existing P&L logic or summary cards.

### 1. Query Change
In the expenses query (line 90), add `account_category` to the select:
```
"amount, business_unit" → "amount, business_unit, account_category"
```

### 2. Breakdown Computation (`useMemo`)
After the existing `pnl` memo, add a new `breakdown` memo that:
- Determines visible BU columns based on `buFilter` (all → flour_mill + rice_hullar; specific → just that one; unassigned → just unassigned)
- Computes revenue per BU from `invoices` (sale type, grouped by `business_unit`)
- Computes expenses per BU per account_category from `expensesTotal` (grouped by `business_unit` + `account_category`)
- Fixed row order: Revenue, then Direct Expenses, Employee, Bank, Cash, Unassigned
- All values default to 0

### 3. New Breakdown Table UI
Place below the existing P&L statement card (line 199). Wrapped in a `Card` with title using new translation key.

Table structure:
- Header: Category | {BU column labels}
- Revenue row (bold)
- Separator
- Expense category rows (one per category that has data or from fixed list)
- Shows "No data available" if all values are 0

### 4. Translation Keys (2 new)
| Key | EN | UR |
|-----|----|----|
| `reports.breakdownTitle` | Breakdown by Business Unit and Category | کاروباری اکائی اور کیٹیگری کے لحاظ سے تفصیل |
| `reports.revenue` | Revenue | آمدنی |

(`reports.unassigned` can reuse `accountCategory.unassigned`)

### 5. Files Changed

| File | Change |
|------|--------|
| `src/components/reports/FinancialReports.tsx` | Add `account_category` to expenses select; add breakdown memo + table UI |
| `src/contexts/LanguageContext.tsx` | 2 translation keys |

No database changes. No changes to existing P&L calculations or summary cards.

