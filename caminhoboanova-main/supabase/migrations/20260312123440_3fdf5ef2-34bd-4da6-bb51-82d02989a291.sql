
CREATE TABLE public.message_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_views ENABLE ROW LEVEL SECURITY;

-- Users can insert their own views
CREATE POLICY "Users can insert own views"
  ON public.message_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own views
CREATE POLICY "Users can view own views"
  ON public.message_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins and leaders can view all views
CREATE POLICY "Admins can view all message views"
  ON public.message_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));
