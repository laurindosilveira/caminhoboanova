
-- Community challenges table
CREATE TABLE public.community_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '📖',
  community text,
  area text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view challenges"
ON public.community_challenges FOR SELECT
USING (true);

CREATE POLICY "Admins can manage challenges"
ON public.community_challenges FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Challenge participation tracking
CREATE TABLE public.challenge_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenge participants"
ON public.challenge_participants FOR SELECT
USING (true);

CREATE POLICY "Users can join challenges"
ON public.challenge_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation"
ON public.challenge_participants FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can leave challenges"
ON public.challenge_participants FOR DELETE
USING (auth.uid() = user_id);
