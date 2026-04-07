

## Fix Plan: Dashboard Labels + Unified Voucher Ledger + Transfer Extensions

### ISSUE 1 — Dashboard Cash Breakdown Labels

**File: `src/components/dashboard/DashboardBreakdown.tsx`**

The CashBreakdown component (lines 178-192) has labels but they may be unclear. Update to use the exact labels requested:

- Line 181: Change label to "Opening Balance" (already correct, keep)
- Line 182: Change from `t("reports.received") + " (" + t("nav.sales") + ")"` to "Cash Receipts" — add translation key `dashboard.cashReceipts`
- Line 185: Change from `t("reports.paid") + " (" + t("nav.purchases") + ")"` to "Cash Payments" — add translation key `dashboard.cashPayments`  
- Line 186: Change from `t("nav.expenses")` to "Cash Expenses" — add translation key `dashboard.cashExpenses`
- Line 188: Change from `t("dashboard.totalCash")` to "Net Cash in Hand" — add translation key `dashboard.netCashInHand`

**File: `src/contexts/LanguageContext.tsx`** — Add the new translation keys with English and Urdu values.

---

### ISSUE 2 — Unified Voucher Ledger

#### CHANGE 1 — `src/pages/ReceiptVouchers.tsx`

- Remove `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` imports and usage
- Modify the vouchers query to fetch ALL receipt records (regular + transfer -B) sorted by `payment_date` desc. Filter out -A records only.
- Fetch transfer pair info: for each -B record, look up the matching -A record to get source account name
- Add a "Type" column to the table header showing "Receipt" or "Transfer In"
- For transfer rows: show "Transfer: [From] → [To]" in the contact column
- For transfer rows: use `deleteTransferMutation` (look up -A pair) for delete, no edit button
- Keep all existing filters (date, method) and total calculation
- Remove the separate transfers tab content entirely
- Update `colSpan` for loading/empty states

#### CHANGE 2 — `src/pages/PaymentVouchers.tsx`

- Same pattern as ReceiptVouchers: remove Tabs, show single unified table
- Fetch ALL payment records (regular + transfer -A) sorted by `payment_date` desc. Filter out -B records only.
- For each -A transfer record, fetch matching -B to get destination account
- Add "Type" column: "Payment" or "Transfer Out"
- For transfer rows: show "Transfer: [From] → [To]" in contact column
- Transfer rows get delete (atomic pair delete) but no edit button
- Remove separate transfers tab

#### Shared approach for both pages:
- The existing `transfers` query and `getAccountName` helper already exist — repurpose them
- Merge transfer records into the main list, sort by date
- The combined list has a `_rowType` flag: "regular" | "transfer"

---

### ISSUE 3 — Transfer Extensions in VoucherNew.tsx

**File: `src/pages/VoucherNew.tsx`**

- Add "contact" as a third option in both From Type and To Type dropdowns (lines 269-274, 292-301)
- When "contact" is selected, show the existing `contactOptions` (SearchableCombobox with contacts list)
- Update `getFromOptions()` / `getToOptions()` to return `contactOptions` when type is "contact"
- Update save logic (lines 99-138):
  - For record A (source):
    - If `transferFromType === "contact"`: set `contact_id = transferFromId`, `payment_method` = based on other side (bank→"bank", cash/contact→"cash"), `bank_contact_id` = null
    - If `transferFromType === "bank"`: set `payment_method = "bank"`, `bank_contact_id = transferFromId`, `contact_id = null`
    - If `transferFromType === "cash"`: set `payment_method = "cash"`, `bank_contact_id = null`, `contact_id = null`
  - Same logic for record B (destination) but voucher_type = "receipt"
- Update the account name display labels when "contact" is selected

**File: `src/pages/ReceiptVouchers.tsx` and `PaymentVouchers.tsx`**
- Update `getAccountName` to also handle contact-based transfers (where `contact_id` is set on the transfer record) — look up contact name from the contacts query

---

### Files Changed

1. `src/contexts/LanguageContext.tsx` — new translation keys
2. `src/components/dashboard/DashboardBreakdown.tsx` — clearer cash labels
3. `src/pages/ReceiptVouchers.tsx` — remove tabs, unified ledger with Type column
4. `src/pages/PaymentVouchers.tsx` — remove tabs, unified ledger with Type column  
5. `src/pages/VoucherNew.tsx` — add "contact" transfer type option

No database changes needed.

