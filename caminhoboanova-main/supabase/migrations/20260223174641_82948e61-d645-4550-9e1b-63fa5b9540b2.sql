
-- Track individual devotional completions per user
CREATE TABLE public.devotional_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  devotional_id UUID NOT NULL REFERENCES public.devotional_content(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, devotional_id)
);

ALTER TABLE public.devotional_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devotional progress"
ON public.devotional_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devotional progress"
ON public.devotional_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devotional progress"
ON public.devotional_progress FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devotional progress"
ON public.devotional_progress FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
