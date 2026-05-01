-- =============================================================================
-- CRON: Agendar envio diário de lembretes WhatsApp
--
-- Executa às 23:30 UTC = 20:30 BRT (horário de Brasília)
-- Isso cobre o threshold padrão de devocional (20h BRT).
--
-- IMPORTANTE: a extensão pg_cron precisa estar habilitada.
-- No Supabase Cloud, acesse:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- =============================================================================

-- Remover job anterior se existir (idempotente)
SELECT cron.unschedule('send-whatsapp-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-whatsapp-reminders'
);

-- Agendar: 23:30 UTC todos os dias
SELECT cron.schedule(
  'send-whatsapp-reminders',
  '30 23 * * *',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-whatsapp-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body    := '{}'::jsonb
    );
  $$
);
