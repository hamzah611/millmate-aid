-- Server-side low-stock filter — replaces client-side array filter on all products.
CREATE OR REPLACE VIEW low_stock_products AS
SELECT id, name, stock_qty, min_stock_level, unit_id
FROM   products
WHERE  min_stock_level IS NOT NULL
  AND  stock_qty <= min_stock_level;
