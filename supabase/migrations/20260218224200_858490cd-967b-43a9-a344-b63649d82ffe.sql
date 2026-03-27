
-- Drop previous edge function approach artifacts (if any profile was partially created)
-- Create trigger function that auto-creates profile from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  community_val community_name;
  area_val area_name;
BEGIN
  -- Only create profile if metadata has the required fields
  IF NEW.raw_user_meta_data IS NOT NULL
    AND NEW.raw_user_meta_data->>'full_name' IS NOT NULL
    AND NEW.raw_user_meta_data->>'community' IS NOT NULL
  THEN
    BEGIN
      community_val := (NEW.raw_user_meta_data->>'community')::community_name;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW; -- Invalid community, skip profile creation
    END;

    area_val := CASE
      WHEN community_val IN ('Rincão Frente', 'Rincão Fundo', 'Bom Pastor', 'Iriá Pira 1')
        THEN 'Área 1'::area_name
      ELSE 'Área 2'::area_name
    END;

    INSERT INTO public.profiles (
      user_id,
      full_name,
      birth_date,
      phone,
      community,
      area
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'full_name',
      (NEW.raw_user_meta_data->>'birth_date')::date,
      NEW.raw_user_meta_data->>'phone',
      community_val,
      area_val
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (fires after every new user creation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
