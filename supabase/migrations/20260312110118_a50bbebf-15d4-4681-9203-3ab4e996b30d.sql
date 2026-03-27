
-- Table to store push activation reminders sent by admins to specific users
CREATE TABLE public.push_activation_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  sent_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz DEFAULT NULL
);

ALTER TABLE public.push_activation_reminders ENABLE ROW LEVEL SECURITY;

-- Users can view reminders targeted to them
CREATE POLICY "Users can view own reminders"
ON public.push_activation_reminders
FOR SELECT TO authenticated
USING (auth.uid() = target_user_id);

-- Users can update (dismiss) their own reminders
CREATE POLICY "Users can dismiss own reminders"
ON public.push_activation_reminders
FOR UPDATE TO authenticated
USING (auth.uid() = target_user_id);

-- Admins and leaders can insert reminders
CREATE POLICY "Admins can insert reminders"
ON public.push_activation_reminders
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

-- Admins can view all reminders
CREATE POLICY "Admins can view all reminders"
ON public.push_activation_reminders
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));
