

## Dynamic Account Categories

### Overview
Create a new `account_categories` database table to store categories, seed it with the existing hardcoded ones, and update all helper functions to merge DB-stored categories with the built-in ones. Add an "Add new" option in the Contact Form's account category dropdown.

### Database Migration
Create `account_categories` table:
- `id uuid PK default gen_random_uuid()`
- `name text NOT NULL UNIQUE` (the slug/value, e.g. "cash", "bank", or user-created ones)
- `label text NOT NULL` (display name, e.g. "Cash", "Bank")
- `label_ur text` (optional Urdu label)
- `is_system boolean NOT NULL DEFAULT false` (protects built-in categories from deletion)
- `created_at timestamptz NOT NULL DEFAULT now()`

Seed all 9 existing categories with `is_system = true`. RLS: full access for `authenticated`.

### Changes to `src/lib/account-categories.ts`
- Keep `ACCOUNT_CATEGORIES` as a fallback constant (no removal)
- Add a new async function `fetchAccountCategories()` that queries the `account_categories` table
- Update `getAccountCategoryLabel()` to accept an optional categories array parameter; if a category isn't found in the hardcoded list, check the passed-in dynamic list and fall back to displaying the raw value (never show "unassigned" for a valid custom category)
- Update `getContactAccountCategoryFormOptions()` and `getContactAccountCategoryFilterOptions()` to accept an optional dynamic categories array and append any non-system or extra categories
- Same for expense variants

### Changes to `src/components/ContactForm.tsx`
- Add a `useQuery` for `account_categories` table
- Replace `getContactAccountCategoryFormOptions(t)` call with a version that merges dynamic categories
- Add an "Add new category" option (same pattern as contact types: `__add_new__` sentinel value)
- On selecting it, show an inline input + save button that inserts into `account_categories` and invalidates the query
- New categories get `is_system: false`

### Changes to `src/pages/Contacts.tsx`
- Add `useQuery` for `account_categories`
- Pass dynamic categories to `getContactAccountCategoryFilterOptions` so new categories appear in filters
- Pass dynamic categories to `getAccountCategoryLabel` for display

### Changes to `src/pages/Expenses.tsx`
- Same pattern: fetch dynamic categories, pass to filter/label functions

### Changes to `src/components/reports/FinancialReports.tsx`
- Fetch dynamic categories for the breakdown table's category labels
- Pass to `getAccountCategoryLabel` calls so custom categories display correctly
- Balance sheet: custom categories with contacts will naturally appear via existing DB queries (contacts already store freeform `account_category` text)

### Files Modified
1. New migration SQL (create table + seed)
2. `src/lib/account-categories.ts` — extend helper functions to accept dynamic list
3. `src/components/ContactForm.tsx` — add create-new-category UI
4. `src/pages/Contacts.tsx` — fetch + pass dynamic categories
5. `src/pages/Expenses.tsx` — fetch + pass dynamic categories
6. `src/components/reports/FinancialReports.tsx` — fetch + pass dynamic categories

