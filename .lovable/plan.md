

## Plan: Show all 149 accounts in every dropdown + remove transaction_mode entirely

### FIX 1 — Remove all category/type filtering from form dropdowns

#### `src/components/InvoiceForm.tsx`
- **Account dropdown query** (lines ~58-82): Remove the JS `.filter()` block entirely. Drop `account_category` and `transaction_mode` from `.select()`. Keep `.order("name")`. Result: every account shows up in both Sale and Purchase invoice forms.
- **Broker dropdown query** (lines ~86-91): Remove `.in("contact_type", ["broker", "both"])`. Now any account can be picked as broker.
- **Sublabel mapping** (lines ~237-252): Simplify — show `c.contact_type` (or empty) since we no longer infer role from category.
- **Remove** the `wantedRole` / `wantedMode` constants that are no longer used.

#### `src/pages/VoucherNew.tsx` (lines ~42-74)
- **Main contacts query**: Remove `.not("account_category", "in", '("cash","bank")')`. All accounts (including cash/bank) become selectable as the voucher's "from/to" account.
- **Bank query** + **Cash query**: Per the user's instruction "Remove ALL... `.eq("account_category", ...)`", remove these `.eq("account_category", "bank")` / `"cash"` filters. These two queries currently feed bank-account and cash-account selectors. After removal both lists will contain every account. **Flagging this**: this changes voucher behavior — the "Bank" and "Cash" sub-selectors will no longer be limited to bank/cash accounts. If you want those two specific selectors to keep their bank/cash scope, say so and I'll keep just those two `.eq` calls. Default per your instruction = remove.

#### `src/pages/VoucherEdit.tsx` (lines ~69-82)
- Same treatment as VoucherNew: remove `.not("account_category"...)` from main contacts query and remove `.eq("account_category", "bank")` from bank query. Same flag as above applies.

#### `src/pages/PaymentVouchers.tsx` & `src/pages/ReceiptVouchers.tsx` (lines ~27-40 in each)
- These are **list pages**, not forms. The two queries here (`bank-contacts` filtered by `account_category = "bank"`, `cash-bank-contacts` filtered by `IN ("cash","bank")`) are used to **resolve display names** for the "paid via" column — e.g. show the cash account's actual name instead of "Cash". They are not dropdowns the user picks from.
- Per the literal instruction "Remove ALL `.eq("account_category", ...)`", I will remove these filters and let the lookup match by id against the full contacts list. Functionally equivalent for display, just fetches more rows. **Flagging**: if you'd rather leave list-page lookups alone (since the user said "every account dropdown in forms"), I can skip these two files. Default = apply removal to be consistent with your instruction.

#### `src/components/RecordPayment.tsx`
- **No change.** This component receives `contactId` via props and never fetches a contacts list. Nothing to remove.

### FIX 2 — Remove `transaction_mode` end-to-end

#### `src/components/ContactForm.tsx`
- Remove the `transaction_mode?: string` field from `ContactData`.
- Remove `transaction_mode: ""` from `emptyForm`.
- Remove `transaction_mode: isCustomerSupplierBoth ? ... : null` from the insert/update payload.
- Delete the entire "Transaction Mode" `<Select>` block (lines ~160-173) including its label.
- Remove the `isCustomerSupplierBoth` constant if it becomes unused.

#### `src/pages/ContactEdit.tsx`
- Remove `transaction_mode: data.transaction_mode || ""` from the mapped contact object (line ~36).

#### `src/pages/ContactNew.tsx`
- No transaction_mode reference found — no change needed.

#### `src/components/InvoiceForm.tsx`
- Already covered in Fix 1: remove `transaction_mode` from `.select()` and from the dropped JS filter.

#### `src/contexts/LanguageContext.tsx`
- Remove translation keys `contacts.transactionMode`, `contacts.sale`, `contacts.purchase` (only used by the removed Transaction Mode select). Keep `contacts.both` because it's still used for `contact_type` "Both" labels elsewhere.

#### `src/integrations/supabase/types.ts`
- **Cannot edit manually** — this file is auto-generated and the project rules forbid editing it. The `transaction_mode` column will remain in the generated types until the column is dropped from the database. To fully remove it from types, we'd need a migration `ALTER TABLE contacts DROP COLUMN transaction_mode`. **Flagging**: do you want me to drop the column? It currently holds data on 147 rows ("both" everywhere per earlier fix). Default plan = leave the column in place, just stop reading/writing it from code. If you confirm, I'll add a migration step to drop it and the types file will refresh automatically.

#### Other files
- Searched the entire codebase — `transaction_mode` only appears in the files listed above. No reports, no Contacts list page, no ContactLedger reference. Nothing else to clean up.

### Out of scope (per your instructions)
- `ContactLedger.tsx` — untouched.
- All report files — untouched.
- No other contact/account fields removed.

### Files changed
1. `src/components/InvoiceForm.tsx`
2. `src/pages/VoucherNew.tsx`
3. `src/pages/VoucherEdit.tsx`
4. `src/pages/PaymentVouchers.tsx`
5. `src/pages/ReceiptVouchers.tsx`
6. `src/components/ContactForm.tsx`
7. `src/pages/ContactEdit.tsx`
8. `src/contexts/LanguageContext.tsx`

### Two decisions to confirm before I proceed
1. **Bank/Cash sub-selectors in vouchers**: keep their `account_category` scoping (recommended — they have a specific job), or strip per the literal instruction?
2. **Drop the `transaction_mode` DB column** with a migration so it disappears from generated types, or leave it dormant in the database?

