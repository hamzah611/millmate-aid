

## Upgrade Expense Module

### Overview
Enhance the existing Expenses page with summary cards, filters, category breakdown, and improved form validation. The P&L integration already exists and works correctly.

### Changes

#### 1. `src/pages/Expenses.tsx` — Major rewrite
- **Summary Cards** (3 cards at top): Today's Total, This Month's Total, Filtered/All-Time Total — computed from fetched data, reactive to filters
- **Filters Bar**: Date range (from/to inputs), Category dropdown, Payment Method dropdown — all filter the table instantly via client-side filtering
- **Category Breakdown Section**: Simple list or lightweight bar chart showing total per category from filtered data, placed below the table
- **Date fix**: Use `new Date(exp.expense_date + "T00:00:00")` to prevent timezone shift
- **Keep existing**: Export CSV, navigation to new expense form

#### 2. `src/pages/ExpenseNew.tsx` — Validation improvements
- Add `submitted` state flag for field-level red borders
- Change save button to always enabled, validate on click with toast messages:
  - Missing category → toast
  - Invalid/zero amount → toast
  - Missing date → toast
- Prevent double-click: disable button during `isPending` (already done)

#### 3. `src/contexts/LanguageContext.tsx` — New translation keys
Add keys for:
- `expenses.totalToday` / `expenses.totalMonth` / `expenses.totalAll`
- `expenses.filters` / `expenses.dateFrom` / `expenses.dateTo` / `expenses.allCategories` / `expenses.allMethods`
- `expenses.categoryBreakdown`
- `expenses.validationCategory` / `expenses.validationAmount`

#### 4. No database changes needed
- Existing `expenses` and `expense_categories` tables are sufficient
- P&L report already queries expenses by date range and subtracts from gross profit
- Cash Flow report does not include expenses (correct — expenses are accrual-based, not necessarily cash payments tracked via invoices)

### Technical Details

**Filter logic** (client-side, since data volume is manageable):
```typescript
const filtered = useMemo(() => {
  return (expenses || []).filter(e => {
    if (dateFrom && e.expense_date < dateFrom) return false;
    if (dateTo && e.expense_date > dateTo) return false;
    if (categoryFilter && e.category_id !== categoryFilter) return false;
    if (methodFilter && e.payment_method !== methodFilter) return false;
    return true;
  });
}, [expenses, dateFrom, dateTo, categoryFilter, methodFilter]);
```

**Summary cards** computed from `filtered` array:
- Today: filter where `expense_date === today`
- This Month: filter where month/year matches current
- Total: sum of all filtered

**Category breakdown**: group filtered expenses by category, sort descending by total, render as a simple styled list with progress-bar-style widths.

### Files Changed
| File | Change |
|------|--------|
| `src/pages/Expenses.tsx` | Summary cards, filters, category breakdown, date fix |
| `src/pages/ExpenseNew.tsx` | Validation toasts + field highlights |
| `src/contexts/LanguageContext.tsx` | ~12 new translation keys |

