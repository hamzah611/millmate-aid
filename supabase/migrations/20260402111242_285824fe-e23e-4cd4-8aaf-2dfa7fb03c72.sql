
-- Add new columns to payments
ALTER TABLE payments ADD COLUMN contact_id uuid;
ALTER TABLE payments ADD COLUMN voucher_type text NOT NULL DEFAULT 'receipt';
ALTER TABLE payments ADD COLUMN payment_method text NOT NULL DEFAULT 'cash';

-- Backfill existing payments from their linked invoices
UPDATE payments p
SET contact_id = i.contact_id,
    voucher_type = CASE WHEN i.invoice_type = 'sale' THEN 'receipt' ELSE 'payment' END
FROM invoices i
WHERE p.invoice_id = i.id AND p.contact_id IS NULL;

-- NORMALIZE: Reconcile any invoices where amount_paid doesn't match SUM(payments)
WITH payment_sums AS (
  SELECT invoice_id, COALESCE(SUM(amount), 0) as total_paid
  FROM payments GROUP BY invoice_id
)
UPDATE invoices i
SET amount_paid = ps.total_paid,
    balance_due = i.total - ps.total_paid,
    payment_status = (CASE
      WHEN ps.total_paid >= i.total THEN 'paid'
      WHEN ps.total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END)::payment_status
FROM payment_sums ps
WHERE i.id = ps.invoice_id AND i.amount_paid != ps.total_paid;
