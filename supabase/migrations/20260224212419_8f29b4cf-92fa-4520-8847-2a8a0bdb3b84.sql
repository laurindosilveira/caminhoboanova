
-- Table to track unlocked achievements and their bonus points
CREATE TABLE public.achievement_unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  bonus_points integer NOT NULL DEFAULT 10,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

-- Enable RLS
ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;

-- Users can view their own unlocks
CREATE POLICY "Users can view own achievement unlocks"
ON public.achievement_unlocks FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own unlocks
CREATE POLICY "Users can insert own achievement unlocks"
ON public.achievement_unlocks FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all for reporting
CREATE POLICY "Admins can view all achievement unlocks"
ON public.achievement_unlocks FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
