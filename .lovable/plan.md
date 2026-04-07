

## Add Recalculate Avg Costs Utility

### Changes

**1. `src/lib/financial-utils.ts`** — Add `recalculateAllAvgCosts()` function

Add the exact function the user provided at the end of the file. It fetches all purchase invoice items chronologically, computes weighted average cost per product, and batch-updates the products table.

**2. `src/pages/Products.tsx`** — Add "Recalculate Avg Costs" button

- Import `recalculateAllAvgCosts` from `@/lib/financial-utils`
- Add a button in the header alongside the existing Export CSV and Add Product buttons
- Use `Calculator` icon from lucide-react
- On click: call `recalculateAllAvgCosts()`, show loading state, then toast with count of updated products
- Invalidate the `products` query after completion so the table refreshes

### No other files changed. No database changes.

