
-- 1. Add sub-unit support to units table
ALTER TABLE public.units ADD COLUMN sub_unit_id uuid REFERENCES public.units(id);

-- 2. Add 'broker' to contact_type enum
ALTER TYPE public.contact_type ADD VALUE 'broker';

-- 3. Add broker fields to invoices table
ALTER TABLE public.invoices
  ADD COLUMN broker_contact_id uuid REFERENCES public.contacts(id),
  ADD COLUMN broker_commission_rate numeric DEFAULT 0,
  ADD COLUMN broker_commission_unit_id uuid REFERENCES public.units(id),
  ADD COLUMN broker_commission_total numeric DEFAULT 0;
