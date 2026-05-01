-- Atomic stock update for invoices.
-- Replaces client-side SELECT→UPDATE loops with a single transactional RPC.
-- Called by the client after invoice_items have been written for new invoices,
-- and BEFORE item deletion for edits (so the reversal can read old items).

CREATE OR REPLACE FUNCTION process_invoice_stock(
  p_invoice_id  uuid,
  p_invoice_type text,          -- 'sale' | 'purchase'
  p_is_edit     boolean,
  p_items       jsonb,          -- array of {product_id, unit_id, quantity, price_per_unit, total}
  p_user_id     uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item            jsonb;
  v_product_id      uuid;
  v_unit_id         uuid;
  v_quantity        numeric;
  v_price_per_unit  numeric;
  v_item_total      numeric;
  v_unit_kg_value   numeric;
  v_kg_qty          numeric;
  v_stock_qty       numeric;
  v_avg_cost        numeric;
  v_default_price   numeric;
  v_purchase_unit_cost numeric;
  v_old_stock_units numeric;
  v_new_stock_units numeric;
  v_new_avg_cost    numeric;
  v_old_item        record;
BEGIN
  -- ── EDIT: reverse stock from currently stored items ──
  IF p_is_edit THEN
    FOR v_old_item IN
      SELECT ii.product_id, ii.unit_id, ii.quantity
      FROM   invoice_items ii
      WHERE  ii.invoice_id = p_invoice_id
    LOOP
      SELECT kg_value INTO v_unit_kg_value FROM units WHERE id = v_old_item.unit_id;
      IF v_unit_kg_value IS NULL THEN CONTINUE; END IF;

      v_kg_qty := v_old_item.quantity * v_unit_kg_value;

      IF p_invoice_type = 'sale' THEN
        -- Reverse a sale: add stock back
        UPDATE products
        SET    stock_qty = GREATEST(0, stock_qty + v_kg_qty)
        WHERE  id = v_old_item.product_id;
      ELSE
        -- Reverse a purchase: subtract stock
        UPDATE products
        SET    stock_qty = GREATEST(0, stock_qty - v_kg_qty)
        WHERE  id = v_old_item.product_id;
      END IF;
    END LOOP;
  END IF;

  -- ── Apply new items ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id     := (v_item->>'product_id')::uuid;
    v_unit_id        := (v_item->>'unit_id')::uuid;
    v_quantity       := (v_item->>'quantity')::numeric;
    v_price_per_unit := (v_item->>'price_per_unit')::numeric;
    v_item_total     := (v_item->>'total')::numeric;

    SELECT kg_value INTO v_unit_kg_value FROM units WHERE id = v_unit_id;
    IF v_unit_kg_value IS NULL THEN CONTINUE; END IF;

    v_kg_qty := v_quantity * v_unit_kg_value;

    -- Lock the row to prevent concurrent races
    SELECT stock_qty, avg_cost, default_price
    INTO   v_stock_qty, v_avg_cost, v_default_price
    FROM   products
    WHERE  id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_avg_cost := COALESCE(v_avg_cost, 0);

    IF p_invoice_type = 'sale' THEN
      UPDATE products
      SET    stock_qty = GREATEST(0, v_stock_qty - v_kg_qty)
      WHERE  id = v_product_id;

    ELSE
      -- Purchase: update stock and recalculate weighted average cost
      v_purchase_unit_cost := v_item_total / NULLIF(v_quantity, 0);
      v_old_stock_units    := v_stock_qty / NULLIF(v_unit_kg_value, 0);
      v_new_stock_units    := v_old_stock_units + v_quantity;

      IF v_new_stock_units > 0 THEN
        v_new_avg_cost := (v_old_stock_units * v_avg_cost + v_quantity * v_purchase_unit_cost)
                          / v_new_stock_units;
      ELSE
        v_new_avg_cost := v_purchase_unit_cost;
      END IF;

      UPDATE products
      SET    stock_qty = GREATEST(0, v_stock_qty + v_kg_qty),
             avg_cost  = v_new_avg_cost
      WHERE  id = v_product_id;

      -- Record price history when price differs from product default
      IF ABS(v_price_per_unit - COALESCE(v_default_price, 0)) > 0.01 THEN
        INSERT INTO price_history (product_id, old_price, new_price, changed_by)
        VALUES (v_product_id, v_default_price, v_price_per_unit, p_user_id);
      END IF;
    END IF;
  END LOOP;
END;
$$;
