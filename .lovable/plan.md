

## Add Transfer Transaction Type

### Approach

Insert two real payment/receipt records per transfer (no schema changes needed). The existing `calculateCashInHand()` and `calculateBankBalances()` will automatically handle transfer records since they read from the payments table by `payment_method` + `voucher_type`.

To identify paired transfer records, use a notes convention: prefix notes with `[TRANSFER]` and include a shared transfer ID so they can be matched on list pages.

### CHANGE 1 — VoucherNew.tsx: Add "transfer" option

**New state variables:**
- `fromAccountId`, `toAccountId` (for transfer mode)

**New query:** Fetch cash + bank contacts (`account_category IN ('cash','bank')`) with their `account_category` field.

**UI changes when `voucherType === "transfer"`:**
- Hide contact, invoice, payment method, and bank contact fields
- Show "From" dropdown (cash + bank contacts)
- Show "To" dropdown (same list, filtered to exclude selected "From")
- Keep amount, date, notes fields

**Save logic for transfer:**
- Validate: amount > 0, fromAccountId set, toAccountId set, from ≠ to
- Get a voucher number via `next_voucher_number("payment")` → use as base
- Determine `payment_method` for each side based on account_category of from/to contact
- Insert record A (payment from source): `voucher_type: "payment"`, `contact_id: null`, `payment_method` based on from account type, `bank_contact_id` = from account id if bank, `voucher_number: base + "-A"`, notes prefixed with `[TRANSFER] `
- Insert record B (receipt to destination): `voucher_type: "receipt"`, `contact_id: null`, `payment_method` based on to account type, `bank_contact_id` = to account id if bank, `voucher_number: base + "-B"`, same notes
- Navigate to payment vouchers after save

### CHANGE 2 — PaymentVouchers.tsx & ReceiptVouchers.tsx: Show transfers tab

Add a Tabs component (Vouchers | Transfers) to both pages.

**Vouchers tab:** Existing table, unchanged. Filter out transfer records by adding `.not("notes", "like", "[TRANSFER]%")` or better: filter client-side where `voucher_number` doesn't end in `-A` or `-B`.

Actually simpler: use `voucher_number` suffix to detect. Transfer payment records end in `-A`, receipt records in `-B`.

**Transfers tab:**
- Query payments where `voucher_number` ends in `-A` (for payment page) or `-B` (for receipt page) — actually query ALL transfer pairs.
- Better approach: On PaymentVouchers, query payments where voucher_number like `%-A` to get the "from" side. For each, derive the paired voucher number (`-B`) and look up the "to" side.
- Simpler: Query all payments where voucher_number like `%-A` OR `%-B`, group by base number, display as: Date | From | To | Amount | Notes.
- Show in a separate table with columns: Date | Voucher # | From | To | Amount | Notes

**Implementation:** On both pages, add a single "Transfers" tab that queries all transfer pairs. Fetch from payments where notes starts with `[TRANSFER]`, group pairs by base voucher number.

### CHANGE 3 — No changes to financial-utils.ts

The two payment records (one payment, one receipt) will be picked up by existing cash/bank calculation logic automatically.

### Files changed

| File | Changes |
|---|---|
| `src/pages/VoucherNew.tsx` | Add transfer type, from/to dropdowns, dual-insert save logic |
| `src/pages/PaymentVouchers.tsx` | Add Tabs (Vouchers / Transfers), filter out transfers from main list, add transfers table |
| `src/pages/ReceiptVouchers.tsx` | Same tabs pattern as PaymentVouchers |

No database changes needed.

