

## Add Edit & Delete for All Category Types

### Discovery — 4 category types with inline creation

| Category Type | Table | Create Location(s) |
|---|---|---|
| Product categories | `categories` | `ProductForm.tsx` (Select, no inline create) |
| Expense categories | `expense_categories` | `ExpenseNew.tsx`, `ExpenseEdit.tsx` (inline create via `__add_new__`) |
| Contact types | `contact_types` | `ContactForm.tsx` (inline create via `__add_new__`) |
| Account categories | `account_categories` | `ContactForm.tsx`, `ExpenseNew.tsx`, `ExpenseEdit.tsx` (inline create via `__add_new_ac__`) |

### Approach

Create a reusable `CategoryManager` dialog component. Each category Select gets a small "Manage" (gear/settings) icon button that opens the dialog, showing all items in a list with Edit and Delete buttons.

### New file: `src/components/CategoryManager.tsx`

A generic dialog component accepting:
- `title: string` — dialog title
- `tableName: string` — Supabase table to query/update/delete
- `referenceCheck: { table: string; column: string }` — for delete safety check
- `queryKey: string` — React Query key to invalidate
- `hasUrdu: boolean` — whether the table has `name_ur` column
- `hasLabel: boolean` — for `account_categories` which uses `label` + `name`

Features:
- Lists all items from the table
- **Edit**: Click edit icon → inline input replaces text → Save/Cancel buttons. Updates via `supabase.from(table).update({ name }).eq("id", id)`
- **Delete**: Click delete icon → AlertDialog: "Are you sure?" → Before delete, run `SELECT count(*) FROM referenceTable WHERE column = id`. If count > 0, show error toast "Cannot delete — category is in use." If 0, delete it.
- System categories (`is_system = true` on `account_categories`) get no edit/delete buttons.

### Reference checks for each type

| Category | Reference Table | Reference Column |
|---|---|---|
| `categories` (product) | `products` | `category_id` |
| `expense_categories` | `expenses` | `category_id` |
| `contact_types` | `contacts` | `contact_type` (matched by `name`, not id) |
| `account_categories` | `contacts` | `account_category` (matched by `name`, not id) |

### Integration points — add "Manage" button

Each file gets a small icon button next to the category Select label:

1. **`src/components/ProductForm.tsx`** — next to category Select label, opens CategoryManager for `categories` table
2. **`src/pages/ExpenseNew.tsx`** — next to expense category Select label, opens CategoryManager for `expense_categories`
3. **`src/pages/ExpenseEdit.tsx`** — same as ExpenseNew
4. **`src/components/ContactForm.tsx`** — two places:
   - Next to Contact Type Select → manages `contact_types`
   - Next to Account Category Select → manages `account_categories`

### Files changed

| File | Changes |
|---|---|
| `src/components/CategoryManager.tsx` | **New** — reusable dialog with list, edit, delete |
| `src/components/ProductForm.tsx` | Add Manage button + CategoryManager for product categories |
| `src/pages/ExpenseNew.tsx` | Add Manage button + CategoryManager for expense categories |
| `src/pages/ExpenseEdit.tsx` | Add Manage button + CategoryManager for expense categories |
| `src/components/ContactForm.tsx` | Add Manage buttons for contact types and account categories |

No database changes needed.

