-- Add avatar_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;

-- RLS: anyone can view avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- RLS: authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can delete their own avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Update handle_new_user trigger to include parent fields and avatar
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
      father_name, mother_name, father_phone, mother_phone, avatar_url
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
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;