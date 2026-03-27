
-- Table to store ranking seasons (when admin closes a course)
CREATE TABLE public.ranking_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  community TEXT NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_by UUID NOT NULL,
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_participants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ranking_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ranking seasons"
  ON public.ranking_seasons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view ranking seasons for their community"
  ON public.ranking_seasons FOR SELECT
  USING (community = (get_my_community())::text);

-- Unique constraint: one season per course per community
CREATE UNIQUE INDEX idx_ranking_seasons_unique ON public.ranking_seasons (course_id, community);

-- Updated ranking RPC with new formula:
-- Estudo (20pts per lesson with responses) + Devocionais (5pts each) + Presença (10pts each) + Atividades (activity.points) + Bônus curso completo (100pts)
CREATE OR REPLACE FUNCTION public.get_community_ranking(_community community_name)
RETURNS TABLE(user_id uuid, full_name text, completed_count bigint, faith_points bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH lesson_points AS (
    SELECT lr.user_id, COUNT(DISTINCT lr.lesson_id) * 20 AS pts
    FROM lesson_responses lr
    JOIN profiles p ON p.user_id = lr.user_id AND p.community = _community
    GROUP BY lr.user_id
  ),
  devotional_pts AS (
    SELECT dp.user_id, COUNT(*) * 5 AS pts
    FROM devotional_progress dp
    JOIN profiles p ON p.user_id = dp.user_id AND p.community = _community
    GROUP BY dp.user_id
  ),
  attendance_pts AS (
    SELECT a.user_id, COUNT(*) * 10 AS pts
    FROM attendance a
    JOIN profiles p ON p.user_id = a.user_id AND p.community = _community
    WHERE a.status = 'presente'
    GROUP BY a.user_id
  ),
  activity_pts AS (
    SELECT up.user_id, COALESCE(SUM(act.points), 0) AS pts, COUNT(up.id) AS cnt
    FROM user_progress up
    JOIN activities act ON act.id = up.activity_id
    JOIN profiles p ON p.user_id = up.user_id AND p.community = _community
    GROUP BY up.user_id
  ),
  course_bonus AS (
    -- 100pts bonus per fully completed course (all lessons have responses)
    SELECT p.user_id, COUNT(DISTINCT c.id) * 100 AS pts
    FROM profiles p
    JOIN courses c ON true
    JOIN lessons l ON l.course_id = c.id
    LEFT JOIN lesson_responses lr ON lr.lesson_id = l.id AND lr.user_id = p.user_id
    WHERE p.community = _community
    GROUP BY p.user_id, c.id, (SELECT COUNT(*) FROM lessons WHERE course_id = c.id)
    HAVING COUNT(DISTINCT lr.lesson_id) = (SELECT COUNT(*) FROM lessons WHERE course_id = c.id)
  ),
  course_bonus_agg AS (
    SELECT user_id, SUM(pts) AS pts FROM course_bonus GROUP BY user_id
  )
  SELECT
    p.user_id,
    p.full_name,
    COALESCE(ap.cnt, 0) AS completed_count,
    (COALESCE(lp.pts, 0) + COALESCE(dp.pts, 0) + COALESCE(atp.pts, 0) + COALESCE(ap.pts, 0) + COALESCE(cb.pts, 0)) AS faith_points
  FROM profiles p
  LEFT JOIN lesson_points lp ON lp.user_id = p.user_id
  LEFT JOIN devotional_pts dp ON dp.user_id = p.user_id
  LEFT JOIN attendance_pts atp ON atp.user_id = p.user_id
  LEFT JOIN activity_pts ap ON ap.user_id = p.user_id
  LEFT JOIN course_bonus_agg cb ON cb.user_id = p.user_id
  WHERE p.community = _community
  ORDER BY faith_points DESC, completed_count DESC;
$$;
