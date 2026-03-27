
ALTER TABLE public.events ADD COLUMN target_user_id uuid;

-- Allow target user to see their personal events
CREATE POLICY "Users can view their personal events"
  ON public.events
  FOR SELECT
  TO authenticated
  USING (target_user_id = auth.uid());

-- Allow leaders to create events (including personal ones)
CREATE POLICY "Leaders can manage events"
  ON public.events
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role))
  WITH CHECK (has_role(auth.uid(), 'lider'::app_role));
