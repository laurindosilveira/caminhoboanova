-- Tabela de configuração de pontuação do game
CREATE TABLE public.game_config (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados podem ler (necessário para calcular pontos no cliente)
CREATE POLICY "Authenticated users can read game config"
ON public.game_config FOR SELECT
TO authenticated
USING (true);

-- Somente admins podem editar
CREATE POLICY "Admins can manage game config"
ON public.game_config FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Valores padrão
INSERT INTO public.game_config (key, value) VALUES
  ('lesson_points', 20),
  ('devotional_points', 5),
  ('devotional_weekend_points', 2),
  ('attendance_points', 10),
  ('worship_points', 5),
  ('course_completion_bonus', 100),
  ('challenge_points', 15);

-- Trigger para updated_at
CREATE TRIGGER update_game_config_updated_at
BEFORE UPDATE ON public.game_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Atualiza RPC get_community_ranking para usar valores dinâmicos do game_config
CREATE OR REPLACE FUNCTION public.get_community_ranking(_community text)
RETURNS TABLE(user_id uuid, full_name text, completed_count bigint, faith_points bigint)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  _lesson_pts integer;
  _dev_pts integer;
  _dev_wk_pts integer;
  _att_pts integer;
  _worship_pts integer;
  _course_bonus integer;
  _challenge_pts integer;
BEGIN
  -- Carrega configurações com fallback nos defaults
  SELECT
    COALESCE(MAX(CASE WHEN key = 'lesson_points'             THEN value END), 20),
    COALESCE(MAX(CASE WHEN key = 'devotional_points'         THEN value END), 5),
    COALESCE(MAX(CASE WHEN key = 'devotional_weekend_points' THEN value END), 2),
    COALESCE(MAX(CASE WHEN key = 'attendance_points'         THEN value END), 10),
    COALESCE(MAX(CASE WHEN key = 'worship_points'            THEN value END), 5),
    COALESCE(MAX(CASE WHEN key = 'course_completion_bonus'   THEN value END), 100),
    COALESCE(MAX(CASE WHEN key = 'challenge_points'          THEN value END), 15)
  INTO _lesson_pts, _dev_pts, _dev_wk_pts, _att_pts, _worship_pts, _course_bonus, _challenge_pts
  FROM public.game_config;

  RETURN QUERY
  WITH lesson_points AS (
    SELECT lr.user_id, COUNT(DISTINCT lr.lesson_id) * _lesson_pts AS pts
    FROM lesson_responses lr
    JOIN profiles p ON p.user_id = lr.user_id AND p.community = _community
    GROUP BY lr.user_id
  ),
  devotional_pts AS (
    SELECT dp.user_id,
      SUM(CASE WHEN EXTRACT(DOW FROM dp.completed_at AT TIME ZONE 'America/Sao_Paulo') IN (0, 6)
               THEN _dev_wk_pts ELSE _dev_pts END) AS pts
    FROM devotional_progress dp
    JOIN profiles p ON p.user_id = dp.user_id AND p.community = _community
    GROUP BY dp.user_id
  ),
  attendance_pts AS (
    SELECT a.user_id, COUNT(*) * _att_pts AS pts
    FROM attendance a
    JOIN profiles p ON p.user_id = a.user_id AND p.community = _community
    WHERE a.status = 'presente'
    GROUP BY a.user_id
  ),
  worship_pts AS (
    SELECT wa.user_id, COUNT(*) * _worship_pts AS pts
    FROM worship_attendance wa
    JOIN profiles p ON p.user_id = wa.user_id AND p.community = _community
    WHERE wa.status = 'aprovado'
    GROUP BY wa.user_id
  ),
  activity_pts AS (
    SELECT up.user_id, COALESCE(SUM(act.points), 0) AS pts, COUNT(up.id) AS cnt
    FROM user_progress up
    JOIN activities act ON act.id = up.activity_id
    JOIN profiles p ON p.user_id = up.user_id AND p.community = _community
    GROUP BY up.user_id
  ),
  challenge_pts AS (
    SELECT cp.user_id, COUNT(*) * _challenge_pts AS pts
    FROM challenge_participants cp
    JOIN profiles p ON p.user_id = cp.user_id AND p.community = _community
    WHERE cp.completed = true
    GROUP BY cp.user_id
  ),
  course_bonus AS (
    SELECT p.user_id, COUNT(DISTINCT c.id) * _course_bonus AS pts
    FROM profiles p
    JOIN courses c ON true
    JOIN lessons l ON l.course_id = c.id
    LEFT JOIN lesson_responses lr ON lr.lesson_id = l.id AND lr.user_id = p.user_id
    WHERE p.community = _community
    GROUP BY p.user_id, c.id, (SELECT COUNT(*) FROM lessons WHERE course_id = c.id)
    HAVING COUNT(DISTINCT lr.lesson_id) = (SELECT COUNT(*) FROM lessons WHERE course_id = c.id)
  ),
  course_bonus_agg AS (
    SELECT cb.user_id, SUM(cb.pts) AS pts FROM course_bonus cb GROUP BY cb.user_id
  ),
  achievement_pts AS (
    SELECT au.user_id, COALESCE(SUM(au.bonus_points), 0) AS pts
    FROM achievement_unlocks au
    JOIN profiles p ON p.user_id = au.user_id AND p.community = _community
    GROUP BY au.user_id
  )
  SELECT p.user_id, p.full_name,
    COALESCE(ap.cnt, 0)::bigint AS completed_count,
    (COALESCE(lp.pts, 0) + COALESCE(dp.pts, 0) + COALESCE(atp.pts, 0) +
     COALESCE(ap.pts, 0) + COALESCE(cb.pts, 0) + COALESCE(wp.pts, 0) +
     COALESCE(achp.pts, 0) + COALESCE(chp.pts, 0))::bigint AS faith_points
  FROM profiles p
  LEFT JOIN lesson_points lp ON lp.user_id = p.user_id
  LEFT JOIN devotional_pts dp ON dp.user_id = p.user_id
  LEFT JOIN attendance_pts atp ON atp.user_id = p.user_id
  LEFT JOIN activity_pts ap ON ap.user_id = p.user_id
  LEFT JOIN course_bonus_agg cb ON cb.user_id = p.user_id
  LEFT JOIN worship_pts wp ON wp.user_id = p.user_id
  LEFT JOIN achievement_pts achp ON achp.user_id = p.user_id
  LEFT JOIN challenge_pts chp ON chp.user_id = p.user_id
  WHERE p.community = _community
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role IN ('admin', 'lider')
    )
  ORDER BY faith_points DESC, completed_count DESC;
END;
$$;
