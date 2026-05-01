-- =============================================================================
-- FLUXO DE LEMBRETES VIA WHATSAPP
--
-- Tabelas criadas:
--   1. whatsapp_reminder_config  — templates e thresholds editáveis por admin
--   2. whatsapp_reminder_log     — auditoria / deduplicação de envios
--
-- Colunas adicionadas:
--   notification_preferences: whatsapp_enabled, whatsapp_devocional,
--                             whatsapp_desafio, whatsapp_checkin
--   profiles: whatsapp_number (override do campo phone para o WhatsApp)
--
-- Funções criadas:
--   sanitize_phone_br(text) → text      — formata número brasileiro p/ E.164
--   get_users_late_devotional()         — usuários sem devocional hoje
--   get_users_late_challenge()          — usuários com desafio ativo não concluído
--   get_users_late_checkin()            — usuários sem check-in em eventos recentes
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Campos de preferência WhatsApp em notification_preferences
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_devocional BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_desafio    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_checkin    BOOLEAN NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Número WhatsApp opcional nos perfis
--    (quando vazio a função usa profiles.phone com sanitização automática)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Configuração de lembretes (admin pode editar templates e thresholds)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_config (
  key              TEXT PRIMARY KEY,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  message_template TEXT    NOT NULL,
  -- Para devocional: horas do dia após as quais o lembrete é enviado (default 20h)
  -- Para desafio:    quantos dias antes do fim do desafio enviar lembrete
  -- Para check-in:   quantos dias após o evento sem confirmação enviar lembrete
  threshold        INTEGER NOT NULL DEFAULT 1,
  description      TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_reminder_config ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem (para o app exibir status)
CREATE POLICY "Authenticated can read whatsapp reminder config"
ON public.whatsapp_reminder_config FOR SELECT
TO authenticated USING (true);

-- Apenas admins editam
CREATE POLICY "Admins can manage whatsapp reminder config"
ON public.whatsapp_reminder_config FOR ALL
TO authenticated
USING  (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- Valores padrão dos templates
INSERT INTO public.whatsapp_reminder_config (key, enabled, message_template, threshold, description)
VALUES
  (
    'devocional_late',
    true,
    'Olá, {nome}! 📖 Você ainda não fez o devocional de hoje. Reserve um momentinho para a Palavra de Deus — vai fazer bem! Acesse o app: {app_url}',
    20,  -- enviar se ainda não fez após as 20h
    'Lembrete de devocional não realizado no dia'
  ),
  (
    'desafio_late',
    true,
    'Oi, {nome}! 💪 O desafio *{desafio}* termina em {dias_restantes} dia(s) e você ainda não concluiu. Corra lá no app e complete!',
    2,   -- enviar quando restam 2 dias ou menos
    'Lembrete de desafio próximo do prazo não concluído'
  ),
  (
    'checkin_late',
    true,
    'Oi, {nome}! 📋 Você foi ao *{evento}* de {data_evento}? Confirme sua presença no app para não perder os pontos! 🏆',
    1,   -- dias após o evento para cobrar confirmação
    'Lembrete de check-in não registrado após evento'
  )
ON CONFLICT (key) DO NOTHING;

-- Trigger de updated_at
CREATE TRIGGER update_whatsapp_reminder_config_updated_at
BEFORE UPDATE ON public.whatsapp_reminder_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Log de lembretes enviados (evita duplicatas e serve de auditoria)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_reminder_log (
  id            UUID      NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT      NOT NULL,       -- 'devocional_late' | 'desafio_late' | 'checkin_late'
  reference_id  TEXT,                      -- devotional_id, challenge_id, ou event_id
  phone         TEXT      NOT NULL,
  message       TEXT      NOT NULL,
  status        TEXT      NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed' | 'skipped'
  error_detail  TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para deduplicação rápida
CREATE INDEX IF NOT EXISTS idx_wrl_user_type_ref
  ON public.whatsapp_reminder_log (user_id, reminder_type, reference_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_wrl_sent_at
  ON public.whatsapp_reminder_log (sent_at DESC);

ALTER TABLE public.whatsapp_reminder_log ENABLE ROW LEVEL SECURITY;

-- Usuário vê seus próprios logs; admin vê tudo
CREATE POLICY "Users can view own whatsapp reminder log"
ON public.whatsapp_reminder_log FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Service role can insert whatsapp reminder log"
ON public.whatsapp_reminder_log FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Função: sanitizar número brasileiro para formato E.164
--    Ex: "(47) 99999-9999" → "+5547999999999"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sanitize_phone_br(raw_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits TEXT;
BEGIN
  -- Remover tudo que não é dígito
  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');

  -- Sem dígitos → retorna NULL
  IF length(digits) < 8 THEN RETURN NULL; END IF;

  -- Já tem código do país +55 (12 ou 13 dígitos)
  IF length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN
    RETURN '+' || digits;
  END IF;

  -- 10 ou 11 dígitos = DDD + número (Brasil sem código país)
  IF length(digits) IN (10, 11) THEN
    RETURN '+55' || digits;
  END IF;

  -- 8 ou 9 dígitos = número sem DDD — não podemos corrigir
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sanitize_phone_br(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.sanitize_phone_br(TEXT) TO authenticated;
-- Dar acesso ao service_role para uso na Edge Function
GRANT  EXECUTE ON FUNCTION public.sanitize_phone_br(TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Função: usuários atrasados no devocional
--    Retorna quem tem whatsapp_enabled + whatsapp_devocional E não completou
--    nenhum devocional HOJE (horário BRT). Exclui quem já recebeu lembrete hoje.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_users_late_devotional(threshold_hour INTEGER DEFAULT 20)
RETURNS TABLE(
  user_id   UUID,
  full_name TEXT,
  phone     TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    COALESCE(
      sanitize_phone_br(p.whatsapp_number),
      sanitize_phone_br(p.phone)
    ) AS phone
  FROM public.profiles p
  JOIN public.notification_preferences np ON np.user_id = p.user_id
  WHERE
    -- Usuário optou por receber lembretes WhatsApp de devocional
    np.whatsapp_enabled    = true
    AND np.whatsapp_devocional = true
    -- Passou do horário threshold no Brasil (ex: 20h)
    AND EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') >= threshold_hour
    -- Número disponível
    AND COALESCE(sanitize_phone_br(p.whatsapp_number), sanitize_phone_br(p.phone)) IS NOT NULL
    -- Não completou nenhum devocional hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.devotional_progress dp
      WHERE dp.user_id = p.user_id
        AND dp.completed_at::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )
    -- Não recebeu lembrete de devocional hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_reminder_log wrl
      WHERE wrl.user_id = p.user_id
        AND wrl.reminder_type = 'devocional_late'
        AND wrl.sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
                                      AT TIME ZONE 'America/Sao_Paulo'
        AND wrl.status = 'sent'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_users_late_devotional(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_users_late_devotional(INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Função: usuários com desafio ativo não concluído dentro do threshold
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_users_late_challenge(days_threshold INTEGER DEFAULT 2)
RETURNS TABLE(
  user_id      UUID,
  full_name    TEXT,
  phone        TEXT,
  challenge_id UUID,
  challenge_title TEXT,
  days_remaining  INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.user_id, cc.id)
    p.user_id,
    p.full_name,
    COALESCE(
      sanitize_phone_br(p.whatsapp_number),
      sanitize_phone_br(p.phone)
    ) AS phone,
    cc.id AS challenge_id,
    cc.title AS challenge_title,
    (cc.end_date - (now() AT TIME ZONE 'America/Sao_Paulo')::date)::INTEGER AS days_remaining
  FROM public.profiles p
  JOIN public.notification_preferences np ON np.user_id = p.user_id
  JOIN public.community_challenges cc ON
    -- Desafio pertence à comunidade ou área do usuário
    (cc.community = p.community::text OR cc.area = p.area::text OR (cc.community IS NULL AND cc.area IS NULL))
  WHERE
    np.whatsapp_enabled  = true
    AND np.whatsapp_desafio = true
    AND COALESCE(sanitize_phone_br(p.whatsapp_number), sanitize_phone_br(p.phone)) IS NOT NULL
    -- Desafio ativo (hoje está dentro do período)
    AND cc.start_date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND cc.end_date   >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
    -- Prazo se esgota em até days_threshold dias
    AND (cc.end_date - (now() AT TIME ZONE 'America/Sao_Paulo')::date) <= days_threshold
    -- Usuário não concluiu o desafio
    AND NOT EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.user_id = p.user_id
        AND cp.challenge_id = cc.id
        AND cp.completed = true
    )
    -- Não recebeu lembrete desse desafio hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_reminder_log wrl
      WHERE wrl.user_id = p.user_id
        AND wrl.reminder_type = 'desafio_late'
        AND wrl.reference_id = cc.id::text
        AND wrl.sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
                                       AT TIME ZONE 'America/Sao_Paulo'
        AND wrl.status = 'sent'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_users_late_challenge(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_users_late_challenge(INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Função: usuários sem check-in em eventos recentes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_users_late_checkin(days_after INTEGER DEFAULT 1)
RETURNS TABLE(
  user_id    UUID,
  full_name  TEXT,
  phone      TEXT,
  event_id   UUID,
  event_title TEXT,
  event_date  TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (p.user_id, e.id)
    p.user_id,
    p.full_name,
    COALESCE(
      sanitize_phone_br(p.whatsapp_number),
      sanitize_phone_br(p.phone)
    ) AS phone,
    e.id AS event_id,
    e.title AS event_title,
    e.event_date
  FROM public.profiles p
  JOIN public.notification_preferences np ON np.user_id = p.user_id
  JOIN public.events e ON
    -- Evento pertence à comunidade ou área do usuário
    (e.community = p.community::text OR e.area = p.area::text OR (e.community IS NULL AND e.area IS NULL))
  WHERE
    np.whatsapp_enabled = true
    AND np.whatsapp_checkin = true
    AND COALESCE(sanitize_phone_br(p.whatsapp_number), sanitize_phone_br(p.phone)) IS NOT NULL
    -- Evento ocorreu entre days_after e days_after+1 dias atrás
    AND e.event_date >= now() - (days_after + 1) * INTERVAL '1 day'
    AND e.event_date <  now() - days_after       * INTERVAL '1 day'
    -- Usuário não tem registro de presença (independente do status)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.user_id = p.user_id AND a.event_id = e.id
    )
    -- Não recebeu lembrete desse evento hoje
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_reminder_log wrl
      WHERE wrl.user_id = p.user_id
        AND wrl.reminder_type = 'checkin_late'
        AND wrl.reference_id = e.id::text
        AND wrl.sent_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
                                       AT TIME ZONE 'America/Sao_Paulo'
        AND wrl.status = 'sent'
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_users_late_checkin(INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_users_late_checkin(INTEGER) TO service_role;
