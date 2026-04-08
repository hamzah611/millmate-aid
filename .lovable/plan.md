

## Fix: Cash Sales Not Reflected in Cash in Hand

### Root Cause

When an invoice is created with status "paid" or "partial", the `InvoiceForm` sets `amount_paid` on the invoice record but **never creates a corresponding record in the `payments` table**. The `calculateCashInHand()` function derives cash balance exclusively from the `payments` table. Result: cash sales are recorded as paid but the cash movement is invisible to the financial system.

### Solution

When creating a new invoice (not editing) with `amountPaid > 0`, automatically insert a payment record into the `payments` table. This ensures the cash/financial flow is properly tracked.

### File: `src/components/InvoiceForm.tsx`

After the invoice is created and line items are inserted (around line 377, before stock updates), add:

```typescript
// Auto-create payment record for paid/partial invoices
if (!isEdit && amountPaid > 0) {
  await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount: amountPaid,
    payment_date: invoiceDate,
    contact_id: contactId,
    voucher_type: type === "sale" ? "receipt" : "payment",
    payment_method: "cash",
    notes: `Auto-generated from ${invoiceNumber}`,
  });
}
```

This means:
- **Sale marked "paid"**: Creates a receipt voucher (cash in) → adds to Cash in Hand
- **Sale marked "partial"**: Creates a receipt voucher for the partial amount
- **Sale marked "credit"**: amountPaid is 0, no payment record created (correct)
- **Purchase marked "paid"**: Creates a payment voucher (cash out) → deducts from Cash in Hand
- **Editing invoices**: No change — edits already use RecordPayment which correctly inserts into `payments`

### Why "cash" as default payment method

The current form has no cash/bank selector for the initial payment. Since "cash" is the most common method in this business context, it defaults to cash. A future enhancement could add a payment method dropdown when status is "paid" or "partial".

### No other files changed. No database changes needed.

