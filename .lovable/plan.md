

## Add Live Stock Preview to Inventory Adjustment Form

### Changes

#### `src/pages/AdjustmentNew.tsx`
- Update products query to fetch `stock_qty` alongside `id, name`
- Add a stock preview card between the product selector and the type/quantity row:
  - **Before product selected**: Show muted placeholder "Select a product to see stock info"
  - **After product selected**: Show "Current Stock: 1,200 KG" in neutral styling
  - **When quantity entered**: Show "After Adjustment: 1,150 KG" in green (increase) or red (decrease)
  - **If result < 0**: Show warning badge "Stock will go negative" in destructive/amber styling
- Format all stock numbers with `toLocaleString()` for comma formatting (e.g., 1,200 KG)
- Preview updates reactively based on `productId`, `quantityKg`, and `adjustmentType` state

#### `src/contexts/LanguageContext.tsx`
- Add `"adjustments.currentStock"` → `{ en: "Current Stock", ur: "موجودہ اسٹاک" }`
- Add `"adjustments.afterStock"` → `{ en: "After Adjustment", ur: "ایڈجسٹمنٹ کے بعد" }`
- Add `"adjustments.selectProductHint"` → `{ en: "Select a product to see stock info", ur: "اسٹاک دیکھنے کے لیے پروڈکٹ منتخب کریں" }`
- Add `"adjustments.negativeWarning"` → `{ en: "Stock will go negative", ur: "اسٹاک منفی ہو جائے گا" }`

### Files Changed
| File | Change |
|------|--------|
| `src/pages/AdjustmentNew.tsx` | Live stock preview card with conditional rendering, formatting, and negative warning |
| `src/contexts/LanguageContext.tsx` | 4 new translation keys |

