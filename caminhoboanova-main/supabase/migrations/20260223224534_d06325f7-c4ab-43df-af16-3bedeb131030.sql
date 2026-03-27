
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS father_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mother_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS father_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS mother_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text DEFAULT '';
