
-- Table to track which courses are unlocked per area
CREATE TABLE public.course_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  area text NOT NULL,
  unlocked_by uuid NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id, area)
);

ALTER TABLE public.course_unlocks ENABLE ROW LEVEL SECURITY;

-- Admins can manage unlocks
CREATE POLICY "Admins can manage course unlocks"
ON public.course_unlocks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Liders can manage unlocks in their area
CREATE POLICY "Liders can manage course unlocks in their area"
ON public.course_unlocks
FOR ALL
USING (has_role(auth.uid(), 'lider'::app_role) AND area = (get_my_area())::text)
WITH CHECK (has_role(auth.uid(), 'lider'::app_role) AND area = (get_my_area())::text);

-- All authenticated users can view unlocks (needed to check if course is available)
CREATE POLICY "Authenticated users can view course unlocks"
ON public.course_unlocks
FOR SELECT
USING (auth.uid() IS NOT NULL);
