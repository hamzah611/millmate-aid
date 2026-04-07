

## Fix Products.tsx and ProductHistory.tsx (2 Issues)

### ISSUE 1 — Products.tsx: Use `avg_cost` from products table

**Remove:**
- The `purchaseItems` query (lines 35-45)
- The `avgCostMap` useMemo (lines 47-61)
- Remove `useMemo` from imports (line 1) since it's no longer needed

**Change `getStockValue()`:**
Replace `const avgCost = avgCostMap.get(p.id) ?? p.default_price;` with:
`const avgCost = Number(p.avg_cost) > 0 ? Number(p.avg_cost) : (p.default_price || 0);`

### ISSUE 2 — ProductHistory.tsx: Show product-linked expenses

**Add new query** for expenses:
```
supabase.from("expenses")
  .select("id, amount, notes, expense_date, payment_method, expense_categories(name, name_ur)")
  .eq("product_id", id!)
```
Note: The `expenses` table has `notes` (not `description`) and `category_id` (not `category`), so we join `expense_categories` for the category name.

**Add summary card** — a 5th card in the grid (change to `md:grid-cols-5`) showing total expenses for this product.

**Add expenses table section** below the transaction history table:
- Title: "Product Expenses"
- Columns: Date | Notes | Category | Payment Method | Amount
- Empty state: "No expenses recorded for this product."

### Files changed

| File | Changes |
|---|---|
| `src/pages/Products.tsx` | Remove purchaseItems query + avgCostMap, use `p.avg_cost` directly |
| `src/pages/ProductHistory.tsx` | Add expenses query, summary card, expenses table |

