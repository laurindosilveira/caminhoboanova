-- =============================================================================
-- Tabela de auditoria para remoção de pontos bônus
-- Complementa bonus_grant_log com RLS por role.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bonus_removal_log (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  removed_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES public.achievement_definitions(id) ON DELETE SET NULL,
  justification  TEXT NOT NULL DEFAULT '',
  points_removed INTEGER NOT NULL DEFAULT 0,
  removed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_removal_log ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "Admins can manage bonus removal logs"
ON public.bonus_removal_log
FOR ALL
TO authenticated
USING  (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- Líderes: podem registrar remoções e ver as que eles próprios fizeram
CREATE POLICY "Liders can insert bonus removal logs"
ON public.bonus_removal_log
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'lider'::app_role)
  AND removed_by = auth.uid()
);

CREATE POLICY "Liders can view own bonus removal logs"
ON public.bonus_removal_log
FOR SELECT
TO authenticated
USING (
  removed_by = auth.uid()
  AND has_role(auth.uid(), 'lider'::app_role)
);
