

## Remove Role Restrictions — Allow All Users Full Access

### Problem
Several tables restrict DELETE (and some UPDATE) operations to the Owner role only. The user wants all authenticated users to have equal access.

### Tables Needing Policy Changes

**DELETE policies to change from owner-only → all authenticated:**
1. `contacts` — "Owners can delete contacts"
2. `invoices` — "Owners can delete invoices"
3. `invoice_items` — "Owners can delete invoice_items"
4. `batches` — "Owners can delete batches"
5. `products` — "Owners can delete products"
6. `payments` — "Owners can delete payments"
7. `contact_types` — "Owners can delete contact_types"

**Tables missing DELETE/UPDATE policies entirely (need adding):**
8. `production_outputs` — no UPDATE or DELETE
9. `productions` — no UPDATE or DELETE
10. `price_history` — no UPDATE or DELETE
11. `inventory_adjustments` — no DELETE
12. `contact_types` — no UPDATE

### Single Migration
One SQL migration that:
- Drops all owner-restricted DELETE policies
- Creates new permissive DELETE policies for `authenticated` with `USING (true)`
- Adds missing UPDATE/DELETE policies where absent

### Code Change
- `src/pages/Products.tsx`, `src/pages/Sales.tsx`, `src/pages/Purchases.tsx`, `src/pages/Contacts.tsx`, and any other pages that gate delete buttons behind `userRole === 'owner'` — remove those role checks so delete buttons are visible to everyone.

### Files Modified
1. One database migration (SQL)
2. All page files that conditionally show/hide delete buttons based on role

