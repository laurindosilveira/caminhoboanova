-- Fix attendance status CHECK constraint to include pending states used by the app.
-- The original constraint only allowed ('presente','faltou','justificado'),
-- but the app sends 'pendente_presente' and 'pendente_falta' when users self-report.
-- These pending values are later approved/rejected by admins.

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('presente', 'faltou', 'justificado', 'pendente_presente', 'pendente_falta', 'justificou', 'rejeitado'));
