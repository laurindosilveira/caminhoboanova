
-- Table to store editable lesson content (set by admin, used by students)
CREATE TABLE public.lesson_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL,
  greeting text NOT NULL DEFAULT '',
  icebreaker text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  bible_texts text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  practice text NOT NULL DEFAULT '',
  prayer_prompt text NOT NULL DEFAULT '',
  video_link text NOT NULL DEFAULT '',
  audio_link text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(lesson_id)
);

ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;

-- Admins can manage all lesson content
CREATE POLICY "Admins can manage lesson content"
ON public.lesson_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view lesson content
CREATE POLICY "Authenticated users can view lesson content"
ON public.lesson_content
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_lesson_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_lesson_content_timestamp
BEFORE UPDATE ON public.lesson_content
FOR EACH ROW EXECUTE FUNCTION public.update_lesson_content_updated_at();
