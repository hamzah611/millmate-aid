

# Phase 3: Invoice Details, Payment Recording, and Data Management

Now that invoicing, production, and the live dashboard are functional, this phase adds the features needed for day-to-day operations: viewing invoice details, recording payments against credit invoices, editing/deleting records, and better data visibility.

---

## What will be built

### 1. Invoice Detail View
Clicking an invoice row in Sales or Purchases opens a detail dialog showing:
- Invoice number, date, contact name
- Full line items table (product, unit, qty, price, total)
- Subtotal, discount, transport, grand total
- Payment status and history of payments made
- "Record Payment" button for credit/partial invoices

### 2. Record Payment Against Credit/Partial Invoices
- A small form inside the invoice detail to record a new payment (amount + date)
- Inserts into the `payments` table
- Updates the invoice's `amount_paid` and `balance_due`
- Changes `payment_status` to "paid" when balance reaches zero
- Refreshes dashboard totals automatically

### 3. Edit and Delete for Contacts and Products
- Edit button on each row in Contacts and Products tables
- Opens a pre-filled dialog for editing
- Delete button (owner-only based on existing RLS) with confirmation dialog
- Proper query invalidation after changes

### 4. Invoice List Improvements
- Date range filter on Sales and Purchases pages
- Payment status filter (All / Paid / Partial / Credit)
- Show balance due column in the invoice table

### 5. Urdu Name Support in Products List
- Show Urdu name column in the products table when language is set to Urdu

---

## Technical Details

### New Files
| File | Purpose |
|------|---------|
| `src/components/InvoiceDetail.tsx` | Invoice detail dialog with line items and payment history |
| `src/components/RecordPayment.tsx` | Small form to add a payment against an invoice |
| `src/components/ContactForm.tsx` | Extracted reusable form for add/edit contact |
| `src/components/ProductForm.tsx` | Extracted reusable form for add/edit product |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Sales.tsx` | Add row click to open detail, date/status filters, balance column |
| `src/pages/Purchases.tsx` | Same as Sales |
| `src/pages/Contacts.tsx` | Add edit/delete buttons, use ContactForm component |
| `src/pages/Products.tsx` | Add edit/delete buttons, use ProductForm component, Urdu name column |
| `src/contexts/LanguageContext.tsx` | New translation keys for payment recording, filters, confirmations |

### Database Changes
- Add UPDATE and DELETE RLS policies to `payments` table (currently missing) so recorded payments can be corrected
- No new tables needed -- the existing `payments` table already has the right structure

### Payment Recording Logic
```text
1. User opens invoice detail (credit/partial)
2. Clicks "Record Payment"
3. Enters amount and date
4. System inserts into payments table
5. System updates invoice: amount_paid += payment, balance_due -= payment
6. If balance_due <= 0, set payment_status = "paid"
7. Invalidate dashboard queries
```

### Implementation Order
1. Invoice detail dialog (read-only view of invoice + line items)
2. Record payment form and logic
3. Contact edit/delete functionality
4. Product edit/delete functionality
5. Invoice list filters (date range + status)
6. Translation keys for all new UI elements

