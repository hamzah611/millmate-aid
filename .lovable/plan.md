

## Fix: Ambiguous Foreign Key on Invoices → Contacts

### Root Cause
The `invoices` table has two FKs to `contacts`: `contact_id` and `broker_contact_id`. PostgREST cannot auto-resolve `contacts(name)` and returns HTTP 300. This breaks Sales, Purchases, Dashboard, Reports, and Invoice Detail — anywhere invoices are queried with contact names.

### Fix
Replace every `contacts(name)` with `contacts!invoices_contact_id_fkey(name)` in all invoice-related queries. For the `payments` nested query that embeds `invoices → contacts`, the same disambiguation is needed inside the nested select.

For `BatchTracking.tsx`, the `contacts(name)` references the `supplier_id` column on `batches`, which only has one FK path — no change needed there.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Sales.tsx` | `contacts(name)` → `contacts!invoices_contact_id_fkey(name)` |
| `src/pages/Purchases.tsx` | Same fix |
| `src/components/InvoiceDetail.tsx` | Same fix |
| `src/components/dashboard/TopCustomers.tsx` | Same fix |
| `src/components/reports/CashClosingReport.tsx` | Fix both invoice query and nested payments→invoices→contacts query |
| `src/components/reports/FinancialReports.tsx` | Check and fix any similar queries |
| `src/components/dashboard/RecentActivity.tsx` | Check payments→invoices→contacts query |

All changes are single-line string replacements — no logic changes.

