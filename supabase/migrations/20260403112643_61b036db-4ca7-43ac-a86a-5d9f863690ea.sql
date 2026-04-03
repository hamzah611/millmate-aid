-- Payments: bank tracking + voucher numbering
ALTER TABLE public.payments ADD COLUMN bank_contact_id uuid;
ALTER TABLE public.payments ADD COLUMN voucher_number text;

-- Expenses: bank tracking
ALTER TABLE public.expenses ADD COLUMN bank_contact_id uuid;

-- Sequence for collision-safe voucher numbering
CREATE SEQUENCE IF NOT EXISTS voucher_receipt_seq START 1;
CREATE SEQUENCE IF NOT EXISTS voucher_payment_seq START 1;

-- Initialize sequences to current max (safe for existing data)
DO $$
DECLARE rv_max int; pv_max int;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM 4) AS int)), 0)
    INTO rv_max FROM payments WHERE voucher_number LIKE 'RV-%';
  SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM 4) AS int)), 0)
    INTO pv_max FROM payments WHERE voucher_number LIKE 'PV-%';
  PERFORM setval('voucher_receipt_seq', GREATEST(rv_max, 1), rv_max > 0);
  PERFORM setval('voucher_payment_seq', GREATEST(pv_max, 1), pv_max > 0);
END $$;

-- DB function for collision-safe voucher number generation
CREATE OR REPLACE FUNCTION public.next_voucher_number(v_type text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF v_type = 'receipt' THEN
    RETURN 'RV-' || LPAD(nextval('voucher_receipt_seq')::text, 4, '0');
  ELSE
    RETURN 'PV-' || LPAD(nextval('voucher_payment_seq')::text, 4, '0');
  END IF;
END;
$$;