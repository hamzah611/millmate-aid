

## Fix Remaining QA Issues — Second Pass

### Issue Status Check
- **P&L transport double-count**: Already fixed (line 108 correctly does `grossProfit - operatingExpenses`)
- **Cash Flow double-count**: Already fixed (uses only `amount_paid` from invoices)
- **Fresh stock reads**: Already fixed in both `InvoiceForm.tsx` and `ProductionNew.tsx`
- **ContactEdit broker type**: Already fixed
- **Invoice number race condition**: Already fixed (retry loop + DB unique constraint)
- **Dashboard cash-in-hand**: Already fixed (filters by `payment_method = "cash"`)
- **Overdue invoices pending status**: Already fixed (includes `"pending"`)

### Remaining Issues to Fix

#### 1. Production query referencing non-existent FK
**File**: `src/pages/Production.tsx` line 19
- Query uses `products!productions_source_product_id_fkey(name)` — no FK exists in the database
- **Fix**: Change to a two-step approach: fetch productions, then fetch product names separately. Or use a simpler embedded select without the FK hint.

#### 2. Balance Sheet inventory valuation — use weighted average cost
**File**: `src/components/reports/FinancialReports.tsx` lines 312-317
- Currently uses `stock_qty * default_price`
- **Fix**: Replicate the weighted average cost logic from `Products.tsx` — fetch `invoice_items` from purchase invoices, compute avg cost per product, fall back to `default_price`.

#### 3. P&L discount/transport lines — misleading display
**File**: `src/components/reports/FinancialReports.tsx` lines 156-163
- The P&L statement table still computes `totalDiscount` and `totalTransport` variables (lines 94, 102-103) but doesn't display them anymore. The statement shows Revenue → COGS → Gross Profit → Expenses → Net Profit. This is already clean.
- **Status**: Already correct after the previous fix. The unused variables (`totalDiscount`, `totalTransport`) should be removed for cleanliness.

#### 4. Deletion safeguards for contacts/products/units
**Files**: `src/pages/Contacts.tsx`, `src/pages/Products.tsx`, `src/pages/Units.tsx`
- Before deleting, check if the record is referenced in invoices/invoice_items/products
- Show a warning toast and block deletion if in use

#### 5. Production output validation with user feedback
**File**: `src/pages/ProductionNew.tsx`
- Line 60 silently filters out invalid outputs. Add a `submitted` flag + toast + red borders when outputs have empty product or zero quantity.

#### 6. Low-stock filter fragile `as any` logic
**File**: `src/pages/Index.tsx` line 110
- Replace the fragile Supabase `.filter("stock_qty", "lte", "min_stock_level" as any)` with a plain `.select()` and do client-side filtering only (already has fallback on line 111, just remove the unreliable server filter).

#### 7. Ctrl+S stale closure in InvoiceForm
**File**: `src/components/InvoiceForm.tsx` lines 131-143
- The `useEffect` dependency array doesn't include `handleSave` itself
- **Fix**: Use a ref to always call the latest `handleSave`

#### 8. Batch tracking query FK issue
**File**: `src/components/inventory/BatchTracking.tsx` line 23
- Uses `products(name), contacts(name)` — no FKs exist. Same issue as Production.
- **Fix**: Use separate queries or add FKs. Since PostgREST can infer relationships from column names matching `{table}_id`, this actually works without explicit FKs for `product_id → products` and `supplier_id → contacts`. Verify this is stable or switch to explicit joins.

#### 9. Expense edit/delete UI
**File**: `src/pages/Expenses.tsx`
- Add edit and delete buttons per row. Edit navigates to a new `ExpenseEdit` page (or inline). Delete with confirmation dialog.
- Simpler approach: add a delete button with confirmation dialog inline on each row, and an edit button that navigates to `/expenses/edit/:id`.

### Files Changed
| File | Change |
|------|--------|
| `src/pages/Production.tsx` | Fix FK query to use separate product lookup |
| `src/components/reports/FinancialReports.tsx` | Balance Sheet uses weighted avg cost; remove unused P&L vars |
| `src/pages/Contacts.tsx` | Check invoice usage before delete |
| `src/pages/Products.tsx` | Check invoice_items usage before delete |
| `src/pages/Units.tsx` | Check product usage before delete |
| `src/pages/ProductionNew.tsx` | Output validation with toasts + red borders |
| `src/pages/Index.tsx` | Remove fragile server-side low-stock filter |
| `src/components/InvoiceForm.tsx` | Fix Ctrl+S stale closure with ref |
| `src/components/inventory/BatchTracking.tsx` | Verify/fix batch query approach |
| `src/pages/Expenses.tsx` | Add delete button with confirmation |
| `src/pages/ExpenseEdit.tsx` | New page for editing expenses |
| `src/App.tsx` | Add route for `/expenses/edit/:id` |
| `src/contexts/LanguageContext.tsx` | Translation keys for deletion warnings, expense edit |

