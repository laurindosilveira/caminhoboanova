-- ─── Push Automation Config ───────────────────────────────────────────────────
-- Stores editable config for each automated notification type.
CREATE TABLE IF NOT EXISTS public.push_automation_config (
  key         TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read push_automation_config"
ON public.push_automation_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and lideres can edit push_automation_config"
ON public.push_automation_config FOR ALL TO authenticated
USING  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'));

CREATE TRIGGER update_push_automation_config_updated_at
BEFORE UPDATE ON public.push_automation_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.push_automation_config (key, title, body, description) VALUES
  ('devotional_reminder', '📖 Hora do Devocional!',
   'Você tem {N} devocional(is) da semana pendente(s). Cada dia conta!',
   'Enviado no horário preferido do usuário quando há devocionais pendentes na lição ativa'),
  ('streak_risk', '🔥 Sua sequência está em risco!',
   'Faz 2 dias sem devocional. Não deixe sua caminhada esfriar!',
   'Enviado quando o usuário fica 2 ou mais dias sem concluir nenhum devocional'),
  ('pastor_message', '💬 Nova Mensagem do Pastor',
   'Há um novo comunicado esperando por você no app.',
   'Enviado quando uma nova mensagem do pastor é publicada nas últimas 24h'),
  ('event_upcoming', '🔔 Evento em 2 dias!',
   'Não perca: {titulo}. Nos vemos lá!',
   'Enviado automaticamente 2 dias antes de cada evento da área'),
  ('event_attendance', '📋 Confirme sua presença!',
   'O evento já aconteceu. Confirme sua presença ou justifique no app.',
   'Enviado 1 dia após o evento para quem ainda não confirmou presença'),
  ('prayer_pairs', '🙏 Dupla de Oração da Semana',
   'Você foi pareado com alguém especial! Abra o app para ver sua dupla.',
   'Enviado toda segunda-feira com a nova dupla de oração da semana')
ON CONFLICT (key) DO NOTHING;

-- ─── Scheduled Pushes ─────────────────────────────────────────────────────────
-- Manual pushes agendados para envio futuro (processados pelo cron hourly).
CREATE TABLE IF NOT EXISTS public.push_scheduled (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  target       TEXT NOT NULL DEFAULT 'all',
  target_value TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent         BOOLEAN NOT NULL DEFAULT false,
  sent_at      TIMESTAMPTZ,
  sent_count   INTEGER DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_scheduled ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and lideres can manage push_scheduled"
ON public.push_scheduled FOR ALL TO authenticated
USING  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'));
