

## Implement Unified Accounts System — Remaining Changes

### What's already done
- `sub_account` and `account_type` columns exist in DB
- Sidebar already says "Accounts"
- Form already has Account Type and Sub Account fields with autocomplete
- Expenses page already removed from sidebar and routes
- Balance sheet already groups by `account_type` and `sub_account`
- Expense accounts already appear in voucher dropdowns

### What still needs to be done

#### 1. Database Migration
Add `transaction_mode` column to contacts table:
```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS transaction_mode text;
```
Note: `contact_type` is already a text column, so no enum changes needed — "expense" and "employee" values can already be stored.

#### 2. ContactForm.tsx — Add contact_type options for expense/employee + transaction_mode field

- Add "expense" and "employee" as options in the Account Category dropdown (currently uses `account_categories` table via `acCategoryOptions`). Need to check if these are in that table or if they need to be added as system categories. Actually, looking at the form, `acCategory` maps to `account_category` field, not `contact_type`. The user wants `contact_type` to be the "Account Category" with values: customer, supplier, both, broker, bank, expense, employee.

**Wait** — there's a mismatch. Currently the form has TWO separate concepts:
- `contact_type` (customer/supplier/both/broker/bank) — shown as "Transaction Mode" for customer/supplier only
- `account_category` — shown as "Account Category" from dynamic categories table

The user wants `contact_type` to become "Account Category" with all 7 values. This means the `account_category` field from the dynamic categories table would be replaced by `contact_type` serving as the category. Let me re-read the user's request...

The user says: "The contact_type field should now be labelled 'Account Category' in the UI. Its options should be: Customer, Supplier, Both, Broker, Bank, Expense, Employee."

So `contact_type` = "Account Category" with 7 options. The existing `account_category` field from the dynamic categories table becomes secondary/removed from the form.

**Changes to ContactForm.tsx:**
- Replace the current Account Category dropdown (which uses `account_categories` table) with a simple select using `contact_type` values: customer, supplier, both, broker, bank, expense, employee
- Add `transaction_mode` to the `ContactData` interface
- Add Transaction Mode field (Sale/Purchase/Both) visible only when contact_type is customer/supplier/both, saving to `transaction_mode` column
- Reorder: Name → Account Category (contact_type) → Account Type → Sub Account (if expense) → Transaction Mode (if customer/supplier/both) → Opening Balance → rest
- Sub Account visibility: show when `contact_type === "expense"` (not `account_category`)
- Include `transaction_mode` in mutation payload

#### 3. ContactEdit.tsx — Fetch transaction_mode
Add `transaction_mode` to the query result mapping.

#### 4. InvoiceForm.tsx — Filter by transaction_mode
Currently filters contacts by `contact_type` (customer/supplier/both). Add additional filter by `transaction_mode`:
- Sale invoices: include contacts where `transaction_mode` is "sale" or "both" or null
- Purchase invoices: include contacts where `transaction_mode` is "purchase" or "both" or null

Fetch `transaction_mode` in the select query and filter client-side.

#### 5. VoucherNew.tsx — Ensure expense contacts visible
Already working — expense contacts have `account_category` not in ("cash","bank") so they pass the filter. No change needed.

#### 6. LanguageContext.tsx — Add translation keys
Add keys for: `contacts.accountCategory`, `contacts.transactionMode`, transaction mode options, expense/employee labels.

### Files changed
1. **Migration**: Add `transaction_mode` column
2. `src/components/ContactForm.tsx` — Restructure category field, add transaction_mode, reorder
3. `src/pages/ContactEdit.tsx` — Fetch transaction_mode
4. `src/components/InvoiceForm.tsx` — Filter contacts by transaction_mode
5. `src/contexts/LanguageContext.tsx` — New translation keys

### No changes to balance sheet, voucher logic, CR/DR logic, or styling.

