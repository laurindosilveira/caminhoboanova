
-- ============================================================
-- SPIRITUAL ASSESSMENTS (autoavaliação mensal)
-- ============================================================
CREATE TABLE public.spiritual_assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month        integer NOT NULL, -- 1-12
  year         integer NOT NULL,
  prayer_score integer CHECK (prayer_score BETWEEN 1 AND 5),    -- Como está sua vida de oração?
  presence_score integer CHECK (presence_score BETWEEN 1 AND 5), -- Você sente Deus perto de você?
  struggle_score integer CHECK (struggle_score BETWEEN 1 AND 5), -- Está enfrentando tentações? (invertido: 5=muita dificuldade)
  doubt_score  integer CHECK (doubt_score BETWEEN 1 AND 5),      -- Tem dúvidas sobre a fé? (invertido)
  needs_pastor boolean NOT NULL DEFAULT false,                    -- Precisa conversar com o pastor?
  notes        text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);

ALTER TABLE public.spiritual_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assessments"
  ON public.spiritual_assessments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view assessments in their area"
  ON public.spiritual_assessments FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = spiritual_assessments.user_id
        AND p.area = get_my_area()
    )
  );

-- ============================================================
-- DISCIPLESHIP PLANS (plano individual)
-- ============================================================
CREATE TABLE public.discipleship_plans (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  objectives   text,         -- Objetivos espirituais pessoais
  challenges   text,         -- Desafios propostos
  recommendations text,      -- Recomendações pastorais
  next_steps   text,         -- Próximos passos
  pastor_notes text,         -- Notas do pastor (visível só para admins e o próprio)
  health_status text NOT NULL DEFAULT 'atencao' CHECK (health_status IN ('saudavel','atencao','critico')),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  created_at   timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discipleship_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plan"
  ON public.discipleship_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage plans in their area"
  ON public.discipleship_plans FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = discipleship_plans.user_id
        AND p.area = get_my_area()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = discipleship_plans.user_id
        AND p.area = get_my_area()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_discipleship_plans_updated_at
  BEFORE UPDATE ON public.discipleship_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
