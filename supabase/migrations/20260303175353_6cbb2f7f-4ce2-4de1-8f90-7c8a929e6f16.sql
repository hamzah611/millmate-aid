
-- Create batches table for tracking raw material/product batches
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.contacts(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  remaining_qty NUMERIC NOT NULL DEFAULT 0,
  manufacture_date DATE,
  expiry_date DATE,
  quality_notes TEXT,
  source_invoice_id UUID REFERENCES public.invoices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view batches"
  ON public.batches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert batches"
  ON public.batches FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update batches"
  ON public.batches FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Owners can delete batches"
  ON public.batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Trigger for updated_at
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
