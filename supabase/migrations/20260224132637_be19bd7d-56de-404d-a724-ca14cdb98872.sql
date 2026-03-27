
-- Add status to prayer_requests: 'em_oracao' (default) or 'respondido'
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'em_oracao';
