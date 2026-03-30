

## Fix All Known Bugs

### Bug 1: Ambiguous Foreign Key — `contacts(...)` on invoices (Critical)

The `invoices` table has two FKs to `contacts` (`contact_id` and `broker_contact_id`). PostgREST returns HTTP 300 when the FK isn't specified, silently breaking queries.

**Affected files:**
- `src/pages/Index.tsx` line 118 — `contacts(payment_terms)` → `contacts!invoices_contact_id_fkey(payment_terms)`
- `src/components/reports/AgingReport.tsx` line 42 — `contacts(name, payment_terms)` → `contacts!invoices_contact_id_fkey(name, payment_terms)`
- `src/components/NotificationPanel.tsx` line 45 — `contacts(payment_terms)` → `contacts!invoices_contact_id_fkey(payment_terms)`

These are all single-line string replacements in `.select()` calls.

### Bug 2: Unnecessary `(as any)` casts for `business_unit`

The `business_unit` field exists in the Supabase types for both `invoices` and `expenses`, but several files still cast through `(as any)`. This hides type errors and is unnecessary.

**Affected files and lines:**
- `src/pages/Sales.tsx` — `(inv as any).business_unit` → `inv.business_unit`
- `src/pages/Purchases.tsx` — `(inv as any).business_unit` → `inv.business_unit`
- `src/pages/Expenses.tsx` — `(e as any).business_unit` → `e.business_unit`
- `src/pages/ExpenseEdit.tsx` — `(expense as any).business_unit` → `expense.business_unit`
- `src/components/InvoiceDetail.tsx` — `(invoice as any).business_unit` → `invoice.business_unit`
- `src/components/reports/FinancialReports.tsx` — `(inv as any).business_unit` and `(e as any).business_unit` → direct access

### Bug 3: CSV export missing Business Unit

Sales, Purchases, and Expenses CSV exports don't include the `business_unit` column. Add it as an additional column.

**Affected files:**
- `src/pages/Sales.tsx` — add "Business Unit" header and value to export
- `src/pages/Purchases.tsx` — same
- `src/pages/Expenses.tsx` — same

### Summary

| # | Bug | Severity | Files |
|---|-----|----------|-------|
| 1 | Ambiguous FK breaks overdue, aging, notifications | Critical | 3 files |
| 2 | Unnecessary `(as any)` casts | Low (cleanup) | 6 files |
| 3 | CSV missing business unit | Low | 3 files |

All fixes are simple single-line replacements with no logic changes.

