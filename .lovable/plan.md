

## Show Notes from Invoices and Vouchers in Contact Ledger

### Problem
When a user adds notes to invoices or vouchers, those notes are not visible in the Contact Ledger's Invoice History table. Voucher notes already appear in the Payment & Voucher History table, but invoice notes are missing entirely.

### Changes

**File: `src/pages/ContactLedger.tsx`**

1. **Add a "Notes" column to the Invoice History table** — after the Status column, add a new `TableHead` for Notes and display `inv.notes` in each row (truncated with full text on hover or wrap).

2. **Make invoice rows clickable** — add an Invoice Detail Dialog (similar to the existing Voucher Detail Dialog) that opens when an invoice row is clicked, showing: invoice number, date, type, total, amount paid, balance due, status, and the full notes text.

3. **Add state for selected invoice** — `const [selectedInvoice, setSelectedInvoice] = useState(null)` and a second `Dialog` component for invoice details.

**File: `src/contexts/LanguageContext.tsx`**
- Add translation key `invoice.details` (en: "Invoice Details", ur: "انوائس کی تفصیلات").

### What stays the same
- Voucher notes already display correctly — no changes needed there.
- No changes to financial calculations, dashboard, or any other pages.
- No database changes.

