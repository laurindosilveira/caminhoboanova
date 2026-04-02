-- Achievement definitions table — allows admins to manage achievements without code changes
CREATE TABLE public.achievement_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT '🏆',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1,
  bonus_points INTEGER NOT NULL DEFAULT 10,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Anyone can read achievement definitions"
  ON public.achievement_definitions FOR SELECT TO authenticated
  USING (true);

-- Only admins can create/update/delete
CREATE POLICY "Admins can manage achievement definitions"
  ON public.achievement_definitions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed all 18 default achievements
INSERT INTO public.achievement_definitions
  (key, icon, title, description, metric, target, bonus_points, is_secret, sort_order)
VALUES
  ('streak_7',        '🔥',    '7 dias seguidos',                 'Sequência de fé incrível!',                                        'streak_days',      7,   10, FALSE,  1),
  ('first_activity',  '📖',    'Primeiros passos',                'Completou sua 1ª atividade!',                                       'completed_count',  1,   10, FALSE,  2),
  ('activities_5',    '🎓',    '5 atividades',                    'Comprometido com a jornada!',                                       'completed_count',  5,   10, FALSE,  3),
  ('points_100',      '⭐',    '100 pontos da fé',                'Crescendo sempre!',                                                  'faith_points',     100, 10, FALSE,  4),
  ('activities_10',   '🏆',    '10 atividades',                   'Dedicação exemplar!',                                               'completed_count',  10,  10, FALSE,  5),
  ('points_200',      '💎',    '200 pontos',                      'Nível máximo de fé!',                                               'faith_points',     200, 10, FALSE,  6),
  ('dev_10',          '❤️',   'Oração contínua',                 '10 devocionais completos',                                          'dev_count',        10,  10, FALSE,  7),
  ('attendance_5',    '🤝',    'Serviço fiel',                    '5 presenças em encontros',                                          'attendance_count', 5,   10, FALSE,  8),
  ('dev_20',          '📖',    'Leitura bíblica',                 '20 devocionais completos',                                          'dev_count',        20,  10, FALSE,  9),
  ('worship_5',       '⛪',    'Adorador',                        '5 cultos confirmados',                                              'worship_count',    5,   10, FALSE, 10),
  ('attendance_3',    '👥',    'Participou do encontro',          '3 presenças em encontros',                                          'attendance_count', 3,   10, FALSE, 11),
  ('chat_5',          '🎤',    'Compartilhou testemunho',         '5 mensagens no chat',                                               'chat_count',       5,   10, FALSE, 12),
  ('prayer_3',        '🙏',    'Intercessor',                     '3 pedidos de oração',                                               'prayer_count',     3,   10, FALSE, 13),
  ('chat_20',         '💬',    'Voz ativa',                       '20 mensagens no chat',                                              'chat_count',       20,  10, FALSE, 14),
  ('biweekly_streak', '🏅',    'Quinzena perfeita',               'Completou estudo, devocionais e presença nos últimos 15 dias!',     'biweekly_streak',  1,   30, FALSE, 15),
  ('streak_14',       '🛡️',   'Guardião da Fé',                  '14 dias seguidos de dedicação!',                                    'streak_days',      14,  25, TRUE,  16),
  ('streak_30',       '👁️',   'Constância Invisível',            '30 dias seguidos — lendário!',                                      'streak_days',      30,  25, TRUE,  17),
  ('apto',            '✝️',   'Pronto para a Profissão de Fé',   'Seu pastor confirmou: você está pronto!',                           'is_apto',          1,   50, TRUE,  18);
