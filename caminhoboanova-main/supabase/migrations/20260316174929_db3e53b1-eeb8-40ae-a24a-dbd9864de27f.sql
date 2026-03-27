
-- Prayer pairs table
CREATE TABLE public.prayer_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL,
  user_a_id uuid NOT NULL,
  user_b_id uuid NOT NULL,
  user_a_name text NOT NULL DEFAULT '',
  user_b_name text NOT NULL DEFAULT '',
  week_start date NOT NULL,
  user_a_confirmed boolean NOT NULL DEFAULT false,
  user_b_confirmed boolean NOT NULL DEFAULT false,
  user_a_testimony text,
  user_b_testimony text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(community, user_a_id, week_start)
);

ALTER TABLE public.prayer_pairs ENABLE ROW LEVEL SECURITY;

-- Users can view pairs in their community
CREATE POLICY "Users can view pairs in their community" ON public.prayer_pairs
  FOR SELECT TO authenticated
  USING (community = (get_my_community())::text);

-- Users can update their own confirmation/testimony
CREATE POLICY "Users can update their own pair data" ON public.prayer_pairs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Admins/leaders can manage all pairs
CREATE POLICY "Admins can manage pairs" ON public.prayer_pairs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can manage pairs" ON public.prayer_pairs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role))
  WITH CHECK (has_role(auth.uid(), 'lider'::app_role));
