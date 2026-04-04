-- Add devotional window mode to lessons (5_days or 10_days)
-- Default is 10_days (current behaviour).
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS devotional_mode text NOT NULL DEFAULT '10_days';

-- Track whether a devotional was completed in the recovery window
ALTER TABLE public.devotional_progress
  ADD COLUMN IF NOT EXISTS is_recovery boolean NOT NULL DEFAULT false;

-- Points for recovery-window completions (lower than normal)
INSERT INTO public.game_config (key, value)
VALUES ('devotional_recovery_points', '2')
ON CONFLICT (key) DO NOTHING;
