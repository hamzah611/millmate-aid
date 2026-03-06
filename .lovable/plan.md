

## Plan: Add Stock Value Column to Products Page

### Approach
Fetch purchase invoice items to calculate weighted average cost per product, then display `stock_qty * avg_cost` as "Stock Value" in the table. Falls back to `default_price` for products with no purchase history.

### Changes

**`src/pages/Products.tsx`**
- Add a second query fetching purchase invoice items: `invoice_items` joined with `invoices` filtered by `invoice_type = 'purchase'`, selecting `product_id, quantity, total`
- Compute a `Map<product_id, weighted_avg_cost>` from the purchase data (total cost / total qty per product)
- Add a "Stock Value" column header between Price and Actions
- Render `₨ (stock_qty * avg_cost).toLocaleString()` per row, falling back to `stock_qty * default_price`
- Update CSV export to include the Stock Value column
- Update colSpan for loading/empty states (add 1)

**`src/contexts/LanguageContext.tsx`**
- Add translation key `products.stockValue` ("Stock Value" / "اسٹاک قیمت")

### Also Fix
The notification panel has a failing query (`stock_qty=lte.min_stock_level` returns 400 error). In `NotificationPanel.tsx`, the low stock query already fetches all products and filters client-side, so this is a separate query issue — but from the network logs, the component already works correctly by fetching all products and filtering in JS. No fix needed there.

