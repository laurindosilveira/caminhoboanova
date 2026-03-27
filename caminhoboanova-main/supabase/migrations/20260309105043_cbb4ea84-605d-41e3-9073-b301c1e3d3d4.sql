
-- Add confirmation_year to profiles (1 = 1st year, 2 = 2nd year, null = not set)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS confirmation_year smallint DEFAULT NULL;

-- Create table for year promotion requests
CREATE TABLE public.year_promotion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_year smallint NOT NULL DEFAULT 1,
  to_year smallint NOT NULL DEFAULT 2,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente',
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid DEFAULT NULL,
  reviewed_at timestamp with time zone DEFAULT NULL
);

ALTER TABLE public.year_promotion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promotion requests"
ON public.year_promotion_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Liders can manage promotion requests"
ON public.year_promotion_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'lider'::app_role))
WITH CHECK (has_role(auth.uid(), 'lider'::app_role));
