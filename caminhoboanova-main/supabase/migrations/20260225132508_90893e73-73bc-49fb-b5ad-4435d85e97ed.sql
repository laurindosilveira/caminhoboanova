
-- Create turmas table
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage turmas" ON public.turmas
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view turmas" ON public.turmas
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add turma_id to profiles (nullable - null means "sala de espera")
ALTER TABLE public.profiles ADD COLUMN turma_id uuid REFERENCES public.turmas(id);
