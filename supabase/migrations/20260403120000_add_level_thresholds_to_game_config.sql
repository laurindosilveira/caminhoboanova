-- Add faith level thresholds to game_config so they can be edited without code changes
-- Level 1: 0–19 pts | Level 2: 20–59 | Level 3: 60–99 | Level 4: 100–199 | Level 5: 200+

INSERT INTO public.game_config (key, value, description)
VALUES
  ('level_2_threshold', '20',  'Pontos mínimos para nível 2'),
  ('level_3_threshold', '60',  'Pontos mínimos para nível 3'),
  ('level_4_threshold', '100', 'Pontos mínimos para nível 4'),
  ('level_5_threshold', '200', 'Pontos mínimos para nível 5')
ON CONFLICT (key) DO NOTHING;
