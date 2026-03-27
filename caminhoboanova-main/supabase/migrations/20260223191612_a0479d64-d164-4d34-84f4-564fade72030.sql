
-- Add admin_area column to user_roles to define which area the admin manages
ALTER TABLE public.user_roles ADD COLUMN admin_area text NULL;

-- Update get_my_area to return admin_area for admins, fallback to profile area
CREATE OR REPLACE FUNCTION public.get_my_area()
 RETURNS area_name
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT admin_area::area_name FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin' AND admin_area IS NOT NULL LIMIT 1),
    (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
$$;
