-- Add aptidão (readiness) thresholds to game_config
-- apto >= 3.5 | acompanhamento >= 2.5 | nao_apto < 2.5

INSERT INTO public.game_config (key, value)
VALUES
  ('aptidao_apto_threshold',          '3.5'),
  ('aptidao_acompanhamento_threshold', '2.5')
ON CONFLICT (key) DO NOTHING;
