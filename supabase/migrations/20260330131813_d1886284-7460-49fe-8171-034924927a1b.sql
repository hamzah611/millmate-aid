-- Allow all authenticated users to insert units
CREATE POLICY "Authenticated can insert units"
ON public.units FOR INSERT TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to update units
CREATE POLICY "Authenticated can update units"
ON public.units FOR UPDATE TO authenticated
USING (true);