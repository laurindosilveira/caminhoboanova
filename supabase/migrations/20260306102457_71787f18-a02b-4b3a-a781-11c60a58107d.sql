
CREATE TABLE public.leader_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  greeting text NOT NULL DEFAULT '',
  icebreaker text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  bible_texts text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  practice text NOT NULL DEFAULT '',
  prayer_prompt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id)
);

ALTER TABLE public.leader_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage leader guide"
  ON public.leader_guide FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view leader guide"
  ON public.leader_guide FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_leader_guide_updated_at
  BEFORE UPDATE ON public.leader_guide
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
