
## Improve Dashboard & Related Features

### 1. Recent Activity — Specific Labels

**File: `src/components/dashboard/RecentActivity.tsx`**
- Payments query: also select `voucher_type` from the `payments` table
- Use `voucher_type` to show "Receipt Voucher created" vs "Payment Voucher created" instead of generic "Payment recorded"
- Also include standalone vouchers (where `invoice_id` is null) with label "Direct Receipt Voucher" / "Direct Payment Voucher"

**File: `src/contexts/LanguageContext.tsx`**
- Add new translation keys: `dashboard.receiptVoucherCreated`, `dashboard.paymentVoucherCreated`, `dashboard.directReceiptVoucher`, `dashboard.directPaymentVoucher`

### 2. Dashboard Units — Fix Inactive Products & Low Stock

**File: `src/components/dashboard/InactiveProducts.tsx`**
- Fetch units with `kg_value` (currently only fetches `id, name, name_ur` — missing `kg_value`)
- Apply `stock_qty / kg_value` conversion before displaying, same as Low Stock does in Index.tsx

### 3. Business Separation — Dashboard Filtering

**File: `src/pages/Index.tsx`**
- Add a business unit filter dropdown at the top of the dashboard
- Filter Today's Sales and Today's Purchases queries by selected business unit
- Top Selling Products and Top Customers: pass `businessUnit` prop

**Files: `src/components/dashboard/TopSellingProducts.tsx`, `src/components/dashboard/TopCustomers.tsx`**
- Accept optional `businessUnit` prop
- When set, filter invoices by `business_unit` before aggregating

**Note:** Cash, Bank, Receivables, Payables, Inventory are cross-business by nature and should NOT be filtered — only revenue/expense metrics get filtered.

### 4. Dynamic Expense Categories

**File: `src/pages/ExpenseNew.tsx`**
- Add an "Add new category" option in the expense category dropdown (same `__add_new__` pattern as ContactForm)
- Show inline input + save that inserts into `expense_categories` and invalidates the query

**File: `src/pages/ExpenseEdit.tsx`**
- Same "Add new category" capability

### Summary of Files Modified
1. `src/components/dashboard/RecentActivity.tsx` — specific voucher labels
2. `src/components/dashboard/InactiveProducts.tsx` — fix unit display with kg_value
3. `src/components/dashboard/TopSellingProducts.tsx` — accept businessUnit filter
4. `src/components/dashboard/TopCustomers.tsx` — accept businessUnit filter
5. `src/pages/Index.tsx` — add BU filter, pass to sub-components
6. `src/pages/ExpenseNew.tsx` — dynamic category creation
7. `src/pages/ExpenseEdit.tsx` — dynamic category creation
8. `src/contexts/LanguageContext.tsx` — new translation keys

No database migrations needed. No changes to financial calculations.
