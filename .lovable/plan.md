

## Plan: Fix Outstanding Calc + Edit Invoices/Vouchers + Product History

### PRE-FIX — ContactLedger outstanding calculation
**File: `src/pages/ContactLedger.tsx`**
- Replace the current `totalOutstanding` calculation (line ~281) with the exact code provided: split direct vouchers into receipt vs payment totals, then `totalOutstanding = openingBalance + invoiceBalanceDue - receiptVoucherTotal + paymentVoucherTotal`.

---

### ISSUE 1 — Edit Sale & Purchase Invoices

**Approach**: Add an `editInvoiceId` optional prop to `InvoiceForm` so it can work in both create and edit modes. Create new edit pages (`SaleEdit`, `PurchaseEdit`) and add routes + edit buttons.

**File: `src/components/InvoiceForm.tsx`**
- Add optional `editInvoiceId` prop to `Props` interface
- When `editInvoiceId` is set, fetch the existing invoice + its items on mount and pre-fill all state (contactId, date, notes, items, discount, transport, paymentStatus, businessUnit, broker fields)
- In `handleSave`: if editing, update invoice instead of insert, delete old `invoice_items` and re-insert new ones, recalculate `amount_paid` from actual payments linked to this invoice, set `balance_due = total - amount_paid`, determine `payment_status` accordingly. Do NOT delete linked payments. Do NOT generate a new invoice number. Reverse old stock changes and apply new ones.

**File: `src/pages/SaleEdit.tsx`** (new)
- Similar to `SaleNew` but passes `editInvoiceId` from URL params to `InvoiceForm`

**File: `src/pages/PurchaseEdit.tsx`** (new)
- Similar to `PurchaseNew` but passes `editInvoiceId` from URL params

**File: `src/App.tsx`**
- Add routes: `/sales/:id/edit` → `SaleEdit`, `/purchases/:id/edit` → `PurchaseEdit`

**File: `src/components/InvoiceDetail.tsx`**
- Add an Edit button (Pencil icon) next to the WhatsApp/Delete buttons that navigates to the appropriate edit page based on `invoice_type`

**File: `src/pages/Sales.tsx`**
- Add an Edit button (Pencil icon) in each table row that navigates to `/sales/:id/edit` (with `e.stopPropagation()` to prevent opening the detail dialog)

**File: `src/pages/Purchases.tsx`**
- Same as Sales — add Edit button per row navigating to `/purchases/:id/edit`

---

### ISSUE 2 — Edit Receipt & Payment Vouchers

**Approach**: Create a `VoucherEdit` page that reuses the same form layout as `VoucherNew`, pre-filled with existing data. On save, update the payment record and recalculate any affected invoice balances.

**File: `src/pages/VoucherEdit.tsx`** (new)
- Fetch existing payment by ID from URL params
- Pre-fill all fields (voucherType, contactId, invoiceId, amount, paymentMethod, bankContactId, paymentDate, notes)
- On save: track old `invoice_id` and new `invoice_id`. Update the payment record. If old invoice exists, recalculate its `amount_paid`/`balance_due`/`payment_status`. If new invoice exists and is different, recalculate that too.

**File: `src/App.tsx`**
- Add route: `/vouchers/:id/edit` → `VoucherEdit`

**File: `src/pages/ReceiptVouchers.tsx`**
- Add Edit button (Pencil icon) per row navigating to `/vouchers/:id/edit`

**File: `src/pages/PaymentVouchers.tsx`**
- Same — add Edit button per row

---

### ISSUE 3 — Product History Page

**File: `src/pages/ProductHistory.tsx`** (new)
- Fetch product details (name, unit, stock_qty, avg_cost) by ID from URL params
- Fetch all `invoice_items` for this product joined with `invoices` (to get date, invoice_number, invoice_type)
- Build transaction history: for each invoice_item, show Date, Type (Purchase/Sale), Reference (invoice_number), Qty In (if purchase), Qty Out (if sale), Rate (price_per_unit), Total Value
- Sort by date ascending
- Compute running stock balance column (starting from 0 or opening stock, adding purchases, subtracting sales)
- Display product summary cards at top (current stock, avg cost, total purchased, total sold)

**File: `src/App.tsx`**
- Add route: `/products/:id/history` → `ProductHistory`

**File: `src/pages/Products.tsx`**
- Add a "View" button (Eye icon) or make rows clickable to navigate to `/products/:id/history`

---

### Summary of all file changes

| File | Action |
|---|---|
| `src/pages/ContactLedger.tsx` | Fix totalOutstanding calculation |
| `src/components/InvoiceForm.tsx` | Add edit mode with `editInvoiceId` prop |
| `src/pages/SaleEdit.tsx` | New page |
| `src/pages/PurchaseEdit.tsx` | New page |
| `src/pages/VoucherEdit.tsx` | New page |
| `src/pages/ProductHistory.tsx` | New page |
| `src/App.tsx` | Add 4 new routes |
| `src/components/InvoiceDetail.tsx` | Add Edit button |
| `src/pages/Sales.tsx` | Add Edit button per row |
| `src/pages/Purchases.tsx` | Add Edit button per row |
| `src/pages/ReceiptVouchers.tsx` | Add Edit button per row |
| `src/pages/PaymentVouchers.tsx` | Add Edit button per row |
| `src/pages/Products.tsx` | Add View/History button per row |

No database changes needed.

