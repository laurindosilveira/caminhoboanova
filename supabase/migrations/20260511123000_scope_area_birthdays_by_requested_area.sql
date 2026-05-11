-- Keep birthday highlights scoped to the requested/current app area, including super admins.

CREATE OR REPLACE FUNCTION public.get_area_birthdays(_area text, _month integer DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  birth_date date,
  community text,
  area text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requester AS (
    SELECT
      auth.uid() AS user_id,
      public.get_my_area()::text AS own_area,
      public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin,
      public.has_role(auth.uid(), 'lider'::public.app_role) AS is_lider,
      public.is_super_admin(auth.uid()) AS is_super
  ),
  scope AS (
    SELECT
      COALESCE(NULLIF(_area, ''), own_area) AS target_area,
      own_area,
      is_admin,
      is_lider,
      is_super
    FROM requester
  )
  SELECT
    p.user_id,
    p.full_name,
    p.birth_date,
    p.community::text AS community,
    p.area::text AS area
  FROM public.profiles p
  CROSS JOIN scope s
  WHERE p.birth_date IS NOT NULL
    AND (
      (_month IS NULL)
      OR EXTRACT(MONTH FROM p.birth_date)::integer = _month
    )
    AND p.area::text = s.target_area
    AND (
      s.is_super
      OR s.is_admin
      OR s.is_lider
      OR p.area::text = s.own_area
    )
  ORDER BY
    EXTRACT(DAY FROM p.birth_date)::integer,
    p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_area_birthdays(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_area_birthdays(text, integer) TO authenticated;
