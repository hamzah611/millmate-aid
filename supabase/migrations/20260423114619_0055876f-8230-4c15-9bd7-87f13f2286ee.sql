ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;