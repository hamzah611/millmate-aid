

## Fix Production Save Logic — 4 Bugs

### Database Migration

Add `deficit_quantity` column to `productions` table:
```sql
ALTER TABLE productions ADD COLUMN IF NOT EXISTS deficit_quantity numeric DEFAULT 0;
```

### File Changes

**1. `src/pages/ProductionNew.tsx` — Bugs 1, 2, 4**

- **Bug 1**: In `handleSave`, after fetching `freshSrc`, use `freshSrc.stock_qty` as `actualSourceQty`. Set source product stock to 0. Calculate output quantities as `(o.percentage / 100) * actualSourceQty`. Also update the production record's `source_quantity` to `actualSourceQty`.
- **Bug 2**: Calculate `deficitQty = ((100 - totalOutputPct) / 100) * actualSourceQty`. After inserting production record and outputs, update the production with `deficit_quantity: deficitQty`.
- **Bug 4**: The existing check `if (totalPercentage > 100)` already exists but only shows a toast without returning early in all paths. Ensure the save is blocked with an early return when `totalPercentage > 100`.

**2. `src/pages/Production.tsx` — Bug 3a**

- Add a "Deficit" column header after "Outputs"
- In each row, display `p.deficit_quantity` formatted with the source product's unit
- Update CSV export to include deficit column
- Update `colSpan` on loading/empty rows from 3 to 4

**3. `src/pages/ProductHistory.tsx` — Bug 3b**

- In the productions `asSource` query, also select `deficit_quantity`
- When building entries from `productions.asSource`, add a second entry for each production that has `deficit_quantity > 0`: type "Production Deficit/Loss", shown in `qtyOut` column with the deficit quantity

### No other files changed.

