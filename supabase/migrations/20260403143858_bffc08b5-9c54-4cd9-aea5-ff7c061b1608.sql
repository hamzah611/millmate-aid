
CREATE TABLE public.account_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  label_ur text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view account_categories" ON public.account_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert account_categories" ON public.account_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update account_categories" ON public.account_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete account_categories" ON public.account_categories FOR DELETE TO authenticated USING (true);

INSERT INTO public.account_categories (name, label, is_system) VALUES
  ('cash', 'Cash', true),
  ('bank', 'Bank', true),
  ('closing', 'Closing', true),
  ('customer', 'Customer', true),
  ('supplier', 'Supplier', true),
  ('employee', 'Employee', true),
  ('sales_income', 'Sales Income', true),
  ('purchase', 'Purchase', true),
  ('direct_expense', 'Direct Expense', true);
