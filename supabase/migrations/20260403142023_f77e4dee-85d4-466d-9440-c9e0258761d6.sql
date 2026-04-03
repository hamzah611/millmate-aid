
-- Drop owner-only DELETE policies
DROP POLICY IF EXISTS "Owners can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "Owners can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners can delete invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Owners can delete batches" ON public.batches;
DROP POLICY IF EXISTS "Owners can delete products" ON public.products;
DROP POLICY IF EXISTS "Owners can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Owners can delete contact_types" ON public.contact_types;

-- Also drop the ALL policies on categories/units that were owner-only
DROP POLICY IF EXISTS "Owners can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Owners can manage units" ON public.units;

-- Create open DELETE policies for all authenticated users
CREATE POLICY "Authenticated can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete invoice_items" ON public.invoice_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete batches" ON public.batches FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete products" ON public.products FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete payments" ON public.payments FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contact_types" ON public.contact_types FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete categories" ON public.categories FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete units" ON public.units FOR DELETE TO authenticated USING (true);

-- Add missing UPDATE/DELETE policies
CREATE POLICY "Authenticated can update production_outputs" ON public.production_outputs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete production_outputs" ON public.production_outputs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can update productions" ON public.productions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete productions" ON public.productions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can update price_history" ON public.price_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete price_history" ON public.price_history FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete inventory_adjustments" ON public.inventory_adjustments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can update contact_types" ON public.contact_types FOR UPDATE TO authenticated USING (true);
