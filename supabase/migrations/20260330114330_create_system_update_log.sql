CREATE TABLE IF NOT EXISTS public.system_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  version TEXT,
  update_type TEXT NOT NULL DEFAULT 'melhoria',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT system_update_log_update_type_check
    CHECK (update_type IN ('nova_funcionalidade', 'melhoria', 'correcao', 'comunicado'))
);

ALTER TABLE public.system_update_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System update log visible to super admins"
ON public.system_update_log
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "System update log managed by super admins"
ON public.system_update_log
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
