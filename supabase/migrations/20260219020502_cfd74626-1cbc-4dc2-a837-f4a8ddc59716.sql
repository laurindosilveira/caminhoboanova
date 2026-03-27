
-- Add aptidao (profession of faith readiness) field to discipleship_plans
ALTER TABLE public.discipleship_plans 
  ADD COLUMN IF NOT EXISTS aptidao text DEFAULT 'acompanhamento' CHECK (aptidao IN ('apto', 'acompanhamento', 'nao_apto'));

-- Create lesson_responses table for storing youth answers to lesson questions
CREATE TABLE IF NOT EXISTS public.lesson_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  question_key text NOT NULL,
  response text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id, question_key)
);

-- Enable RLS
ALTER TABLE public.lesson_responses ENABLE ROW LEVEL SECURITY;

-- Users can manage their own responses
CREATE POLICY "Users can manage their own lesson responses"
  ON public.lesson_responses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view lesson responses in their area
CREATE POLICY "Admins can view lesson responses in their area"
  ON public.lesson_responses
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = lesson_responses.user_id
        AND p.area = get_my_area()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_lesson_responses_updated_at
  BEFORE UPDATE ON public.lesson_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
