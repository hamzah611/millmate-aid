

## Enhance Contact Ledger Detail Views

### Current State
Both invoice rows and voucher rows are already clickable and open Dialog modals. However, the **Invoice Detail Dialog** is missing key information:
- No line items (products, quantities, prices)
- No subtotal / discount / transport breakdown
- No invoice type (sale vs purchase)
- No business unit

The **Voucher Detail Dialog** is already fairly complete.

### Changes

**File: `src/pages/ContactLedger.tsx`**

1. **Fetch invoice items when an invoice is selected** — add a query for `invoice_items` joined with `products` and `units` when `selectedInvoice` changes, so the dialog can show the full line-item breakdown.

2. **Enhance the Invoice Detail Dialog** to show:
   - Invoice type (Sale / Purchase)
   - Business unit (if set)
   - Line items table: Product name, Quantity, Price per unit, Line total
   - Subtotal, Discount, Transport charges, Grand total
   - Amount paid, Balance due, Status
   - Notes (already shown)

3. **Add invoice items query** — a secondary query keyed on `selectedInvoice?.id` that fetches from `invoice_items` with product name and unit info.

4. **Visual improvements** — use a slightly wider dialog (`sm:max-w-lg`) for invoices to accommodate the items table, and add a `Separator` between the header info and line items.

No database changes. No changes to voucher dialog (already complete). No changes to other pages.

