
-- Update get_my_area to also check lider role for admin_area
CREATE OR REPLACE FUNCTION public.get_my_area()
 RETURNS area_name
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT admin_area::area_name FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'lider') AND admin_area IS NOT NULL LIMIT 1),
    (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
$$;
