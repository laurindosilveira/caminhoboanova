
-- Add lesson_id, day_number and title to devotional_content
ALTER TABLE public.devotional_content 
  ADD COLUMN lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  ADD COLUMN day_number integer NOT NULL DEFAULT 1,
  ADD COLUMN title text NOT NULL DEFAULT '';

-- Make activity_id nullable (backward compat during transition)
ALTER TABLE public.devotional_content 
  ALTER COLUMN activity_id DROP NOT NULL;

-- Create unique constraint for lesson_id + day_number
CREATE UNIQUE INDEX devotional_content_lesson_day_unique 
  ON public.devotional_content (lesson_id, day_number) 
  WHERE lesson_id IS NOT NULL;
