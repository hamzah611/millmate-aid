-- Invoice number sequences — guarantees uniqueness under concurrent saves.
-- Replaces the client-side fetch-then-increment pattern.

CREATE SEQUENCE IF NOT EXISTS invoice_seq_sale START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq_purchase START 1;

-- Initialize sequences to current max so new numbers never collide with existing ones.
DO $$
DECLARE
  v_max_sale int;
  v_max_purchase int;
BEGIN
  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(invoice_number, '^[A-Z]+-', ''), '')::int), 0
  ) INTO v_max_sale
  FROM invoices
  WHERE invoice_type = 'sale' AND invoice_number ~ '^SAL-[0-9]+$';

  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(invoice_number, '^[A-Z]+-', ''), '')::int), 0
  ) INTO v_max_purchase
  FROM invoices
  WHERE invoice_type = 'purchase' AND invoice_number ~ '^PUR-[0-9]+$';

  IF v_max_sale > 0 THEN
    PERFORM setval('invoice_seq_sale', v_max_sale);
  END IF;
  IF v_max_purchase > 0 THEN
    PERFORM setval('invoice_seq_purchase', v_max_purchase);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_invoice_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next bigint;
  v_prefix text;
BEGIN
  IF p_invoice_type = 'sale' THEN
    v_prefix := 'SAL';
    v_next   := nextval('invoice_seq_sale');
  ELSE
    v_prefix := 'PUR';
    v_next   := nextval('invoice_seq_purchase');
  END IF;
  RETURN v_prefix || '-' || lpad(v_next::text, 4, '0');
END;
$$;
