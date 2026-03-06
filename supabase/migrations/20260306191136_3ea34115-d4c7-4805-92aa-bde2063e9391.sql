-- inventory_adjustments table
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number text NOT NULL,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES batches(id),
  adjustment_type text NOT NULL,
  quantity_kg numeric NOT NULL,
  reason text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert adjustments" ON public.inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update adjustments" ON public.inventory_adjustments FOR UPDATE TO authenticated USING (true);

-- expense_categories table
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ur text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage expense_categories" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.expense_categories (name, name_ur) VALUES
  ('Electricity', 'بجلی'),
  ('Labor', 'مزدوری'),
  ('Transport', 'ٹرانسپورٹ'),
  ('Maintenance', 'مرمت'),
  ('Packaging', 'پیکنگ'),
  ('Rent', 'کرایہ'),
  ('Miscellaneous', 'متفرق');

-- expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES expense_categories(id),
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);