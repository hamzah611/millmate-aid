

## Fix Vouchers Display in Contact Profile

### Problems Identified

1. **Missing notes**: The `LedgerEntry` type in `ContactLedger.tsx` has no `notes` field. Voucher notes are never displayed in the payment history table.

2. **No clickability**: Voucher rows in the payment history table have no click handler or detail dialog. Users cannot view voucher details.

3. **Amount Paid not reflecting direct vouchers in outstanding**: The `totalOutstanding` calculation (line 95) only sums invoice `balance_due` values. Direct (standalone) vouchers reduce the contact's balance but are not subtracted from outstanding.

4. **Payment method not shown**: The payment history table lacks a "Method" column, so users cannot see if a voucher was cash or bank.

### Changes

**File: `src/pages/ContactLedger.tsx`**

1. **Add `notes`, `paymentMethod`, and `id` to `LedgerEntry` type** — capture notes, method, and ID from each payment record when building ledger entries.

2. **Add columns to the Payment & Voucher History table**: add Method and Notes columns. Notes shown in full (not truncated) with a tooltip or wrapped text.

3. **Make voucher rows clickable** — add a detail dialog (similar to invoice detail pattern) that opens on row click, showing: date, voucher number, type, amount, payment method, bank name, and notes.

4. **Fix `totalOutstanding` calculation** — subtract direct voucher amounts from outstanding:
   ```
   totalOutstanding = invoiceBalanceDue + max(openingBalance, 0) - directVoucherTotal
   ```
   This ensures standalone vouchers reduce the displayed balance.

5. **Add `totalPaid` to include both invoice-linked and direct vouchers** (already correct on line 94, just confirming).

**File: `src/contexts/LanguageContext.tsx`**
- Add translation key `voucher.details` for the detail dialog title.

No other files modified. No changes to voucher creation, deletion, or dashboard logic.

