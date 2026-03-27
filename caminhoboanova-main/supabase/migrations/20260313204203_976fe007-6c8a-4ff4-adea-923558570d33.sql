
-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Create unique index on email (allow nulls for existing rows)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (email) WHERE email IS NOT NULL;

-- Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  community_val community_name;
  area_val area_name;
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL
    AND NEW.raw_user_meta_data->>'full_name' IS NOT NULL
    AND NEW.raw_user_meta_data->>'community' IS NOT NULL
  THEN
    BEGIN
      community_val := (NEW.raw_user_meta_data->>'community')::community_name;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;
    END;

    area_val := CASE
      WHEN community_val IN ('Rincão Frente', 'Rincão Fundo', 'Bom Pastor', 'Iriá Pira 1')
        THEN 'Área 1'::area_name
      ELSE 'Área 2'::area_name
    END;

    INSERT INTO public.profiles (
      user_id, full_name, birth_date, phone, community, area,
      father_name, mother_name, father_phone, mother_phone, avatar_url,
      confirmation_year, email
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      (NEW.raw_user_meta_data->>'birth_date')::date,
      NEW.raw_user_meta_data->>'phone',
      community_val,
      area_val,
      COALESCE(NEW.raw_user_meta_data->>'father_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'mother_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'father_phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'mother_phone', ''),
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
      1,
      NEW.email
    )
    ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;
