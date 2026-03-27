
CREATE TABLE public.meeting_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  participation_score integer CHECK (participation_score BETWEEN 1 AND 5),
  understanding_score integer CHECK (understanding_score BETWEEN 1 AND 5),
  engagement_score integer CHECK (engagement_score BETWEEN 1 AND 5),
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.meeting_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evaluations in their area"
ON public.meeting_evaluations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area()
  )
);

CREATE TRIGGER update_meeting_evaluations_updated_at
BEFORE UPDATE ON public.meeting_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
