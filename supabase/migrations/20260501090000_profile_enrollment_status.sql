-- Add an explicit enrollment status for the waiting-room approval flow.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_enrollment_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_enrollment_status_check
  CHECK (enrollment_status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles
SET enrollment_status = 'approved'
WHERE turma_id IS NOT NULL
  AND enrollment_status = 'pending';

CREATE INDEX IF NOT EXISTS profiles_waiting_room_idx
  ON public.profiles (area, enrollment_status, turma_id)
  WHERE turma_id IS NULL;
