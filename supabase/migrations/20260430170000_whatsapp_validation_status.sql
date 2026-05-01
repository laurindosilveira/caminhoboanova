-- =============================================================================
-- Colunas de status de validação WhatsApp no profiles
--
-- whatsapp_validation_status  — 'valid' | 'invalid' | 'pending' | NULL
-- whatsapp_last_blocked_reason — motivo do bloqueio em texto legível
-- whatsapp_last_blocked_at     — quando foi marcado como bloqueado/revalidado
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_validation_status  TEXT        DEFAULT NULL
    CHECK (whatsapp_validation_status IN ('valid', 'invalid', 'pending', NULL::text)),
  ADD COLUMN IF NOT EXISTS whatsapp_last_blocked_reason TEXT       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_last_blocked_at     TIMESTAMPTZ DEFAULT NULL;

-- Índice para o admin filtrar usuários com número inválido rapidamente
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_status
  ON public.profiles (whatsapp_validation_status)
  WHERE whatsapp_validation_status IS NOT NULL;

-- RPC: admin revalida o número WhatsApp de um usuário
-- Retorna: { status, e164, reason }
CREATE OR REPLACE FUNCTION public.revalidate_user_whatsapp(_target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _raw_phone  TEXT;
  _e164       TEXT;
  _status     TEXT;
  _reason     TEXT;
BEGIN
  -- Apenas admins e super admins podem revalidar
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Buscar número: whatsapp_number tem prioridade sobre phone
  SELECT
    COALESCE(NULLIF(whatsapp_number, ''), phone)
  INTO _raw_phone
  FROM public.profiles
  WHERE user_id = _target_user_id;

  IF _raw_phone IS NULL OR trim(_raw_phone) = '' THEN
    _status := 'invalid';
    _reason := 'Número não informado no perfil';
  ELSE
    _e164 := sanitize_phone_br(_raw_phone);
    IF _e164 IS NOT NULL THEN
      _status := 'valid';
      _reason := NULL;
    ELSE
      _status := 'invalid';
      -- Diagnóstico básico do motivo
      DECLARE
        _digits TEXT := regexp_replace(_raw_phone, '[^0-9]', '', 'g');
      BEGIN
        IF length(_digits) < 10 THEN
          _reason := 'Número com menos de 10 dígitos';
        ELSIF length(_digits) > 13 THEN
          _reason := 'Número muito longo';
        ELSE
          _reason := 'Formato inválido (DDD ou dígitos incorretos)';
        END IF;
      END;
    END IF;
  END IF;

  -- Persistir resultado
  UPDATE public.profiles
  SET
    whatsapp_validation_status  = _status,
    whatsapp_last_blocked_reason = _reason,
    whatsapp_last_blocked_at     = CASE WHEN _status = 'invalid' THEN now() ELSE NULL END
  WHERE user_id = _target_user_id;

  RETURN json_build_object(
    'status', _status,
    'e164',   _e164,
    'reason', _reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revalidate_user_whatsapp(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revalidate_user_whatsapp(UUID) TO authenticated;
