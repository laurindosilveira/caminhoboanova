
-- Add preferred notification hour (0-23, default 7 = 7AM)
-- and timezone so the edge function can calculate the correct send time
ALTER TABLE public.notification_preferences
  ADD COLUMN preferred_hour integer NOT NULL DEFAULT 7,
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
