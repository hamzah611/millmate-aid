

## Redesign Dual-Unit Quantity Entry (Sales Invoice)

### Current State
The sub-unit system already exists (units have `sub_unit_id`, `InvoiceItemRow` has dual inputs). The UX needs polish and consistency fixes.

### Changes

#### 1. `src/components/InvoiceItemRow.tsx`
- **Always show sub-qty column**: When no sub-unit exists, render a disabled/muted input so grid stays stable across rows
- **Validation**: If secondary unit equals primary unit, ignore sub-qty (treat as 0). Prevent this at the units page level too
- **Helper text on every row**: Show "Total: X KG" below every row where a unit is selected, computed as `(mainQty * unit.kg_value) + (subQty * subUnit.kg_value)`. When no sub-unit, just show `mainQty * unit.kg_value`
- **Label sub-qty input** with the actual sub-unit name as placeholder (e.g., "KG"), but the column header stays generic

#### 2. `src/components/InvoiceForm.tsx`
- **Fixed 7-column header**: `Product | Unit | Qty | Sub-Unit Qty | Price | Total | Del`
- Always 7 columns regardless of row content — remove `anyHasSubUnit` conditional logic
- Ensure stock deduction logic uses combined quantity: `quantity * unit.kg_value` (already correct since `quantity` stores the decimal in primary unit terms)

#### 3. `src/components/InvoiceDetail.tsx`
- Display quantity using combined value correctly (already stores decimal quantity — no change needed, but verify rendering)

#### 4. `src/pages/Units.tsx`
- Add validation: sub-unit selector should exclude the unit itself from the dropdown options

#### 5. `src/contexts/LanguageContext.tsx`
- Add keys: `"invoice.totalKg"` → `{ en: "Total: {0} KG", ur: "کل: {0} کلو" }`
- Add key: `"invoice.subQty"` → `{ en: "Sub-Unit Qty", ur: "ذیلی مقدار" }`

#### No DB changes needed
The `units.sub_unit_id` column and all invoice fields already exist.

### Calculation Logic (unchanged)
```
quantity = mainQty + (subQty * subUnit.kg_value / unit.kg_value)
line_total = quantity * price_per_unit
stock_impact = quantity * unit.kg_value = total_kg
```

### Files Changed
| File | Change |
|------|--------|
| `src/components/InvoiceItemRow.tsx` | Helper text on all rows, disabled sub-qty when no sub-unit, sub-unit != primary validation |
| `src/components/InvoiceForm.tsx` | Fixed 7-col header with generic "Sub-Unit Qty" label, remove conditional grid |
| `src/pages/Units.tsx` | Exclude self from sub-unit dropdown |
| `src/contexts/LanguageContext.tsx` | 2 new translation keys |

