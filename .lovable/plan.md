

## Redesign Contacts into Accounts Page

This is a significant structural change touching the database, forms, sidebar, routing, balance sheet, and voucher system. Here is the full implementation plan.

---

### Database Migration

Add two new nullable text columns to the `contacts` table:
```sql
ALTER TABLE public.contacts ADD COLUMN sub_account text;
ALTER TABLE public.contacts ADD COLUMN account_type text;
```

No other schema changes needed. The existing `contact_type` field is kept as-is in the database (values: customer, supplier, both, broker, bank) but relabeled as "Transaction Mode" in the UI for customer/supplier categories only.

---

### 1. Rename "Contacts" to "Accounts" across the app

**Files affected:**
- `src/contexts/LanguageContext.tsx` — Change `nav.contacts` to `"Accounts"` / `"اکاؤنٹس"`, update `contacts.title`, `contacts.add` labels
- `src/components/AppSidebar.tsx` — `nav.contacts` label already uses `t()`, no code change needed beyond translations
- `src/pages/Contacts.tsx` — Update page title/subtitle text, icon stays `Users`
- `src/pages/ContactNew.tsx`, `ContactEdit.tsx`, `ContactLedger.tsx` — Update breadcrumb labels to say "Accounts"

Routes remain `/contacts/*` to avoid breaking bookmarks — only display labels change.

---

### 2. Add "Sub Account" field (expense-only, autocomplete)

**File: `src/components/ContactForm.tsx`**
- Add `sub_account` to `ContactData` interface and `emptyForm`
- Add a query to fetch distinct `sub_account` values from contacts table: `SELECT DISTINCT sub_account FROM contacts WHERE sub_account IS NOT NULL`
- Render a text input with a datalist for autocomplete suggestions, conditionally visible only when `acCategory === "expense"`
- Include `sub_account` in the mutation payload

**File: `src/pages/ContactEdit.tsx`**
- Include `sub_account` in the query result mapping

---

### 3. Add "Account Type" field (all categories, autocomplete, display-only grouping)

**File: `src/components/ContactForm.tsx`**
- Add `account_type` to `ContactData` interface and `emptyForm`
- Query distinct `account_type` values for autocomplete
- Render a text input with datalist, visible for all categories, placed after Account Category
- Include `account_type` in the mutation payload

**File: `src/pages/ContactEdit.tsx`**
- Include `account_type` in the query result mapping

---

### 4. Rename "Contact Type" to "Transaction Mode" in UI

**File: `src/components/ContactForm.tsx`**
- Only show the contact_type / "Transaction Mode" field when `acCategory` is `customer` or `supplier`
- Relabel it "Transaction Mode" (add translation key)
- Keep values as-is in DB (`customer`→Sale, `supplier`→Purchase, `both`→Both) — just change display labels

**File: `src/contexts/LanguageContext.tsx`**
- Add `"contacts.transactionMode"` translation
- Add `"contacts.sale"`, `"contacts.purchase"` if not present

---

### 5. Form field order

Reorder fields in `ContactForm.tsx`:
1. Account Name
2. Account Category
3. Account Type (all categories, optional, free text with suggestions)
4. Sub Account (only if expense)
5. Transaction Mode (only if customer/supplier)
6. Opening Balance
7. Opening Balance Date
8. Phone, City, Address, Credit Limit, Payment Terms

---

### 6. Remove Expenses page from navigation

**File: `src/components/AppSidebar.tsx`**
- Remove the expenses nav item from `navItems` array

**File: `src/App.tsx`**
- Keep the expense routes but comment them out or remove them (keep imports for now to avoid breaking anything). Actually, remove the routes and imports for Expenses, ExpenseNew, ExpenseEdit.

**No data is deleted** — the expenses table stays intact.

---

### 7. Expense accounts in voucher dropdowns

**File: `src/pages/VoucherNew.tsx`**
- Modify the contacts query to also include contacts where `account_category = 'expense'` (currently excluded by the `NOT IN ("cash","bank")` filter — expense accounts are already included since they don't have category "cash" or "bank"). Verify this is already working.

**File: `src/pages/VoucherEdit.tsx`**
- Same verification/fix if needed.

---

### 8. Balance sheet grouping by `account_type`

**File: `src/components/reports/BalanceSheetProfessional.tsx`**

For each section (Customers, Suppliers, Banks, Employees):
- Fetch `account_type` along with the contact data
- Group accounts by `account_type` value
- Render each group with a subheading and subtotal
- Accounts with no `account_type` appear ungrouped at the bottom

For expense accounts specifically, also group by `sub_account` value within the P&L/expenses section (if expenses are shown there). Currently expenses are calculated from the `expenses` table, not from contacts. Since the user wants expense accounts to work through vouchers now, the balance sheet expense section will need to query contacts with `account_category = 'expense'` and calculate their balances from vouchers, grouped by `sub_account`.

**New expense section in balance sheet:**
- Query contacts where `account_category = 'expense'`
- For each, sum payment vouchers (debit to expense = expense incurred) and receipt vouchers
- Group by `sub_account`, show subtotals per group
- This replaces or supplements the current `expenses` table query for P&L

---

### 9. Contacts list page updates

**File: `src/pages/Contacts.tsx`**
- Add `account_type` and `sub_account` columns to the table (or at least show account_type)
- Update export CSV headers

---

### Summary of files changed

1. **Migration**: Add `sub_account` and `account_type` columns to `contacts`
2. `src/contexts/LanguageContext.tsx` — New translation keys
3. `src/components/ContactForm.tsx` — New fields, reordered layout, conditional visibility
4. `src/pages/Contacts.tsx` — Rename labels, add columns
5. `src/pages/ContactNew.tsx` — Label updates
6. `src/pages/ContactEdit.tsx` — Fetch new fields, label updates
7. `src/pages/ContactLedger.tsx` — Label updates
8. `src/components/AppSidebar.tsx` — Remove expenses nav item
9. `src/App.tsx` — Remove expense routes
10. `src/pages/VoucherNew.tsx` — Ensure expense accounts appear in dropdown
11. `src/pages/VoucherEdit.tsx` — Same
12. `src/components/reports/BalanceSheetProfessional.tsx` — Group by `account_type` in all sections, group expenses by `sub_account`

