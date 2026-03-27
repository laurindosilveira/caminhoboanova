
-- Table to store pastor contact per area
CREATE TABLE public.area_pastors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL UNIQUE,
  pastor_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.area_pastors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage area pastors"
  ON public.area_pastors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view area pastors"
  ON public.area_pastors FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Table for leader meeting notes
CREATE TABLE public.leader_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES lessons(id),
  participation_notes text DEFAULT '',
  questions_notes text DEFAULT '',
  pastoral_care_notes text DEFAULT '',
  follow_up_notes text DEFAULT '',
  spiritual_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(leader_id, lesson_id)
);

ALTER TABLE public.leader_meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaders can manage their own notes"
  ON public.leader_meeting_notes FOR ALL
  USING (auth.uid() = leader_id)
  WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "Admins can view all leader notes"
  ON public.leader_meeting_notes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_leader_meeting_notes_updated_at
  BEFORE UPDATE ON public.leader_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
