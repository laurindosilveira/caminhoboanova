
-- Activities table (etapas da jornada)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('devocional', 'formacao', 'encontro', 'desafio')),
  title TEXT NOT NULL,
  subtitle TEXT,
  order_num INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User progress table
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_id)
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view activities
CREATE POLICY "Activities viewable by authenticated users"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their own progress
CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Security definer function to get current user's area
CREATE OR REPLACE FUNCTION public.get_my_area()
RETURNS area_name
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Admins can view progress of participants in their area
CREATE POLICY "Admins can view area participants progress"
  ON public.user_progress FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = user_progress.user_id
        AND p.area = public.get_my_area()
    )
  );

-- Update admin profile policy to restrict to same area
-- Drop the existing broad admin policy and replace with area-scoped one
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view profiles in their area"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      public.has_role(auth.uid(), 'admin') AND
      area = public.get_my_area()
    )
  );

-- Seed default activities
INSERT INTO public.activities (type, title, subtitle, order_num, points) VALUES
  ('devocional', 'Devocional 1', 'Salmo 23 — O Senhor é meu pastor', 1, 15),
  ('devocional', 'Devocional 2', 'João 15 — A videira e os ramos', 2, 15),
  ('formacao', 'Formação 1', 'O que é a Crisma?', 3, 20),
  ('encontro', 'Encontro 1', 'Partilha em comunidade', 4, 25),
  ('devocional', 'Devocional 3', 'Mateus 5 — As bem-aventuranças', 5, 15),
  ('desafio', 'Desafio de Oração', 'Oração por 3 dias seguidos', 6, 30),
  ('formacao', 'Formação 2', 'Os dons do Espírito Santo', 7, 20),
  ('encontro', 'Encontro 2', 'Testemunhos de fé', 8, 25);
