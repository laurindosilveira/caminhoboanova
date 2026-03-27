-- Function to get community ranking (bypasses RLS safely, returns only aggregated data)
CREATE OR REPLACE FUNCTION public.get_community_ranking(_community community_name)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  completed_count bigint,
  faith_points bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.full_name,
    COUNT(up.id) AS completed_count,
    COALESCE(SUM(a.points), 0) AS faith_points
  FROM profiles p
  LEFT JOIN user_progress up ON up.user_id = p.user_id
  LEFT JOIN activities a ON a.id = up.activity_id
  WHERE p.community = _community
  GROUP BY p.user_id, p.full_name
  ORDER BY faith_points DESC, completed_count DESC;
$$;