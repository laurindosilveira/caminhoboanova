-- =============================================================================
-- LGPD/SEGURANCA: auditoria de exportacoes de dados
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.data_export_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  export_type TEXT NOT NULL CHECK (export_type IN ('personal_json', 'admin_schema', 'admin_data', 'admin_full')),
  scope TEXT NOT NULL CHECK (scope IN ('self', 'system')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.data_export_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own data export audit" ON public.data_export_audit;
CREATE POLICY "Users can insert own data export audit"
ON public.data_export_audit FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own data export audit" ON public.data_export_audit;
CREATE POLICY "Users can view own data export audit"
ON public.data_export_audit FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_authorized_system_admin()
);

CREATE INDEX IF NOT EXISTS idx_data_export_audit_user_created
ON public.data_export_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_export_audit_type_created
ON public.data_export_audit (export_type, created_at DESC);
