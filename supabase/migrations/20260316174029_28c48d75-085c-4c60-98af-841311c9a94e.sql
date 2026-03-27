
-- Polls table
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  options text[] NOT NULL DEFAULT '{}',
  emoji text NOT NULL DEFAULT '📊',
  created_by uuid NOT NULL,
  community text NOT NULL,
  area text,
  is_active boolean NOT NULL DEFAULT true,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Poll votes table
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index integer NOT NULL,
  voted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls RLS: admins/liders can create, everyone in community can view
CREATE POLICY "Admins can manage polls" ON public.polls
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leaders can manage polls" ON public.polls
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'lider'::app_role))
  WITH CHECK (has_role(auth.uid(), 'lider'::app_role));

CREATE POLICY "Users can view polls in their community" ON public.polls
  FOR SELECT TO authenticated
  USING (community = (get_my_community())::text OR area = (get_my_area())::text);

-- Poll votes RLS
CREATE POLICY "Users can insert their own votes" ON public.poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view poll votes" ON public.poll_votes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can delete their own votes" ON public.poll_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
