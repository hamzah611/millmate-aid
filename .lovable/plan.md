

## Account Category Classification — Implementation Plan

### Overview
Add optional `account_category` text column to `contacts` and `expenses`. Wire into forms, list pages, filters, and CSV exports. Follow the exact same `___unassigned___` / null pattern used by Business Units for full consistency.

### 1. Database Migration
```sql
ALTER TABLE public.contacts ADD COLUMN account_category text DEFAULT NULL;
ALTER TABLE public.expenses ADD COLUMN account_category text DEFAULT NULL;
```

### 2. New File: `src/lib/account-categories.ts`
Following `business-units.ts` pattern exactly:
- `ACCOUNT_CATEGORY_UNASSIGNED = "___unassigned___"` — sentinel value for forms
- `ACCOUNT_CATEGORIES` — full list of 9 categories with `value` + `labelKey`
- `CONTACT_ACCOUNT_CATEGORIES` — subset: customer, supplier, employee, closing
- `EXPENSE_ACCOUNT_CATEGORIES` — subset: direct_expense, employee, bank, cash
- `getContactAccountCategoryFormOptions(t)` — unassigned + contact-relevant options
- `getExpenseAccountCategoryFormOptions(t)` — unassigned + expense-relevant options
- `getContactAccountCategoryFilterOptions(t)` — all + contact options + unassigned
- `getExpenseAccountCategoryFilterOptions(t)` — all + expense options + unassigned
- `getAccountCategoryLabel(value, t)` — null/undefined → "Unassigned"
- `matchesAccountCategory(recordValue, filterValue)` — same logic as `matchesBusinessUnit`

**Null handling pattern (consistent everywhere):**
- Forms: use `"___unassigned___"` sentinel, convert to `null` on save
- Edit forms: init from DB value, `null` → `"___unassigned___"`
- Filters: `"unassigned"` filter matches `null`/`undefined` records
- CSV: `null` → `"Unassigned"` label
- Display: `null` → translated "Unassigned" label

### 3. Translations in `LanguageContext.tsx`
Add 11 keys: `accountCategory.label`, `.cash`, `.bank`, `.closing`, `.customer`, `.supplier`, `.employee`, `.salesIncome`, `.purchase`, `.directExpense`, `.unassigned`

### 4. Contacts Module
- **ContactForm.tsx**: Add `account_category` to interface + form state. Add dropdown using `getContactAccountCategoryFormOptions()`. Save: `accountCategory === "___unassigned___" ? null : accountCategory`. Init from existing value on edit.
- **ContactEdit.tsx**: Pass `account_category` from DB to form initial data.
- **Contacts.tsx**: Add `acCategoryFilter` state. Add filter dropdown. Apply `matchesAccountCategory()`. Add column to table. Add to CSV export with `getAccountCategoryLabel()`.

### 5. Expenses Module
- **ExpenseNew.tsx**: Add `accountCategory` state (default `"___unassigned___"`). Add dropdown. Save with null conversion.
- **ExpenseEdit.tsx**: Add `accountCategory` state, init from `expense.account_category || "___unassigned___"`. Add dropdown. Save with null conversion.
- **Expenses.tsx**: Add `acCategoryFilter` state. Add filter dropdown. Apply `matchesAccountCategory()`. Add to CSV export.

### Files Changed

| File | Change |
|------|--------|
| Migration | Add `account_category` to contacts + expenses |
| `src/lib/account-categories.ts` | New: constants + helpers |
| `src/contexts/LanguageContext.tsx` | 11 translation keys |
| `src/components/ContactForm.tsx` | Add dropdown + save |
| `src/pages/ContactEdit.tsx` | Pass field to form |
| `src/pages/Contacts.tsx` | Filter + column + CSV |
| `src/pages/ExpenseNew.tsx` | Add dropdown + save |
| `src/pages/ExpenseEdit.tsx` | Add dropdown + init + save |
| `src/pages/Expenses.tsx` | Filter + CSV |

