
## Dynamic Contact Types + Full Integration

### Problem
`contact_type` is a PostgreSQL enum (`customer | supplier | both | broker | bank`) — cannot add new values dynamically. We need a `contact_types` lookup table and change the column to `text`.

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

CREATE POLICY "Authenticated can view contact_types" ON public.contact_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contact_types" ON public.contact_types
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can delete contact_types" ON public.contact_types
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 2. Seed with existing enum values (with Urdu translations)
INSERT INTO public.contact_types (name, name_ur) VALUES
  ('customer', 'گاہک'),
  ('supplier', 'فراہم کنندہ'),
  ('both', 'دونوں'),
  ('broker', 'دلال'),
  ('bank', 'بینک');

-- 3. Change contacts.contact_type from enum to text
ALTER TABLE public.contacts ALTER COLUMN contact_type DROP DEFAULT;
ALTER TABLE public.contacts ALTER COLUMN contact_type TYPE text USING contact_type::text;
ALTER TABLE public.contacts ALTER COLUMN contact_type SET DEFAULT 'customer';
```

---

### File Changes

#### 1. `src/components/ContactForm.tsx`
- Remove hardcoded `ContactType` union; use `string`
- Fetch types from `contact_types` table via `useQuery`
- Add "＋ Add New Type" option at the bottom of the Select dropdown
- Clicking it shows an inline Input + Save button below the Select
- On save: insert into `contact_types`, invalidate query, auto-select it
- Default type remains `"customer"`

#### 2. `src/pages/Contacts.tsx`
- Replace hardcoded type filter options with a query to `contact_types`
- Type badge color: keep existing colors for known types (`customer`, `supplier`, `bank`, `broker`), neutral color for custom types
- For display: use `t("contacts.{type}")` for built-in types, raw `name` (or `name_ur` if Urdu) for custom types

#### 3. `src/contexts/LanguageContext.tsx`
- Add keys: `contacts.addNewType`, `contacts.newTypeName`, `contacts.typeCreated`

---

### What Will NOT Change
- `financial-utils.ts` — untouched
- Dashboard/Balance Sheet calculations — all use `account_category`, not `contact_type`
- Invoice logic (still filters to `customer/supplier/both`)
- Voucher logic — filters by `account_category` exclusion
- Opening balances, existing data (migration preserves all values)
- Voucher pages, ledger pages — no changes needed

### Why This Is Safe
All financial logic (Cash, Bank, Receivables, Payables, Balance Sheet) routes through `account_category`, which is independent of `contact_type`. Adding new contact types has zero impact on calculations. Users assign an `account_category` to each contact regardless of its type.
