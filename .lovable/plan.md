

## Production Form Changes — 3 Modifications

### CHANGE 1 — ProductionNew.tsx: Auto-use full stock as source quantity

- Remove `sourceQuantity` state variable
- Derive `sourceQuantity` from selected product: `const sourceProduct = products?.find(p => p.id === sourceProductId); const sourceQuantity = sourceProduct?.stock_qty || 0;`
- Remove the source quantity `<Input>` field (lines 138-141)
- Add read-only text below source dropdown: `"Available Stock: {fmtQty(sourceQuantity)} {unitName}"`
- Update validation: check `sourceQuantity > 0` (stock must exist)

### CHANGE 2 — ProductionNew.tsx: Percentage-based outputs

- Change `OutputItem` interface: replace `quantity: number` with `percentage: number`
- Replace quantity input with percentage input (0-100) with "%" label next to it
- Show calculated quantity as read-only text: `{fmtQty((o.percentage / 100) * sourceQuantity)} {unitName}`
- Add running total below outputs list: `Total: {sum}%` — if >100%, show in red with warning
- On save: compute `quantity = (percentage / 100) * sourceQuantity` for each output row before inserting into `production_outputs`
- Validation: check percentage > 0 instead of quantity > 0

### CHANGE 3 — Production.tsx: Remove Source Qty column

- Remove `<TableHead>{t("production.sourceQty")}</TableHead>` (line 110)
- Remove the corresponding `<TableCell>` (line 124)
- Update `colSpan` from 4 to 3 in loading/empty rows
- Update CSV export: remove "Source Qty" column and its data

### Files changed

| File | Changes |
|---|---|
| `src/pages/ProductionNew.tsx` | Remove source qty input, derive from stock; percentage-based outputs |
| `src/pages/Production.tsx` | Remove Source Qty column from table and CSV export |

