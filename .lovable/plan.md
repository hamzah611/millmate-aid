

# Next Phase: Sales Invoice Creation + Live Dashboard

Now that the foundation is in place (auth, layout, contacts, products listing), this phase focuses on making the app **functional** by building the full invoice creation workflow and connecting the dashboard to real data.

---

## What will be built

### 1. Sales Invoice Creation Form
A full-featured invoice creation dialog/page accessible from the Sales page:

- **Customer selection** dropdown (filtered to customers/both contacts)
- **Add line items**: select product, choose unit, enter quantity, set price per unit (pre-filled from default price)
- **Auto-conversion**: if the user enters quantity in KG but the product is priced per MUN (40 KG), the system calculates correctly
- **Subtotal** calculated automatically from line items
- **Discount** field (flat amount in PKR)
- **Transport charges** field
- **Total** = Subtotal - Discount + Transport
- **Payment section**: choose Cash / Credit / Partial, enter amount paid
- **Balance due** calculated automatically
- **Auto-generated invoice number** (e.g., SAL-0001)
- **Stock reduction**: on save, stock_qty for each product is reduced by the sold quantity (converted to base KG)
- **Price history**: if the entered price differs from the product's default, a record is saved to the price_history table
- Bilingual labels throughout

### 2. Purchase Invoice Creation Form
Same structure as Sales but for purchases:

- **Supplier selection** (filtered to suppliers/both)
- Same line items, pricing, and payment workflow
- **Stock increase** on save instead of decrease
- Auto-generated purchase invoice number (e.g., PUR-0001)

### 3. Live Dashboard
Connect the dashboard cards to real database queries:

- **Today's Sales**: sum of totals from today's sale invoices
- **Today's Purchases**: sum of totals from today's purchase invoices
- **Total Cash**: total amount_paid across all invoices
- **Total Receivables**: sum of balance_due on sale invoices
- **Total Payables**: sum of balance_due on purchase invoices
- **Low Stock Alerts**: list products where stock_qty is at or below min_stock_level
- **Overdue Invoices**: count of credit/partial invoices past their contact's payment terms

### 4. Production/Conversion Module
Build the form for converting raw materials to subproducts:

- Select source product (e.g., Wheat)
- Enter source quantity (e.g., 1000 KG)
- Add output products with quantities (e.g., 800 KG Atta + 200 KG Chhil)
- On save: reduce source product stock, increase output product stocks
- Production history list showing past conversions

---

## Technical Details

### New/Modified Files

| File | Action |
|------|--------|
| `src/components/InvoiceForm.tsx` | New - shared invoice creation form component |
| `src/components/InvoiceItemRow.tsx` | New - single line item row with product/unit/qty/price |
| `src/pages/Sales.tsx` | Modified - add "Create Invoice" dialog using InvoiceForm |
| `src/pages/Purchases.tsx` | Modified - add "Create Invoice" dialog using InvoiceForm |
| `src/pages/Index.tsx` | Modified - replace static "0" values with live database queries |
| `src/pages/Production.tsx` | Modified - add production conversion form and history list |
| `src/contexts/LanguageContext.tsx` | Modified - add new translation keys for invoice form fields |

### Invoice Number Generation
- Query the latest invoice of the same type and increment: `SAL-0001`, `SAL-0002`, etc.
- Purchase invoices: `PUR-0001`, `PUR-0002`, etc.

### Stock Updates
- On sale invoice save: for each line item, reduce the product's `stock_qty` by `quantity * unit.kg_value` (converted to base unit)
- On purchase invoice save: increase `stock_qty` similarly
- On production save: reduce source, increase outputs

### No Database Changes Needed
All required tables, columns, and RLS policies are already in place from Phase 1 setup.

---

## Implementation Order

1. **Invoice form component** (shared between Sales and Purchases)
2. **Sales page** integration with the form
3. **Purchases page** integration
4. **Dashboard** live data queries
5. **Production module** form and history

Each step will be done one at a time to keep changes manageable and testable.

