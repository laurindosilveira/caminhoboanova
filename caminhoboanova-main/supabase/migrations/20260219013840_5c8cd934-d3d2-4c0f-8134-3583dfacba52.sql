
-- ============================================================
-- COURSES table
-- ============================================================
CREATE TABLE public.courses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num  integer NOT NULL,
  title      text NOT NULL,
  subtitle   text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courses viewable by authenticated users"
  ON public.courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- LESSONS table
-- ============================================================
CREATE TABLE public.lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_num   integer NOT NULL,
  title       text NOT NULL,
  objective   text,
  topics      text[],
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lessons viewable by authenticated users"
  ON public.lessons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage lessons"
  ON public.lessons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- EVENTS table (Agenda)
-- ============================================================
CREATE TABLE public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  event_date  timestamp with time zone NOT NULL,
  location    text,
  area        text,       -- NULL = todos, 'Área 1', 'Área 2'
  community   text,       -- NULL = toda a área
  type        text NOT NULL DEFAULT 'encontro', -- encontro, culto, retiro, evento
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events viewable by authenticated users"
  ON public.events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- MESSAGES table (Comunicação)
-- ============================================================
CREATE TABLE public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  area        text,       -- NULL = todos
  community   text,       -- NULL = toda a área
  sent_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their area or community"
  ON public.messages FOR SELECT TO authenticated
  USING (
    area IS NULL OR
    area = get_my_area()::text OR
    community = get_my_community()::text
  );

CREATE POLICY "Admins can manage messages"
  ON public.messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Seed: Curso 1 — Começando a Vida Cristã
-- ============================================================
WITH c1 AS (
  INSERT INTO public.courses (order_num, title, subtitle)
  VALUES (1, 'Começando a Vida Cristã', 'Fundamentos da fé para novos crentes')
  RETURNING id
)
INSERT INTO public.lessons (course_id, order_num, title, objective, topics) VALUES
  ((SELECT id FROM c1), 1,  'Por que preciso conhecer a Jesus?',         'Entender a necessidade de conhecer Jesus',       ARRAY['Jesus', 'Coração', 'Pecado', 'Reconciliação', 'Ressurreição']),
  ((SELECT id FROM c1), 2,  'Que significa receber a Jesus?',             'Compreender o que é receber Jesus na vida',      ARRAY['Arrependimento', 'Fé', 'Justificação', 'Santificação']),
  ((SELECT id FROM c1), 3,  'Como posso ter certeza da minha salvação?',  'Afirmar a certeza da salvação em Cristo',        NULL),
  ((SELECT id FROM c1), 4,  'O que é a Bíblia?',                          'Conhecer a origem e autoridade da Bíblia',       NULL),
  ((SELECT id FROM c1), 5,  'Como estudar a Bíblia?',                     'Desenvolver o hábito do estudo bíblico',         NULL),
  ((SELECT id FROM c1), 6,  'Como conversar com Deus?',                   'Aprender os fundamentos da oração',              NULL),
  ((SELECT id FROM c1), 7,  'Como vencer as tentações?',                  'Compreender a luta espiritual e recursos',       NULL),
  ((SELECT id FROM c1), 8,  'O que é a igreja?',                          'Entender o papel da igreja na vida cristã',      NULL),
  ((SELECT id FROM c1), 9,  'Qual é o meu lugar na igreja local?',        'Descobrir pertencimento na comunidade de fé',   NULL),
  ((SELECT id FROM c1), 10, 'Como praticar a comunhão cristã?',           'Vivenciar a vida em comunidade',                 NULL),
  ((SELECT id FROM c1), 11, 'Por que devo ser batizado?',                 'Compreender o sentido do batismo',               NULL),
  ((SELECT id FROM c1), 12, 'O que é a ceia do Senhor?',                  'Entender o significado da Santa Ceia',           NULL),
  ((SELECT id FROM c1), 13, 'Como viver minha nova vida?',                'Praticar a vida cristã cotidianamente',          NULL),
  ((SELECT id FROM c1), 14, 'Como melhor usar os três "T"s?',             'Administrar Tempo, Talento e Tesouros',          NULL),
  ((SELECT id FROM c1), 15, 'Como compartilhar a minha fé?',              'Desenvolver o testemunho e evangelismo',         NULL),
  ((SELECT id FROM c1), 16, 'Como construir minha vida cristã?',          'Consolidar os fundamentos da vida cristã',       NULL);

-- ============================================================
-- Seed: Curso 2 — Crescimento Cristão
-- ============================================================
WITH c2 AS (
  INSERT INTO public.courses (order_num, title, subtitle)
  VALUES (2, 'Crescimento Cristão', 'Aprofundando a caminhada de fé')
  RETURNING id
)
INSERT INTO public.lessons (course_id, order_num, title) VALUES
  ((SELECT id FROM c2), 1,  'Crescer é um imperativo de Deus'),
  ((SELECT id FROM c2), 2,  'Leite ou alimento sólido'),
  ((SELECT id FROM c2), 3,  'Cinco atitudes que impedem o crescimento'),
  ((SELECT id FROM c2), 4,  'Crescendo no caráter (1)'),
  ((SELECT id FROM c2), 5,  'Crescendo no caráter (2)'),
  ((SELECT id FROM c2), 6,  'Relacionamentos saudáveis'),
  ((SELECT id FROM c2), 7,  'Serviço cristão'),
  ((SELECT id FROM c2), 8,  'Onde Deus me quer'),
  ((SELECT id FROM c2), 9,  'Qual é o meu dom'),
  ((SELECT id FROM c2), 10, 'Cuidados no serviço cristão'),
  ((SELECT id FROM c2), 11, 'Como descobrir a vontade de Deus'),
  ((SELECT id FROM c2), 12, 'Quem é Deus'),
  ((SELECT id FROM c2), 13, 'O conhecimento de Deus'),
  ((SELECT id FROM c2), 14, 'Os sete "Eu sou" de Cristo'),
  ((SELECT id FROM c2), 15, 'O Espírito Santo na vida do crente'),
  ((SELECT id FROM c2), 16, 'A vida futura');
