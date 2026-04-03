
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

-- 2. Seed with existing enum values
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
