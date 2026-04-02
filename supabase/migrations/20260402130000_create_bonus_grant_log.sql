-- Audit log for manual bonus grants by leaders/admins
CREATE TABLE public.bonus_grant_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  granted_by UUID NOT NULL,
  target_user_id UUID NOT NULL,
  achievement_id UUID NOT NULL,
  justification TEXT NOT NULL DEFAULT '',
  points_granted INTEGER NOT NULL DEFAULT 0,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_grant_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bonus grant logs"
  ON public.bonus_grant_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Liders can insert bonus grant logs"
  ON public.bonus_grant_log
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'lider'::app_role));

CREATE POLICY "Liders can view bonus grant logs"
  ON public.bonus_grant_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role));
