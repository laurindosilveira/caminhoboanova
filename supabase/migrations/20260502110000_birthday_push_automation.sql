INSERT INTO public.push_automation_config (key, title, body, description)
VALUES (
  'birthday_today',
  'Aniversariante do dia!',
  'Hoje e aniversario de {nome}. Envie uma mensagem de carinho!',
  'Enviado uma vez ao dia para todos com push ativo na area do aniversariante'
)
ON CONFLICT (key) DO NOTHING;
