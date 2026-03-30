

# Full End-to-End QA Report

## Testing Methodology
Deep code-level audit of all pages, components, data flows, cross-module integrations, and financial logic. Console logs reviewed, session replay analyzed, database schema cross-referenced.

---

## 1. Module-by-Module Results

### Dashboard (Index.tsx)
- **What works**: Summary cards, Top Selling Products chart, Top Customers, Recent Activity, Inactive Products, Low Stock alerts, Overdue Invoices
- **Issues Found**:
  1. **BUG: Console warning** — `CartesianGrid` in recharts gets a ref it can't handle: "Function components cannot be given refs." Harmless but noisy. **Severity: Low**
  2. **BUG: Cash-in-hand calculation excludes expenses paid via bank** — The dashboard `totalCash` subtracts ALL expenses regardless of payment method. If an expense is paid via "bank", it shouldn't reduce cash-in-hand. **Severity: Medium**
  3. **BUG: Low stock filter is client-side and unreliable** — Uses `.filter("stock_qty", "lte", "min_stock_level" as any)` which is a hack that may not work as a proper Supabase column-to-column comparison. Falls back to client-side filtering, but the `as any` cast is fragile. **Severity: Medium**
  4. **BUG: Inventory value N+1 queries** — For each product without purchase history, makes an individual query to fetch `default_price`. Could cause performance issues with many products. **Severity: Low**
  5. **BUG: Overdue invoices logic doesn't account for "pending" status** — Only checks `["credit", "partial"]` but ignores `pending` invoices. A `pending` invoice past its terms is also overdue. **Severity: Medium**

### Contacts
- **What works**: List, search, create, edit, delete with confirmation dialog, CSV export, ledger view
- **Issues Found**:
  6. **BUG: Contact type "broker" not queryable in contacts list** — Contacts filter only matches `name`, not `contact_type`. No type filter exists. Brokers show in the list but aren't filterable. **Severity: Low**
  7. **RISK: Deleting a contact used in invoices** — No foreign key constraint prevents deletion. If a contact is deleted, invoices referencing it will show "—" for the contact name. No warning is given. **Severity: Medium**
  8. **BUG: ContactEdit doesn't handle "broker" type properly** — `ContactEdit.tsx` line 28 casts `contact_type` as `"customer" | "supplier" | "both"` — excludes `"broker"`. Editing a broker contact will silently reset its type. **Severity: High**

### Products
- **What works**: List with stock values, search (English + Urdu), create, edit, delete, stock value calculation with weighted average cost, CSV export
- **Issues Found**:
  9. **BUG: ProductForm has no name validation feedback** — Uses `required` HTML attribute but no toast or visual highlighting for missing fields. **Severity: Low**
  10. **BUG: ProductForm doesn't include `is_tradeable` toggle in the UI** — The `emptyForm` defaults `is_tradeable: true` but there's no checkbox/toggle in the form to change it. **Severity: Medium**
  11. **RISK: Deleting product used in invoices** — Same as contacts — no FK constraint, no warning. **Severity: Medium**

### Sales
- **What works**: List with filters (status, date range), CSV export, invoice detail dialog, payment recording, WhatsApp sharing, stock deduction on sale creation
- **Issues Found**:
  12. **BUG: Invoice date display shows raw ISO format** — Sales list shows `inv.invoice_date` directly (e.g., "2026-03-30") instead of formatted "30/03/2026". Inconsistent with other pages. **Severity: Low**
  13. **BUG: Race condition in invoice number generation** — `generateInvoiceNumber()` reads the last number and increments, but two concurrent saves could generate duplicate numbers. No DB-level unique constraint. **Severity: High**
  14. **BUG: Stock update uses stale product data** — `InvoiceForm.tsx` line 250-256: uses `products` from initial query cache, not fresh data. If stock changed between page load and save, the update will be incorrect. **Severity: High**
  15. **BUG: `handleSave` closure is stale in keyboard shortcut** — `useEffect` on line 131 captures `handleSave` but the dependency array doesn't include the function itself (it uses inline `handleSave`). Ctrl+S may use stale state. **Severity: Medium**

### Purchases
- **What works**: List, filters, detail dialog, broker commission logic, stock increase
- **Issues Found**:
  16. Same issues as Sales (#13, #14, #15)
  17. **BUG: Purchase date display also raw ISO** — Same as #12. **Severity: Low**

### Production
- **What works**: List, create with source/outputs, stock deduction/addition
- **Issues Found**:
  18. **BUG: Stock update uses stale cached data** — `ProductionNew.tsx` line 68-76: reads `products` from cache and uses `srcProduct.stock_qty` directly for the update, which could be stale. Same pattern as #14. **Severity: High**
  19. **BUG: No validation that outputs have valid products/quantities** — The `filter` on line 60 silently drops invalid outputs, but no user feedback is shown. **Severity: Low**
  20. **BUG: No FK in query** — `productions_source_product_id_fkey` is referenced in the query but there's no actual FK in the database (schema shows no FKs on `productions`). This query may fail or return null joins. **Severity: Medium-High**

### Reports
- **What works**: All 8 report tabs render, P&L correctly includes expenses, period selector works, Balance Sheet shows receivables/payables/inventory
- **Issues Found**:
  21. **BUG: P&L double-counts transport** — Line 107: `netProfit = grossProfit - totalTransport - operatingExpenses`. But `grossProfit = saleRevenue - purchaseCost`, and both `saleRevenue` and `purchaseCost` already INCLUDE transport charges (since `total = subtotal - discount + transport`). Transport is being subtracted twice. **Severity: High**
  22. **BUG: P&L discounts are displayed but not used in calculation** — `totalDiscount` is shown as a line item but not subtracted from anything. It's already baked into `total`. The display is misleading. **Severity: Medium**
  23. **BUG: Cash Flow double-counts initial payments** — Lines 218-229: Sums both `amount_paid` from invoices AND separate payment records. But the initial `amount_paid` on invoice creation is NOT recorded as a separate payment record, so this is actually correct for tracking total cash flow. However, subsequent payments via `RecordPayment` create a payment record AND update `amount_paid`. The cash flow report will then count the subsequent payment twice (once from `payments` table, once from the updated `amount_paid`). **Severity: High**
  24. **BUG: Balance Sheet inventory uses `default_price` not weighted average cost** — Inconsistent with the Products page which uses average purchase cost. **Severity: Medium**

### Inventory
- **What works**: Replenishment alerts, batch tracking, adjustments list with detail dialog, adjustment creation with stock preview
- **Issues Found**:
  25. **BUG: Batch tracking query may fail** — Similar FK issue as #20. **Severity: Medium**

### Expenses
- **What works**: List with filters, summary cards, category breakdown, CSV export, create with validation
- **Issues Found**:
  26. **Minor: No edit/delete capability** — Users cannot edit or delete expense records from the list. DB RLS allows it but UI doesn't. **Severity: Low**

### Units
- **What works**: CRUD inline editing, sub-unit selection (excludes self), delete with confirmation
- **Issues Found**:
  27. **BUG: Deleting a unit used by products** — No FK constraint, no warning. Products referencing deleted units will show blank unit names. **Severity: Medium**

---

## 2. Cross-Module Integration Issues

28. **Contacts → Invoices**: Works correctly. Customers appear in sales, suppliers in purchases.
29. **Products → Invoices**: Works. Stock updates on save. But stale data risk (#14).
30. **Invoices → Dashboard**: Summary cards correctly aggregate from invoices table.
31. **Expenses → P&L**: P&L correctly queries expenses by date range. Integration works.
32. **Adjustments → Stock**: Works correctly. Stock updates immediately.
33. **Production → Stock**: Works but has stale data risk (#18).

---

## 3. Backend / Data Integrity Findings

- **No foreign key constraints** on any table. All relationships are enforced only in application code. This means:
  - Deleting contacts/products/units leaves orphaned references
  - No cascading deletes
  - No referential integrity at DB level
- **No unique constraint on invoice_number** — race condition risk
- **Stock updates are not atomic** — read-then-write pattern in application code
- **RLS policies are appropriately configured** for all tables

---

## 4. Bugs / Issues Summary (Ordered by Severity)

### Critical (High)
| # | Module | Issue | Impact |
|---|--------|-------|--------|
| 8 | Contacts | Editing a broker resets type to non-broker | Data corruption |
| 13 | Sales/Purchases | Race condition in invoice number generation | Duplicate invoice numbers |
| 14 | Sales/Purchases | Stock update uses stale cached data | Incorrect stock |
| 18 | Production | Stock update uses stale cached data | Incorrect stock |
| 20 | Production | Query references non-existent FK | Potential query failures |
| 21 | Reports | P&L double-counts transport charges | Incorrect profit calculation |
| 23 | Reports | Cash Flow double-counts subsequent payments | Incorrect cash flow |

### Medium
| # | Module | Issue |
|---|--------|-------|
| 2 | Dashboard | Cash-in-hand subtracts all expenses regardless of payment method |
| 3 | Dashboard | Low stock filter uses fragile `as any` cast |
| 5 | Dashboard | Overdue invoices excludes "pending" status |
| 7 | Contacts | No warning when deleting contact used in invoices |
| 10 | Products | No `is_tradeable` toggle in product form |
| 11 | Products | No warning when deleting product used in invoices |
| 15 | Sales | Ctrl+S keyboard shortcut may use stale state |
| 22 | Reports | P&L discount line is misleading |
| 24 | Reports | Balance Sheet uses default_price not avg cost |
| 27 | Units | No warning when deleting unit used by products |

### Low
| # | Module | Issue |
|---|--------|-------|
| 1 | Dashboard | CartesianGrid ref warning in console |
| 4 | Dashboard | N+1 queries for inventory value |
| 6 | Contacts | No type filter on contacts list |
| 9 | Products | No validation toast feedback |
| 12 | Sales/Purchases | Invoice dates in raw ISO format |
| 17 | Purchases | Same as #12 |
| 19 | Production | Invalid outputs silently dropped |
| 25 | Inventory | Batch tracking potential FK issue |
| 26 | Expenses | No edit/delete from list |

---

## 5. Recommended Fixes (Priority Order)

### Fix 1: P&L Transport Double-Count (Critical)
In `FinancialReports.tsx`, change line 107:
```
// Before: netProfit = grossProfit - totalTransport - operatingExpenses
// After:  netProfit = grossProfit - operatingExpenses
```
Transport is already included in invoice totals. Remove the separate transport deduction. Also remove the `totalTransport` and `totalDiscount` line items from the statement (they're misleading since they're baked into revenue/COGS).

### Fix 2: Cash Flow Double-Count (Critical)
In `CashFlowReport`, remove the `initialSalePayments`/`initialPurchasePayments` logic. Only use the `payments` table for subsequent payments, OR only use `amount_paid` from invoices. Don't sum both.

### Fix 3: Fresh Stock Read Before Update (Critical)
In `InvoiceForm.tsx` and `ProductionNew.tsx`, read the current `stock_qty` from the database immediately before updating, instead of using cached `products` data. Already done correctly in `AdjustmentNew.tsx` (line 109) — replicate that pattern.

### Fix 4: ContactEdit Broker Type (Critical)
Add `"broker"` to the type union in `ContactEdit.tsx` line 28:
```typescript
contact_type: data.contact_type as "customer" | "supplier" | "both" | "broker",
```

### Fix 5: Invoice Number Race Condition (Critical)
Add a unique constraint on `(invoice_type, invoice_number)` in the database. Handle the constraint violation error in code by retrying with the next number.

### Fix 6: Production FK Query (Critical)
Replace the FK-based join with a manual two-step query, or add actual foreign keys to the database.

### Fix 7-10: Medium fixes
- Fix dashboard cash calculation to only subtract "cash" method expenses
- Add overdue check for "pending" status
- Fix date formatting in Sales/Purchases lists
- Add `is_tradeable` toggle to ProductForm

### Fix 11-14: Low priority
- Add contact/product/unit deletion safeguards
- Add expense edit/delete
- Suppress CartesianGrid ref warning
- Add contact type filter

---

## 6. Final Verdict

**The software is MOSTLY STABLE with SERIOUS calculation bugs in financial reports.**

The UI layer is well-built, consistent, and functional. CRUD operations work, filters work, bilingual support works. However:

1. **Financial reports (P&L, Cash Flow) produce incorrect numbers** due to double-counting. This is the most critical issue — users making business decisions based on wrong profit figures.

2. **Stock integrity has race condition risks** — the read-then-write pattern without fresh reads can lead to incorrect stock levels under concurrent usage.

3. **No referential integrity** at the database level means data can become orphaned.

**Recommendation**: Fix the 6 critical issues before using the system for real financial decision-making. The UI/UX quality is high and the system is usable, but the calculation layer needs correction before it can be trusted for business operations.

