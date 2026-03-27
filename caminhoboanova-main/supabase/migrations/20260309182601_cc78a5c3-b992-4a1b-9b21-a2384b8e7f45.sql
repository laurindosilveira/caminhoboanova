
-- Audit log for activity removals by leaders/admins
CREATE TABLE public.activity_removal_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  removed_by UUID NOT NULL,
  target_user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'estudo', 'devocional', 'presenca'
  activity_id TEXT NOT NULL, -- lesson_id, devotional_id, or event_id
  activity_title TEXT NOT NULL DEFAULT '',
  points_removed INTEGER NOT NULL DEFAULT 0,
  removed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT DEFAULT ''
);

ALTER TABLE public.activity_removal_log ENABLE ROW LEVEL SECURITY;

-- Admins and leaders can insert logs
CREATE POLICY "Admins can manage removal logs"
  ON public.activity_removal_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Liders can insert removal logs"
  ON public.activity_removal_log
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'lider'::app_role));

CREATE POLICY "Liders can view removal logs"
  ON public.activity_removal_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role));
