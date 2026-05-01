-- =============================================================================
-- LGPD/SEGURANCA: solicitacoes formais de direitos do titular
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('data_deletion', 'data_correction', 'consent_review', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'completed', 'rejected')),
  details TEXT,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can create own privacy requests"
ON public.privacy_requests FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'open'
  AND admin_notes IS NULL
  AND resolved_at IS NULL
  AND resolved_by IS NULL
);

DROP POLICY IF EXISTS "Users can view own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users can view own privacy requests"
ON public.privacy_requests FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_authorized_system_admin()
);

DROP POLICY IF EXISTS "System admins can update privacy requests" ON public.privacy_requests;
CREATE POLICY "System admins can update privacy requests"
ON public.privacy_requests FOR UPDATE
TO authenticated
USING (public.is_authorized_system_admin())
WITH CHECK (public.is_authorized_system_admin());

CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_created
ON public.privacy_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status_created
ON public.privacy_requests (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_privacy_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_privacy_requests_updated_at ON public.privacy_requests;
CREATE TRIGGER update_privacy_requests_updated_at
BEFORE UPDATE ON public.privacy_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_privacy_requests_updated_at();
