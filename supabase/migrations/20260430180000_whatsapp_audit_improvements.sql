-- =============================================================================
-- AUDITORIA WHATSAPP: melhorias no log e RPC de reenvio
-- =============================================================================

-- ── 1. Adicionar colunas de auditoria ao log ──────────────────────────────────
ALTER TABLE public.whatsapp_reminder_log
  ADD COLUMN IF NOT EXISTS blocked_reason_code TEXT DEFAULT NULL,
  -- Códigos padronizados: no_number | invalid_format | missing_ddi | invalid_size
  -- | invalid_ddd | whatsapp_disabled | api_error | unknown
  ADD COLUMN IF NOT EXISTS is_resent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Status 'blocked' para quando o número existe mas é inválido (distingue de 'skipped')
-- O CHECK do status original não incluía 'blocked' — recriar sem constraint restritiva
-- (o status já era TEXT sem CHECK, então só documentamos os valores usados)

-- Índice para filtrar por status e código rapidamente no admin
CREATE INDEX IF NOT EXISTS idx_wrl_status_code
  ON public.whatsapp_reminder_log (status, blocked_reason_code, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_wrl_user_status
  ON public.whatsapp_reminder_log (user_id, status, sent_at DESC);

-- ── 2. RPC: reenviar lembrete específico para um usuário ──────────────────────
-- Admins/líderes chamam após corrigir o número do usuário.
-- Valida o número no banco antes de retornar o payload para o admin enviar.
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_resend(
  _target_user_id UUID,
  _reminder_type  TEXT,
  _reference_id   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _raw_phone   TEXT;
  _e164        TEXT;
  _full_name   TEXT;
  _reason_code TEXT;
  _log_id      UUID;
BEGIN
  -- Permissão
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'lider'::app_role)
       OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Buscar dados do usuário
  SELECT
    full_name,
    COALESCE(NULLIF(whatsapp_number, ''), phone)
  INTO _full_name, _raw_phone
  FROM public.profiles
  WHERE user_id = _target_user_id;

  IF _raw_phone IS NULL OR trim(_raw_phone) = '' THEN
    _reason_code := 'no_number';
    RETURN json_build_object(
      'can_send', false,
      'reason_code', _reason_code,
      'reason_text', 'Usuário não tem número cadastrado',
      'e164', NULL
    );
  END IF;

  _e164 := sanitize_phone_br(_raw_phone);

  IF _e164 IS NULL THEN
    -- Diagnóstico do código
    DECLARE
      _digits TEXT := regexp_replace(_raw_phone, '[^0-9]', '', 'g');
    BEGIN
      IF length(_digits) < 10 THEN
        _reason_code := 'invalid_size';
      ELSIF length(_digits) > 13 THEN
        _reason_code := 'invalid_size';
      ELSIF NOT left(_digits, 2) ~ '^[1-9][1-9]$' THEN
        _reason_code := 'invalid_ddd';
      ELSE
        _reason_code := 'invalid_format';
      END IF;
    END;

    RETURN json_build_object(
      'can_send', false,
      'reason_code', _reason_code,
      'reason_text', CASE _reason_code
        WHEN 'invalid_size'   THEN 'Número com tamanho incorreto (deve ter 10 ou 11 dígitos após o DDD)'
        WHEN 'invalid_ddd'    THEN 'DDD inválido — verifique os 2 primeiros dígitos'
        ELSE 'Formato inválido — número não reconhecido como telefone brasileiro'
      END,
      'e164', NULL,
      'phone_raw', _raw_phone
    );
  END IF;

  -- Registrar o reenvio no log
  INSERT INTO public.whatsapp_reminder_log (
    user_id, reminder_type, reference_id, phone, message, status, is_resent, resent_at, resent_by
  ) VALUES (
    _target_user_id, _reminder_type, _reference_id,
    _e164, '[REENVIO SOLICITADO PELO ADMIN]', 'pending',
    true, now(), auth.uid()
  )
  RETURNING id INTO _log_id;

  RETURN json_build_object(
    'can_send',   true,
    'reason_code', NULL,
    'e164',        _e164,
    'full_name',   _full_name,
    'log_id',      _log_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_whatsapp_resend(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.prepare_whatsapp_resend(UUID, TEXT, TEXT) TO authenticated;

-- ── 3. RPC: marcar log de reenvio como enviado/falho ─────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_whatsapp_resend(
  _log_id UUID,
  _success BOOLEAN,
  _error   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'lider'::app_role)
       OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  UPDATE public.whatsapp_reminder_log
  SET
    status       = CASE WHEN _success THEN 'sent' ELSE 'failed' END,
    error_detail = _error,
    resent_at    = now()
  WHERE id = _log_id AND is_resent = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_whatsapp_resend(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_whatsapp_resend(UUID, BOOLEAN, TEXT) TO authenticated;

-- ── 4. RLS: permitir insert de serviço e resend pelo admin ────────────────────
DROP POLICY IF EXISTS "Service role can insert whatsapp reminder log" ON public.whatsapp_reminder_log;

CREATE POLICY "Admins can insert whatsapp reminder log"
ON public.whatsapp_reminder_log FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
  OR is_super_admin(auth.uid())
);

-- Admins podem atualizar (para confirmar reenvio)
CREATE POLICY "Admins can update whatsapp reminder log"
ON public.whatsapp_reminder_log FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);
