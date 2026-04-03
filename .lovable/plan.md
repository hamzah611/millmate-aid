## Dynamic Contact Types + Full Integration

### Problem
`contact_type` is a PostgreSQL enum (`customer | supplier | both | broker | bank`) — cannot add new values dynamically. We need a `contact_types` table and change the column to `text`.

---

### Database Migration

```sql
-- 1. Create contact_types lookup table
CREATE TABLE public.contact_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_ur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contact_types" ON public.contact_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contact_types" ON public.contact_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can delete contact_types" ON public.contact_types FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 2. Seed with existing enum values
INSERT INTO public.contact_types (name, name_ur) VALUES
  ('customer', 'گاہک'),
  ('supplier', 'فراہم کنندہ'),
  ('both', 'دونوں'),
  ('broker', 'دلال'),
  ('bank', 'بینک');

-- 3. Change column from enum to text
ALTER TABLE public.contacts ALTER COLUMN contact_type DROP DEFAULT;
ALTER TABLE public.contacts ALTER COLUMN contact_type TYPE text USING contact_type::text;
ALTER TABLE public.contacts ALTER COLUMN contact_type SET DEFAULT 'customer';
```

Note: We do NOT drop the enum type (it may be referenced by Supabase types). The column just becomes `text`.

---

### File Changes

#### 1. `src/components/ContactForm.tsx`
- Remove hardcoded `ContactType` union type; use `string`
- Fetch `contact_types` table via `useQuery` to populate the dropdown
- Add an "Add New Type" option at the bottom of the dropdown that shows an inline input + save button (or a small dialog)
- On adding a new type: insert into `contact_types`, invalidate query, auto-select it
- Default type remains `"customer"`

#### 2. `src/pages/Contacts.tsx`
- Replace hardcoded type filter options with a query to `contact_types`
- The filter dropdown dynamically lists all types from the table
- Type badge color: keep existing colors for known types (`customer`, `supplier`, `bank`, `broker`), use a neutral color for custom types
- Translation: for built-in types use `t("contacts.{type}")`, for custom types use the `name` directly (or `name_ur` based on language)

#### 3. `src/components/InvoiceForm.tsx`
- No change to query logic — it already filters by `contact_type` values `["customer","both"]` and `["supplier","both"]`
- These are fixed business rules (sales need customers, purchases need suppliers) — new custom types won't appear in invoice forms unless they're "customer" or "supplier" category. This is correct behavior.

#### 4. `src/pages/VoucherNew.tsx`
- No change needed — already filters by `account_category` exclusion, not by `contact_type`

#### 5. `src/pages/ReceiptVouchers.tsx` / `src/pages/PaymentVouchers.tsx`
- No change needed — display logic doesn't filter by contact_type

#### 6. Dashboard / Balance Sheet / Reports
- **No changes needed** — all financial calculations use `account_category` (cash, bank, customer, supplier, employee, closing), not `contact_type`. New contact types automatically work because the user assigns an `account_category` to each contact independently.

#### 7. `src/contexts/LanguageContext.tsx`
- Add keys: `contacts.addNewType`, `contacts.newTypeName`, `contacts.typeCreated`
- Keep existing translation keys for built-in types

#### 8. `src/pages/ContactLedger.tsx`
- Display `contact_type` as-is (already does this). For built-in types, use translation; for custom, use raw name. Add a small helper function `getContactTypeLabel(type, t, language)`.

---

### What Will NOT Change
- `financial-utils.ts` — untouched
- Dashboard calculations — use `account_category`, not `contact_type`
- Balance Sheet formulas
- Invoice logic (still filters to customer/supplier/both)
- Voucher logic
- Opening balances
- Existing data (migration preserves all values)

---

### Type Safety
- `ContactType` in `ContactForm.tsx` becomes `string` since types are now dynamic
- Supabase types will auto-update after migration (column becomes `text`)
- All comparisons to known types (`=== "customer"`) remain valid since those values still exist

### How "Add New Type" Works in the Form
- The contact_type Select dropdown shows all types from the `contact_types` table
- Last option is a special "＋ Add New Type" item
- Clicking it reveals an inline Input below the Select for entering the new type name
- On save: inserts into `contact_types`, invalidates the query, and selects the new type
- The new type is immediately available across all contact forms and filters
