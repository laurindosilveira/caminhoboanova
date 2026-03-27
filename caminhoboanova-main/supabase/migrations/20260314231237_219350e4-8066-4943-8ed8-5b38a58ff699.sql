
CREATE TABLE public.push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'manual',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  target text NOT NULL DEFAULT 'all',
  target_value text,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage push logs"
  ON public.push_notification_log
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can view push logs"
  ON public.push_notification_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role));
