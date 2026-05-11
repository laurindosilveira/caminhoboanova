-- =============================================================================
-- Aniversariantes: leitura segura para Jornada/Comunidade + cron do push
-- =============================================================================

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
  )
  SELECT
    p.user_id,
    p.full_name,
    p.birth_date,
    p.community::text AS community,
    p.area::text AS area
  FROM public.profiles p
  CROSS JOIN requester r
  WHERE p.birth_date IS NOT NULL
    AND (
      (_month IS NULL)
      OR EXTRACT(MONTH FROM p.birth_date)::integer = _month
    )
    AND (
      r.is_super
      OR (
        (r.is_admin OR r.is_lider)
        AND p.area::text = COALESCE(NULLIF(_area, ''), r.own_area)
      )
      OR (
        NOT (r.is_admin OR r.is_lider)
        AND p.area::text = r.own_area
      )
    )
  ORDER BY
    EXTRACT(DAY FROM p.birth_date)::integer,
    p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_area_birthdays(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_area_birthdays(text, integer) TO authenticated;

-- The birthday push automation lives inside send-push-notifications.
-- Schedule that function hourly so birthday notifications and scheduled pushes run.
SELECT cron.unschedule('send-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-push-notifications'
);

SELECT cron.schedule(
  'send-push-notifications',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-push-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{}'::jsonb
    );
  $$
);
