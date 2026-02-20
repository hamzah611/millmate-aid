
-- Add UPDATE policy for payments
CREATE POLICY "Authenticated can update payments"
ON public.payments
FOR UPDATE
USING (true);

-- Add DELETE policy for payments (owner only)
CREATE POLICY "Owners can delete payments"
ON public.payments
FOR DELETE
USING (has_role(auth.uid(), 'owner'::app_role));
