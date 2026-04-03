

## Add Dynamic Account Categories to Expense Forms

### Summary
Both `ExpenseNew.tsx` and `ExpenseEdit.tsx` already have the Account Category dropdown, but they call `getExpenseAccountCategoryFormOptions(t)` without passing dynamic categories from the DB. They also lack an "Add new" option to create account categories inline — unlike the Contact form which already has this.

### Changes

**Files: `src/pages/ExpenseNew.tsx` and `src/pages/ExpenseEdit.tsx`** (same change in both)

1. Import `fetchAccountCategories` and `DynamicAccountCategory` from `@/lib/account-categories`
2. Add a `useQuery` to fetch dynamic account categories:
   ```ts
   const { data: dynamicAccountCategories } = useQuery({
     queryKey: ["account-categories"],
     queryFn: fetchAccountCategories,
   });
   ```
3. Pass dynamic categories to the options call:
   ```ts
   getExpenseAccountCategoryFormOptions(t, dynamicAccountCategories, language)
   ```
4. Add "Add new account category" inline creation (same `__add_new_ac__` sentinel pattern used in ContactForm):
   - New state: `addingAcCategory`, `newAcCategoryName`
   - Mutation to insert into `account_categories` table with `is_system: false`
   - When adding, show inline input + Save/Cancel buttons instead of dropdown
   - On success, set `accountCategory` to the new category's `name` and invalidate query

No database changes needed — the `account_categories` table already exists with proper RLS.

