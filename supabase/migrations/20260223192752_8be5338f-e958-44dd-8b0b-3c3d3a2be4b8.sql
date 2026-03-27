-- Add event_type column to worship_attendance
ALTER TABLE public.worship_attendance
ADD COLUMN event_type text NOT NULL DEFAULT 'culto';
