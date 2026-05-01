import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: send-whatsapp-reminders
 *
 * Executa diariamente via cron (sugerido: 20:30 BRT = 23:30 UTC).
 * Verifica 3 tipos de atraso e envia mensagem WhatsApp:
 *   1. devocional_late  â€” sem devocional hoje
 *   2. desafio_late     â€” desafio ativo nÃ£o concluÃ­do perto do prazo
 *   3. checkin_late     â€” sem check-in em evento recente
 *
 * Para cada usuÃ¡rio com whatsapp_enabled=true, valida o nÃºmero em E.164
 * ANTES de enviar. NÃºmeros invÃ¡lidos sÃ£o registrados com status='blocked'
 * e blocked_reason_code padronizado.
 *
 * VariÃ¡veis de ambiente necessÃ¡rias:
 *   WHATSAPP_PROVIDER      = "zapi" | "evolution" | "webhook"
 *   WHATSAPP_API_URL       = URL base do provider
 *   WHATSAPP_API_TOKEN     = token/key de autenticaÃ§Ã£o
 *   WHATSAPP_INSTANCE_ID   = ID da instÃ¢ncia (Z-API e Evolution API)
 *   APP_URL                = URL pÃºblica do app
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// â”€â”€â”€ ValidaÃ§Ã£o E.164 (rÃ©plica TypeScript da funÃ§Ã£o SQL sanitize_phone_br) â”€â”€â”€â”€

const VALID_DDDS = new Set([
  11,12,13,14,15,16,17,18,19,
  21,22,24,27,28,
  31,32,33,34,35,37,38,
  41,42,43,44,45,46,47,48,49,
  51,53,54,55,
  61,62,63,64,65,66,67,68,69,
  71,73,74,75,77,79,
  81,82,83,84,85,86,87,88,89,
  91,92,93,94,95,96,97,98,99,
]);

type ValidateResult =
  | { ok: true; e164: string }
  | { ok: false; code: string; detail: string };

function validateE164(raw: string): ValidateResult {
  if (!raw || raw.trim() === "") {
    return { ok: false, code: "no_number", detail: "NÃºmero nÃ£o informado" };
  }

  let digits = raw.replace(/\D/g, "");

  // Remove prefixo 55 se digitado junto com +11 ou mais dÃ­gitos
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);

  if (digits.length < 10) {
    return {
      ok: false,
      code: "invalid_size",
      detail: `NÃºmero muito curto (${digits.length} dÃ­gitos â€” mÃ­nimo 10)`,
    };
  }
  if (digits.length > 11) {
    return {
      ok: false,
      code: "invalid_size",
      detail: `NÃºmero muito longo (${digits.length} dÃ­gitos â€” mÃ¡ximo 11)`,
    };
  }

  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!VALID_DDDS.has(ddd)) {
    return {
      ok: false,
      code: "invalid_ddd",
      detail: `DDD ${ddd} nÃ£o existe na ANATEL`,
    };
  }

  if (digits.length === 11 && digits[2] !== "9") {
    return {
      ok: false,
      code: "invalid_format",
      detail: `Celular deve ter 9 como primeiro dÃ­gito apÃ³s o DDD (recebido: ${digits[2]})`,
    };
  }

  return { ok: true, e164: `+55${digits}` };
}

// â”€â”€â”€ Tipos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type LogEntry = {
  user_id: string;
  reminder_type: string;
  reference_id?: string;
  phone: string;
  message: string;
  status: "sent" | "failed" | "blocked" | "skipped";
  error_detail?: string;
  blocked_reason_code?: string;
};

// â”€â”€â”€ Handler principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PROVIDER      = (Deno.env.get("WHATSAPP_PROVIDER") ?? "webhook").toLowerCase();
    const API_URL       = Deno.env.get("WHATSAPP_API_URL") ?? "";
    const API_TOKEN     = Deno.env.get("WHATSAPP_API_TOKEN") ?? "";
    const INSTANCE_ID   = Deno.env.get("WHATSAPP_INSTANCE_ID") ?? "";
    const APP_URL       = Deno.env.get("APP_URL") ?? "https://app.caminhoboanova.com";
    const authHeader    = req.headers.get("Authorization") ?? "";
    const body          = await req.json().catch(() => ({}));

    if (!API_URL) {
      return respond({ error: 'WHATSAPP_API_URL nao configurado' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    if (body?.single_resend === true) {
      const authResult = await authorizeAdminOrLeader(SUPABASE_URL, ANON_KEY, authHeader);
      if (!authResult.ok) return respond({ error: authResult.error }, authResult.status);

      const phone = String(body.phone ?? "");
      const message = String(body.message ?? "");
      const validation = validateE164(phone);

      if (!body.user_id || !message) {
        return respond({ ok: false, error: "Payload de reenvio incompleto" }, 400);
      }

      if (!validation.ok) {
        return respond({
          ok: false,
          error: validation.detail,
          code: validation.code,
        }, 400);
      }

      const result = await sendWhatsApp(PROVIDER, API_URL, API_TOKEN, INSTANCE_ID, validation.e164, message);
      return respond({
        ok: result.ok,
        type: "single_resend",
        user_id: body.user_id,
        log_id: body.log_id ?? null,
        phone_e164: validation.e164,
        error: result.error ?? null,
        code: result.ok ? null : "api_error",
      }, result.ok ? 200 : 502);
    }

    if (authHeader !== `Bearer ${SERVICE_KEY}`) {
      return respond({ error: "Unauthorized" }, 401);
    }

    // â”€â”€ ConfiguraÃ§Ãµes editÃ¡veis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: configs } = await supabase
      .from("whatsapp_reminder_config")
      .select("key, enabled, message_template, threshold");

    const configMap = new Map((configs ?? []).map((c: any) => [
      c.key,
      { enabled: c.enabled, template: c.message_template, threshold: c.threshold },
    ]));

    const getConfig = (key: string, defTemplate: string, defThreshold: number) => ({
      enabled:   configMap.get(key)?.enabled   ?? true,
      template:  configMap.get(key)?.template  ?? defTemplate,
      threshold: configMap.get(key)?.threshold ?? defThreshold,
    });

    const devCfg     = getConfig("devocional_late", "OlÃ¡, {nome}! ðŸ“– VocÃª ainda nÃ£o fez o devocional de hoje. Acesse: {app_url}", 20);
    const desafioCfg = getConfig("desafio_late",    "Oi, {nome}! ðŸ’ª O desafio *{desafio}* termina em {dias_restantes} dia(s). Acesse o app!", 2);
    const checkinCfg = getConfig("checkin_late",    "Oi, {nome}! ðŸ“‹ Confirme sua presenÃ§a no *{evento}* de {data_evento} no app!", 1);

    const logs: LogEntry[] = [];
    let sent = 0, failed = 0, blocked = 0, skipped = 0;

    // â”€â”€ Helper: processar um usuÃ¡rio com validaÃ§Ã£o antes do envio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    async function processUser(
      u: { user_id: string; full_name: string; phone: string },
      reminderType: string,
      referenceId: string | undefined,
      message: string
    ) {
      // Dupla validaÃ§Ã£o: a RPC SQL jÃ¡ filtrou invÃ¡lidos, mas validamos aqui
      // tambÃ©m para capturar casos que passarem (ex: nÃºmero alterado apÃ³s RPC)
      const validation = validateE164(u.phone);

      if (!validation.ok) {
        logs.push({
          user_id:             u.user_id,
          reminder_type:       reminderType,
          reference_id:        referenceId,
          phone:               u.phone || "(vazio)",
          message,
          status:              "blocked",
          error_detail:        validation.detail,
          blocked_reason_code: validation.code,
        });
        blocked++;

        // Atualizar status de validaÃ§Ã£o no perfil automaticamente
        await supabase.from("profiles").update({
          whatsapp_validation_status:   "invalid",
          whatsapp_last_blocked_reason: validation.detail,
          whatsapp_last_blocked_at:     new Date().toISOString(),
        }).eq("user_id", u.user_id);

        return;
      }

      const result = await sendWhatsApp(PROVIDER, API_URL, API_TOKEN, INSTANCE_ID, validation.e164, message);
      logs.push({
        user_id:       u.user_id,
        reminder_type: reminderType,
        reference_id:  referenceId,
        phone:         validation.e164,
        message,
        status:        result.ok ? "sent" : "failed",
        error_detail:  result.error,
        blocked_reason_code: result.ok ? undefined : "api_error",
      });
      result.ok ? sent++ : failed++;
    }

    // â”€â”€ 1. DEVOCIONAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (devCfg.enabled) {
      const { data: users } = await supabase.rpc("get_users_late_devotional", {
        threshold_hour: devCfg.threshold,
      });
      for (const u of users ?? []) {
        const msg = devCfg.template
          .replace("{nome}",    firstName(u.full_name))
          .replace("{app_url}", APP_URL);
        await processUser(u, "devocional_late", undefined, msg);
      }
    }

    // â”€â”€ 2. DESAFIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (desafioCfg.enabled) {
      const { data: users } = await supabase.rpc("get_users_late_challenge", {
        days_threshold: desafioCfg.threshold,
      });
      for (const u of users ?? []) {
        const msg = desafioCfg.template
          .replace("{nome}",           firstName(u.full_name))
          .replace("{desafio}",        u.challenge_title)
          .replace("{dias_restantes}", String(Math.max(0, u.days_remaining)));
        await processUser(u, "desafio_late", u.challenge_id, msg);
      }
    }

    // â”€â”€ 3. CHECK-IN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (checkinCfg.enabled) {
      const { data: users } = await supabase.rpc("get_users_late_checkin", {
        days_after: checkinCfg.threshold,
      });
      for (const u of users ?? []) {
        const eventDate = new Date(u.event_date).toLocaleDateString("pt-BR", {
          day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
        });
        const msg = checkinCfg.template
          .replace("{nome}",        firstName(u.full_name))
          .replace("{evento}",      u.event_title)
          .replace("{data_evento}", eventDate);
        await processUser(u, "checkin_late", u.event_id, msg);
      }
    }

    // â”€â”€ Salvar logs em lote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (logs.length > 0) {
      await supabase.from("whatsapp_reminder_log").insert(logs);
    }

    return respond({ sent, failed, blocked, skipped, total: logs.length });

  } catch (err: any) {
    console.error("WhatsApp reminder error:", err);
    return respond({ error: err.message }, 500);
  }
});

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function firstName(fullName: string): string {
  return (fullName ?? "").split(" ")[0] || fullName;
}

type SendResult = { ok: boolean; error?: string };

type AuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function authorizeAdminOrLeader(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
): Promise<AuthResult> {
  if (!authHeader) {
    return { ok: false, status: 401, error: "Missing Authorization header" };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const [admin, leader, superAdmin] = await Promise.all([
    authClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    authClient.rpc("has_role", { _user_id: user.id, _role: "lider" }),
    authClient.rpc("is_super_admin", { _user_id: user.id }),
  ]);

  if (admin.error || leader.error || superAdmin.error) {
    return { ok: false, status: 500, error: "Erro ao validar permissoes" };
  }

  if (!admin.data && !leader.data && !superAdmin.data) {
    return { ok: false, status: 403, error: "Permissao negada" };
  }

  return { ok: true };
}

async function sendWhatsApp(
  provider: string,
  apiUrl: string,
  token: string,
  instanceId: string,
  e164: string,      // sempre formato +55XX... validado antes de chegar aqui
  message: string
): Promise<SendResult> {
  try {
    const phoneDigits = e164.replace("+", "");
    let url: string;
    let body: unknown;
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (provider === "zapi") {
      url  = `${apiUrl}/send-text`;
      body = { phone: phoneDigits, message };
      headers["Client-Token"] = token;
    } else if (provider === "evolution") {
      url  = `${apiUrl}/message/sendText/${instanceId}`;
      body = {
        number: `${phoneDigits}@s.whatsapp.net`,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: message },
      };
      headers["apikey"] = token;
    } else {
      // Webhook genÃ©rico (n8n, Make.com, etc.)
      url  = apiUrl;
      body = { phone: e164, phoneDigits, message, instance: instanceId };
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
