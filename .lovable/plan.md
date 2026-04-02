

## Receipt Voucher + Payment Voucher System

### Summary
Add `contact_id`, `voucher_type`, and `payment_method` columns to `payments`. Build voucher list pages, sidebar nav, and upgrade the RecordPayment form with payment method, notes, and a clear invoice summary. Use voucher SUM as source of truth. Normalize existing data safely in migration.

---

### Part 1: Schema Migration

```sql
-- Add new columns
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
-- This makes voucher sums the single source of truth going forward
WITH payment_sums AS (
  SELECT invoice_id, COALESCE(SUM(amount), 0) as total_paid
  FROM payments GROUP BY invoice_id
)
UPDATE invoices i
SET amount_paid = ps.total_paid,
    balance_due = i.total - ps.total_paid,
    payment_status = CASE
      WHEN ps.total_paid >= i.total THEN 'paid'
      WHEN ps.total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END
FROM payment_sums ps
WHERE i.id = ps.invoice_id AND i.amount_paid != ps.total_paid;
```

This safely handles pre-existing invoices that had manual `amount_paid` values.

### Part 2: Upgrade RecordPayment Component

**File: `src/components/RecordPayment.tsx`**

- Add props: `contactId`, `invoiceType`, `invoiceTotal`
- Add `payment_method` select (Cash / Bank) and `notes` textarea
- **Show clear invoice summary at top**: Invoice Total, Total Paid, Remaining Balance (highlighted)
- On save:
  1. Insert payment with `contact_id`, `voucher_type`, `payment_method`, `notes`
  2. Query `SELECT SUM(amount) FROM payments WHERE invoice_id = ?`
  3. Update invoice `amount_paid`, `balance_due`, `payment_status` from that SUM
- Label form header as "Add Receipt Voucher" or "Add Payment Voucher" based on invoice type

### Part 3: Invoice Detail Enhancements

**File: `src/components/InvoiceDetail.tsx`**

- Show **Invoice Total / Total Paid / Remaining Balance** prominently in a summary bar (not just in the totals section)
- In voucher history section: add payment method and voucher type columns
- Show RecordPayment form whenever `balance_due > 0` (currently only for credit/partial)
- Pass `contactId`, `invoiceType`, `invoiceTotal` to RecordPayment

### Part 4: Voucher List Pages

**New: `src/pages/ReceiptVouchers.tsx`**
- Query payments where `voucher_type = 'receipt'`, join invoices for invoice_number, contacts for name
- Columns: Date | Invoice # | Customer | Amount | Method | Notes
- Filters: date range, payment method

**New: `src/pages/PaymentVouchers.tsx`**
- Same structure, `voucher_type = 'payment'`
- Columns: Date | Invoice # | Supplier | Amount | Method | Notes

### Part 5: Sidebar + Routes

**`src/components/AppSidebar.tsx`**: Add Receipt Vouchers and Payment Vouchers nav items (after Sales/Purchases)

**`src/App.tsx`**: Add `/receipt-vouchers` and `/payment-vouchers` routes

### Part 6: Translation Keys

Add to `src/contexts/LanguageContext.tsx`:

| Key | EN | UR |
|-----|----|----|
| `nav.receiptVouchers` | Receipt Vouchers | رسید واؤچرز |
| `nav.paymentVouchers` | Payment Vouchers | ادائیگی واؤچرز |
| `voucher.receipt` | Receipt Voucher | رسید واؤچر |
| `voucher.payment` | Payment Voucher | ادائیگی واؤچر |
| `voucher.history` | Voucher History | واؤچر ہسٹری |
| `voucher.method` | Payment Method | ادائیگی کا طریقہ |
| `voucher.cash` | Cash | نقد |
| `voucher.bank` | Bank | بینک |
| `voucher.totalPaid` | Total Paid | کل ادائیگی |
| `voucher.remaining` | Remaining Balance | باقی رقم |
| `voucher.addReceipt` | Add Receipt Voucher | رسید واؤچر شامل کریں |
| `voucher.addPayment` | Add Payment Voucher | ادائیگی واؤچر شامل کریں |
| `voucher.notes` | Notes | نوٹس |

### Part 7: Source of Truth — Voucher SUM

Every time a payment is recorded (RecordPayment) or deleted (InvoiceDetail), invoice totals are recalculated from `SUM(payments.amount)`. No more manual increment/decrement of `amount_paid`.

### Files Changed

| # | File | Change |
|---|------|--------|
| 1 | Migration | Add columns, backfill, normalize existing data |
| 2 | `RecordPayment.tsx` | Payment method, notes, voucher type, SUM-based update, invoice summary display |
| 3 | `InvoiceDetail.tsx` | Show method in history, pass new props, show form for all unpaid |
| 4 | `ReceiptVouchers.tsx` | New list page |
| 5 | `PaymentVouchers.tsx` | New list page |
| 6 | `AppSidebar.tsx` | Add nav items |
| 7 | `App.tsx` | Add routes |
| 8 | `LanguageContext.tsx` | Translation keys |

### What This Does NOT Build
- Standalone vouchers, advances, journal entries, cheque clearing

