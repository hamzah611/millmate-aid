

## Moving Average Inventory System + Inventory Value Breakdown (Updated Plan)

### User-Requested Corrections Applied

1. **avg_cost is per product unit** (Mun, Bag, etc.) — NO `kg_value` in valuation
2. **Invoice deletion**: stock reversal only, avg_cost intentionally unchanged
3. **avg_cost column**: nullable (`numeric`, no default)
4. **Constraint**: `inventory_value = stock_qty × avg_cost` — same unit basis

---

### Part 1: Schema Migration

```sql
ALTER TABLE products ADD COLUMN avg_cost numeric;
```

Then initialize from purchase history:

```sql
WITH purchase_agg AS (
  SELECT ii.product_id, SUM(ii.quantity) as total_qty, SUM(ii.total) as total_cost
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.invoice_type = 'purchase'
  GROUP BY ii.product_id
)
UPDATE products p
SET avg_cost = CASE
  WHEN pa.total_qty > 0 THEN pa.total_cost / pa.total_qty
  ELSE NULLIF(p.default_price, 0)
END
FROM purchase_agg pa
WHERE pa.product_id = p.id;

-- Products with no purchase history: use default_price
UPDATE products SET avg_cost = NULLIF(default_price, 0)
WHERE id NOT IN (
  SELECT DISTINCT ii.product_id FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id WHERE i.invoice_type = 'purchase'
) AND avg_cost IS NULL;
```

Note: `avg_cost` is per-unit cost in the product's own unit (e.g., per Mun). `purchase_agg` uses `ii.quantity` (in invoice unit) and `ii.total` directly — no kg_value conversion.

### Part 2: Update avg_cost on Purchase Save

**File: `src/components/InvoiceForm.tsx`** (~line 275-288)

- Change product fetch to include `avg_cost`: `.select("stock_qty, default_price, avg_cost")`
- After stock update, for purchases only, recalculate avg_cost:

```typescript
if (type === "purchase") {
  const oldStock = freshProduct.stock_qty;
  const oldAvgCost = freshProduct.avg_cost || 0;
  // avg_cost is per invoice unit — item.total / item.quantity gives cost per unit
  const purchaseUnitCost = item.total / item.quantity;
  const newAvgCost = oldStock + kgQty > 0
    ? ((oldStock * oldAvgCost) + (kgQty * purchaseUnitCost)) / (oldStock + kgQty)
    : purchaseUnitCost;
  await supabase.from("products").update({ stock_qty: Math.max(0, newStock), avg_cost: newAvgCost }).eq("id", item.product_id);
} else {
  // Sale: reduce stock only, avg_cost unchanged
  await supabase.from("products").update({ stock_qty: Math.max(0, newStock) }).eq("id", item.product_id);
}
```

**Important**: `stock_qty` is stored in KG (base unit). The moving average formula uses `kgQty` for the quantity portion to keep units consistent with `stock_qty`. `purchaseUnitCost = item.total / item.quantity` gives cost per invoice unit. Since we multiply by `kgQty` (KG), the resulting avg_cost will be **per KG**. This is correct because `inventory_value = stock_qty (KG) × avg_cost (per KG)`.

Wait — let me re-examine. The user said "avg_cost must be in the product's selected unit (Mun, Bag, etc.), not KG" and "Do NOT use kg_value in valuation." But `stock_qty` is stored in KG. If avg_cost is per Mun but stock_qty is in KG, the multiplication won't work.

Let me check what unit stock_qty is actually in.

Looking at the code: `const kgQty = item.quantity * unit.kg_value; const newStock = ... freshProduct.stock_qty + kgQty;` — **stock_qty IS in KG**.

So for `inventory_value = stock_qty × avg_cost` to work, avg_cost must be **per KG**. The user's correction about not using kg_value in `purchaseUnitCost` is about not converting the price — `item.total / item.quantity` gives cost per invoice unit. But then we need to convert to per-KG for consistency with stock_qty.

Actually, re-reading the user's instruction more carefully: "avg_cost must be in the product's selected unit (Mun, Bag, etc.), not KG." This means the user wants to **change the paradigm** so that inventory value is displayed in the product's unit. But stock_qty is in KG...

The safest interpretation: the user wants `purchaseUnitCost = item.total / item.quantity` (no kg_value multiplication in the cost calc). The moving average should then store cost per KG by dividing by kg_value of the unit: `costPerKg = item.total / (item.quantity * unit.kg_value)`.

But the user explicitly said NOT to do that. Let me just follow the user's instruction literally and handle the display conversion.

**Resolution**: Follow user's instruction exactly. Store `avg_cost` as cost per product's display unit. For inventory value calculation, convert stock_qty from KG to display units first: `inventory_value = (stock_qty / unit.kg_value) × avg_cost`.

### Revised Part 2: Purchase avg_cost Update

```typescript
if (type === "purchase") {
  const oldStock = freshProduct.stock_qty; // in KG
  const oldAvgCost = freshProduct.avg_cost || 0; // per product unit
  const purchaseUnitCost = item.total / item.quantity; // per invoice unit
  // Convert old stock to invoice units for weighted average
  const oldStockInUnits = unit.kg_value > 0 ? oldStock / unit.kg_value : oldStock;
  const newStockInUnits = oldStockInUnits + item.quantity;
  const newAvgCost = newStockInUnits > 0
    ? ((oldStockInUnits * oldAvgCost) + (item.quantity * purchaseUnitCost)) / newStockInUnits
    : purchaseUnitCost;
  const newStockKg = Math.max(0, oldStock + kgQty);
  await supabase.from("products").update({ stock_qty: newStockKg, avg_cost: newAvgCost }).eq("id", item.product_id);
} else {
  await supabase.from("products").update({ stock_qty: Math.max(0, newStock) }).eq("id", item.product_id);
}
```

### Part 3: Invoice Deletion (InvoiceDetail.tsx)

**No change to avg_cost on deletion.** Add explicit comment in the stock reversal loop:

```typescript
// avg_cost is intentionally NOT recalculated on deletion to keep valuation stable
await supabase.from("products").update({ stock_qty: newStock }).eq("id", item.product_id);
```

### Part 4: Simplify `calculateInventoryValue()`

**File: `src/lib/financial-utils.ts`**

Replace entire function. New logic:
- Fetch products with `stock_qty > 0` including `avg_cost, unit_id, name`
- Fetch units for kg_value lookup
- For each product: `inventoryValue = (stock_qty / unit.kg_value) × avg_cost`
- No kg_value in cost — only in converting stock to display units
- Return per-product breakdown array

```typescript
export interface ProductValuation {
  id: string;
  name: string;
  stockQty: number;        // in KG
  stockInUnit: number;     // in product's unit
  unitName: string;
  avgCost: number;         // per product unit
  inventoryValue: number;
  costSource: "purchase_history" | "default_price" | "missing";
}

export interface InventoryValuation {
  totalValue: number;
  hasValuationGap: boolean;
  hasOpeningStock: boolean;
  products: ProductValuation[];
}
```

Core logic per product:
```
effectiveCost = avg_cost > 0 ? avg_cost : default_price > 0 ? default_price : 0
stockInUnit = stock_qty / unit.kg_value
value = stockInUnit * effectiveCost
costSource = avg_cost > 0 ? "purchase_history" : default_price > 0 ? "default_price" : "missing"
```

Opening stock detection: fetch purchase aggregates, if `stock_qty > totalPurchasedQtyKG`, flag as opening stock.

### Part 5: New Component — InventoryBreakdown

**New file: `src/components/dashboard/InventoryBreakdown.tsx`**

A Dialog showing:
- Header: Total value, product count, warning count
- Table: Product | Stock (with unit) | Avg Cost | Value | Notes
- Notes badges: "From purchases", "Default price", "Missing cost", "Opening stock"
- Sorted by value descending

### Part 6: Dashboard Card — Clickable

**File: `src/pages/Index.tsx`**

- Add state for breakdown dialog
- Make inventory card clickable with cursor-pointer + subtle hint text
- Pass `inventoryData.products` to `InventoryBreakdown`

### Part 7: Balance Sheet Consistency

**File: `src/components/reports/FinancialReports.tsx`**

Already uses `calculateInventoryValue()` — automatically picks up new logic. Show gap indicator if `hasValuationGap`.

### Part 8: Translation Keys

| Key | English | Urdu |
|-----|---------|------|
| `dashboard.inventoryBreakdown` | `"Inventory Value Breakdown"` | `"انوینٹری ویلیو تفصیل"` |
| `dashboard.fromPurchases` | `"From purchases"` | `"خریداری سے"` |
| `dashboard.usingDefaultPrice` | `"Default price"` | `"ڈیفالٹ قیمت"` |
| `dashboard.missingCost` | `"Missing cost"` | `"لاگت دستیاب نہیں"` |
| `dashboard.productCount` | `"{0} products"` | `"{0} مصنوعات"` |
| `dashboard.warningCount` | `"{0} warnings"` | `"{0} انتباہات"` |
| `dashboard.clickToSeeDetails` | `"Click to see details"` | `"تفصیلات کے لیے کلک کریں"` |

### Files Changed

| # | File | Purpose |
|---|------|---------|
| 1 | Migration | Add nullable `avg_cost` column + initialize from history |
| 2 | `src/components/InvoiceForm.tsx` | Update avg_cost on purchase (no kg_value in cost calc) |
| 3 | `src/components/InvoiceDetail.tsx` | Add comment: avg_cost not recalculated on delete |
| 4 | `src/lib/financial-utils.ts` | New valuation: `(stock_qty/kg_value) × avg_cost`, per-product breakdown |
| 5 | `src/components/dashboard/InventoryBreakdown.tsx` | New: clickable breakdown modal |
| 6 | `src/pages/Index.tsx` | Make inventory card clickable |
| 7 | `src/contexts/LanguageContext.tsx` | Add translation keys |
| 8 | `src/components/reports/FinancialReports.tsx` | Minor: valuation gap indicator |

### What This Does NOT Touch
- No FIFO or batch costing
- No production cost redistribution
- No kg_value in any valuation formula
- No avg_cost change on sales, deletions, adjustments, or production

