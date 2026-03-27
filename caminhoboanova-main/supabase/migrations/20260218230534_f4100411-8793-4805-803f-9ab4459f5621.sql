-- Function to get the current user's community
CREATE OR REPLACE FUNCTION get_my_community()
RETURNS community_name
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT community FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Allow users to view other profiles in their community
CREATE POLICY "Users can view profiles in their community"
ON public.profiles
FOR SELECT
USING (community = get_my_community());
