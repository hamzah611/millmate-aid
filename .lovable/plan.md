

## Plan: Align Accounts page labels & filters with the ContactForm naming

The ContactForm and the Accounts list use different names for the same fields. The form is the source of truth (matches the memory: "UI uses 'Accounts'" / unified accounts system). Update the list page to match.

### Naming map (current → corrected)

| DB field | Form label | Accounts list (current) | Accounts list (after fix) |
|---|---|---|---|
| `contact_type` | Account Category | **Type** column + "Filter by Type" | **Account Category** column + "Filter by Account Category" |
| `account_type` | Account Type | (not shown) | **Account Type** column + "Filter by Account Type" |
| `account_category` (legacy enum) | (hidden) | "Account Category" column + filter | **Removed** (legacy, hidden in form, no longer surfaced) |

### Changes in `src/pages/Contacts.tsx`

1. **Table header** (lines 276-283):
   - Rename `{t("contacts.type")}` → `{t("contacts.accountCategory")}` (the column already shows `c.contact_type`).
   - Replace the legacy `{t("accountCategory.label")}` column with **"Account Type"** showing `c.account_type` (free text). Use the new `t("contacts.accountType")` key.

2. **Table body** (lines 295-301):
   - The dot-color + label cell stays as-is (already renders `c.contact_type` via `getTypeLabel`) — only the header label changes.
   - Replace the `getAccountCategoryLabel(c.account_category, …)` cell with `c.account_type || "—"`.

3. **Filters** (lines 229-269):
   - Rename "Filter by Type" label & placeholder → "Filter by Account Category" (new key `contacts.filterByAccountCategory`). Filter logic unchanged (still filters by `contact_type`).
   - Replace the existing "Account Category" filter (which uses `account_category` + `matchesAccountCategory`) with a **"Filter by Account Type"** dropdown driven by the distinct `account_type` values in `contacts`. Add `acTypeFilter` state, populate options from `useMemo` over contacts, and add it to the `filtered` predicate. Remove `acCategoryFilter`, `matchesAccountCategory`, and `getContactAccountCategoryFilterOptions` usage.

4. **CSV export** (lines 176-180): change the last column header from `"Account Category"` to `"Account Type"` and export `c.account_type || ""` instead of `getAccountCategoryLabel(...)`.

5. **Imports** (line 15): drop `getContactAccountCategoryFilterOptions`, `getAccountCategoryLabel`, `matchesAccountCategory`, `fetchAccountCategories`. Drop the `dynamicCategories` query (lines 127-130) and `language` from `useLanguage` if unused after.

### Changes in `src/contexts/LanguageContext.tsx`

Add two keys (and confirm `contacts.accountType` exists; if not, add):
- `contacts.filterByAccountCategory` → en: "Filter by Account Category", ur: "اکاؤنٹ کیٹیگری کے مطابق فلٹر"
- `contacts.filterByAccountType` → en: "Filter by Account Type", ur: "اکاؤنٹ ٹائپ کے مطابق فلٹر"
- `contacts.accountType` → en: "Account Type", ur: "اکاؤنٹ ٹائپ" (skip if already present)

Leave `contacts.type` and `accountCategory.label` keys in place (still used elsewhere in the codebase — Balance Sheet, vouchers, etc.).

### Out of scope
- `ContactForm.tsx`, `ContactNew.tsx`, `ContactEdit.tsx` — already correctly labeled, no change.
- `ContactLedger.tsx` — untouched (per prior memory rule).
- Balance Sheet, vouchers, invoices — they use `account_category` for grouping logic and stay as-is.
- DB schema — no migration; legacy `account_category` column remains in the DB, just no longer surfaced on the Accounts list.

### Files changed
1. `src/pages/Contacts.tsx`
2. `src/contexts/LanguageContext.tsx`

