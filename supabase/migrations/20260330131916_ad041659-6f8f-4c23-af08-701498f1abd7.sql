-- Allow all authenticated users to insert categories
CREATE POLICY "Authenticated can insert categories"
ON public.categories FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update categories
CREATE POLICY "Authenticated can update categories"
ON public.categories FOR UPDATE TO authenticated
USING (true);