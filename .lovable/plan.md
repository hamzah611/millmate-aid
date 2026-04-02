

## Phase 3 Final — Unit Consistency, Inventory Accuracy, Opening Stock & UX Polish

### 1. Remove Hardcoded "KG" (5 files)

Replace every hardcoded `" KG"` with the product's actual unit from the units table.

| File | Lines | Current | Fix |
|------|-------|---------|-----|
| `Production.tsx` | 50, 55, 101, 104 | `{qty} KG` in table + CSV export | Fetch `unit_id` with products, add units query + `getUnitName` helper, display `{qty} {unitName}` |
| `Adjustments.tsx` | 34, 96, 140 | `"Quantity (KG)"` header + `{qty} KG` in table and detail dialog | Fetch `products(name, unit_id)` instead of `products(name)`, add units query, display dynamic unit |
| `AdjustmentNew.tsx` | 188, 195, 218, 237 | `{qty} KG` in stock preview, batch dropdown, quantity label | Fetch selected product's `unit_id`, add units query, replace all hardcoded KG |
| `LanguageContext.tsx` | `invoice.totalKg` | `"Total: {0} KG"` / `"کل: {0} کلو"` | Change to `"Total: {0} {1}"` / `"کل: {0} {1}"` |
| `InvoiceItemRow.tsx` | 302 | Uses `totalKg` with single `{0}` | Pass base unit name as `{1}` — resolve from units table where `kg_value === 1` |

**Not changed**: `Units.tsx` — the KG reference there is intentional (shows conversion factor).

### 2. Inventory Valuation Fix (Dashboard + Balance Sheet)

**Problem**: The dashboard (`Index.tsx` lines 97-130) and balance sheet (`FinancialReports.tsx` lines 457-484) both compute inventory value but have issues with opening stock and zero-value products.

**Solution**: Extract a shared `calculateInventoryValue()` utility in `src/lib/financial-utils.ts` used by both dashboard and balance sheet.

```text
┌─────────────────────────────────────────────────────┐
│ For each product with stock_qty > 0:                │
│                                                     │
│  1. Fetch purchase history (invoice_items)           │
│     totalPurchasedQty, totalPurchasedCost            │
│                                                     │
│  2. If totalPurchasedQty > 0:                       │
│     avgCost = totalPurchasedCost / totalPurchasedQty │
│  Else:                                              │
│     avgCost = default_price (if > 0), else 0        │
│                                                     │
│  3. Opening stock detection:                        │
│     if stock_qty > totalPurchasedQty:               │
│       openingStock = stock_qty - totalPurchasedQty  │
│       purchasedStock = totalPurchasedQty             │
│     else:                                           │
│       openingStock = 0                              │
│       purchasedStock = stock_qty                    │
│                                                     │
│  4. Value:                                          │
│     purchasedValue = purchasedStock × avgCost       │
│     openingValue = openingStock × (avgCost or       │
│                    default_price, whichever exists)  │
│     productValue = purchasedValue + openingValue    │
│                                                     │
│  5. Track flags:                                    │
│     hasValuationGap = (avgCost === 0 &&             │
│                        default_price === 0)         │
│     hasOpeningStock = openingStock > 0              │
└─────────────────────────────────────────────────────┘
```

**Return type**:
```typescript
interface InventoryValuation {
  totalValue: number;
  hasValuationGap: boolean;   // any product with 0 cost
  hasOpeningStock: boolean;   // any product with opening stock
}
```

**File changes**:

| File | Change |
|------|--------|
| `src/lib/financial-utils.ts` | Add `calculateInventoryValue()` function |
| `src/pages/Index.tsx` | Replace inline inventory query with `calculateInventoryValue()`. Show "Includes opening stock" hint if `hasOpeningStock`. Keep existing "No cost data" warning if `hasValuationGap`. |
| `src/components/reports/FinancialReports.tsx` | Replace inline inventory query with same shared function. Show ⚠ on inventory line if gap exists. |

### 3. Dashboard Confirmation

Already correct — no changes needed:
- **Low Stock widget**: Uses `getUnitName(unit_id)` — shows `{qty} {unitName}`
- **Inactive Products widget**: Uses `getUnitName(unit_id)` — shows `{qty} {unitName}`
- **Summary cards**: Show monetary values only (₨), no quantity units needed
- **Inventory Value card**: Already shows "No cost data" warning — will be enhanced with opening stock hint

### 4. Recent Activity — Already Interactive

Already implemented (from earlier approved plan):
- Each row is clickable with `onClick={() => navigate(a.link)}`
- Shows amount inline `(₨X,XXX)`
- Expand/collapse with Show More/Show Less button when >10 items
- Hover indicator with chevron icon

No further changes needed.

### 5. ESC Key — Add to Edit Pages

`useEscapeBack()` is already on all "New" pages. Missing from edit pages:

| File | Change |
|------|--------|
| `src/pages/ContactEdit.tsx` | Add `useEscapeBack()` |
| `src/pages/ProductEdit.tsx` | Add `useEscapeBack()` |
| `src/pages/ExpenseEdit.tsx` | Add `useEscapeBack()` |

### 6. Validation — Already Correct (No Changes)

`InvoiceForm.tsx` already filters contacts:
- Sales: only `customer` / `both` types, excludes `cash`, `bank`, `closing` categories
- Purchases: only `supplier` / `both` types, excludes `cash`, `bank`, `closing` categories
- `BatchNew.tsx`: only `supplier` / `both`

### 7. Translation Keys to Add

| Key | English | Urdu |
|-----|---------|------|
| `dashboard.includesOpeningStock` | `"Includes opening stock"` | `"ابتدائی اسٹاک شامل ہے"` |

### Summary of All Files Changed

| # | File | Purpose |
|---|------|---------|
| 1 | `src/lib/financial-utils.ts` | Add shared `calculateInventoryValue()` |
| 2 | `src/pages/Index.tsx` | Use shared valuation, opening stock hint |
| 3 | `src/components/reports/FinancialReports.tsx` | Use shared valuation |
| 4 | `src/pages/Production.tsx` | Dynamic units |
| 5 | `src/pages/Adjustments.tsx` | Dynamic units |
| 6 | `src/pages/AdjustmentNew.tsx` | Dynamic units |
| 7 | `src/contexts/LanguageContext.tsx` | Update `totalKg` format, add opening stock key |
| 8 | `src/components/InvoiceItemRow.tsx` | Pass unit name to helper text |
| 9 | `src/pages/ContactEdit.tsx` | Add ESC back |
| 10 | `src/pages/ProductEdit.tsx` | Add ESC back |
| 11 | `src/pages/ExpenseEdit.tsx` | Add ESC back |

### What This Does NOT Touch
- No schema changes
- No new modules or features
- No financial logic redesign
- No voucher system
- Dashboard and Recent Activity already working correctly

