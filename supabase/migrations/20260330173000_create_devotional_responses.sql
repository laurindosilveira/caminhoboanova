CREATE TABLE public.devotional_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  devotional_id UUID NOT NULL,
  question_index INTEGER NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, devotional_id, question_index),
  CONSTRAINT devotional_responses_progress_fkey
    FOREIGN KEY (user_id, devotional_id)
    REFERENCES public.devotional_progress (user_id, devotional_id)
    ON DELETE CASCADE
);

ALTER TABLE public.devotional_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own devotional responses"
ON public.devotional_responses
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view devotional responses in their area"
ON public.devotional_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = devotional_responses.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE TRIGGER update_devotional_responses_updated_at
BEFORE UPDATE ON public.devotional_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
