

## Apply Three-Decimal Formatting to All Stock Displays

### Problem
Several places display raw `stock_qty` values without using `fmtQty()`, resulting in inconsistent decimal precision across the app.

### Changes

**1. `src/pages/Products.tsx`** — `getDisplayQty` function
- Currently rounds to 2 decimals via `Math.round(...*100)/100`
- Change to return the raw division result, then wrap display in `fmtQty()`
- Badge display: `fmtQty(getDisplayQty(p))` instead of bare `{getDisplayQty(p)}`
- CSV export: use `fmtQty()` for stock column

**2. `src/components/InvoiceItemRow.tsx`** — Two places
- Line 86: sublabel showing stock available uses raw `p.stock_qty` → wrap with `fmtQty()`
- Line 318: stock warning uses `.toFixed(1)` → replace with `fmtQty()`

**3. `src/pages/ProductionNew.tsx`** — Line 132
- Product dropdown shows raw `p.stock_qty` → wrap with `fmtQty()`
- Add import for `fmtQty`

**4. `src/components/dashboard/InactiveProducts.tsx`** — Line 78
- Shows raw `p.stock_qty` → wrap with `fmtQty()`
- Add import for `fmtQty`

**5. `src/pages/AdjustmentNew.tsx`** — Already uses `fmtQty` correctly (lines 204, 211) ✓

**6. `src/pages/Index.tsx`** — Line 235 already uses `fmtQty` ✓

### No logic changes
Only display formatting changes. All calculations, stock updates, and comparisons remain untouched.

### Files Modified
1. `src/pages/Products.tsx`
2. `src/components/InvoiceItemRow.tsx`
3. `src/pages/ProductionNew.tsx`
4. `src/components/dashboard/InactiveProducts.tsx`

