import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: test-notifications
 *
 * Envia uma notificação de teste para o usuário autenticado.
 * Aceita { type: "whatsapp" | "push" } no corpo da requisição.
 *
 * WhatsApp: valida o número cadastrado e envia uma mensagem de teste.
 * Push    : busca as inscrições do usuário e envia um push real via WebPush/VAPID.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── E.164 Validation (mirror of send-whatsapp-reminders) ────────────────────

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
    return { ok: false, code: "no_number", detail: "Número não informado" };
  }
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length < 10) {
    return {
      ok: false, code: "invalid_size",
      detail: `Número muito curto (${digits.length} dígitos — mínimo 10)`,
    };
  }
  if (digits.length > 11) {
    return {
      ok: false, code: "invalid_size",
      detail: `Número muito longo (${digits.length} dígitos — máximo 11)`,
    };
  }
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!VALID_DDDS.has(ddd)) {
    return {
      ok: false, code: "invalid_ddd",
      detail: `DDD ${ddd} não existe na ANATEL. Ex. válidos: 47 (SC), 51 (RS), 11 (SP), 21 (RJ)`,
    };
  }
  if (digits.length === 11 && digits[2] !== "9") {
    return {
      ok: false, code: "invalid_format",
      detail: `Celular deve ter 9 como primeiro dígito após o DDD (recebido: ${digits[2]})`,
    };
  }
  return { ok: true, e164: `+55${digits}` };
}

// ─── WhatsApp sender (mirror of send-whatsapp-reminders) ─────────────────────

type SendResult = { ok: boolean; error?: string };

async function sendWhatsApp(
  provider: string,
  apiUrl: string,
  token: string,
  instanceId: string,
  e164: string,
  message: string,
): Promise<SendResult> {
  try {
    const phoneDigits = e164.replace("+", "");
    let url: string;
    let body: unknown;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

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

// ─── Web Push crypto (mirror of send-push-notifications) ─────────────────────

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad    = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes  = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary   = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  const raw = new Uint8Array(64);
  let offset = 2;
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen   = der[offset++];
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rDest  = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen   = der[offset++];
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sDest  = 32 + (sLen > 32 ? 0 : 32 - sLen);
  raw.set(der.slice(sStart, offset + sLen), sDest);
  return raw;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk  = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const expandKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  return (new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, infoWithCounter))).slice(0, length);
}

async function createVapidJwt(audience: string, publicKey: string, privateKeyB64: string): Promise<string> {
  const header  = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now     = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: "mailto:admin@caminhoboanova.lovable.app" }))
  );
  const unsignedToken = `${header}.${payload}`;
  const pubKeyBytes   = base64UrlDecode(publicKey);
  const x = base64UrlEncode(pubKeyBytes.slice(1, 33));
  const y = base64UrlEncode(pubKeyBytes.slice(33, 65));
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privateKeyB64, x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(derToRaw(new Uint8Array(signature)))}`;
}

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string): Promise<Uint8Array> {
  const payloadBytes      = new TextEncoder().encode(payload);
  const clientPublicKey   = base64UrlDecode(p256dhKey);
  const clientAuth        = base64UrlDecode(authSecret);
  const localKeyPair      = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));
  const clientKey         = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret      = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256));
  const salt              = crypto.getRandomValues(new Uint8Array(16));
  const authInfo          = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...clientPublicKey, ...localPublicKeyRaw]);
  const ikm               = await hkdf(clientAuth, sharedSecret, authInfo, 32);
  const contentEncKey     = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce             = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const key               = await crypto.subtle.importKey("raw", contentEncKey, "AES-GCM", false, ["encrypt"]);
  const paddedPayload     = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;
  const encrypted  = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, paddedPayload));
  const recordSize = encrypted.length;
  const rs         = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, recordSize + 86);
  const result = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length + encrypted.length);
  let pos = 0;
  result.set(salt, pos);                        pos += 16;
  result.set(new Uint8Array(rs.buffer), pos);   pos += 4;
  result[pos++] = localPublicKeyRaw.length;
  result.set(localPublicKeyRaw, pos);           pos += localPublicKeyRaw.length;
  result.set(encrypted, pos);
  return result;
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
) {
  const url      = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
  const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization:      `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type":     "application/octet-stream",
      TTL:                "86400",
      Urgency:            "normal",
    },
    body: encrypted,
  });

  if (!response.ok) {
    const text = await response.text();
    const err  = new Error(`Push failed: ${response.status} ${text}`);
    (err as any).status = response.status;
    throw err;
  }
  await response.text();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Missing Authorization header" }, 401);

    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY      = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return respond({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body     = await req.json().catch(() => ({}));

    // ── WhatsApp test ──────────────────────────────────────────────────────────
    if (body.type === "whatsapp") {
      const PROVIDER    = (Deno.env.get("WHATSAPP_PROVIDER") ?? "webhook").toLowerCase();
      const API_URL     = Deno.env.get("WHATSAPP_API_URL") ?? "";
      const API_TOKEN   = Deno.env.get("WHATSAPP_API_TOKEN") ?? "";
      const INSTANCE_ID = Deno.env.get("WHATSAPP_INSTANCE_ID") ?? "";

      if (!API_URL) {
        return respond({
          ok: false, type: "whatsapp",
          error: "WHATSAPP_API_URL não configurado. Peça ao administrador para configurar as variáveis de ambiente.",
          code:  "no_config",
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, whatsapp_number, phone")
        .eq("user_id", user.id)
        .single();

      const rawPhone = profile?.whatsapp_number || profile?.phone || null;

      if (!rawPhone) {
        return respond({
          ok: false, type: "whatsapp",
          error: "Nenhum número de WhatsApp cadastrado no seu perfil. Adicione em Configurações → Meu Perfil.",
          code:  "no_number",
        });
      }

      const validation = validateE164(rawPhone);
      if (!validation.ok) {
        return respond({
          ok: false, type: "whatsapp",
          phone_raw:  rawPhone,
          phone_e164: null,
          error:      validation.detail,
          code:       validation.code,
        });
      }

      const firstName = (profile?.full_name ?? "").split(" ")[0] || "amigo(a)";
      const message = `👋 Olá, ${firstName}! Este é um teste do app *Caminho Boa Nova*.\n\nSe você recebeu esta mensagem, seu número de WhatsApp está correto e os lembretes automáticos estão configurados! ✅`;

      const result = await sendWhatsApp(PROVIDER, API_URL, API_TOKEN, INSTANCE_ID, validation.e164, message);

      return respond({
        ok:           result.ok,
        type:         "whatsapp",
        phone_raw:    rawPhone,
        phone_e164:   validation.e164,
        message_sent: message,
        error:        result.error ?? null,
        code:         result.ok ? null : "api_error",
      });
    }

    // ── Push test ──────────────────────────────────────────────────────────────
    if (body.type === "push") {
      const VAPID_PUBLIC_KEY  = (Deno.env.get("VAPID_PUBLIC_KEY")  ?? "").replace(/["\s,]/g, "");
      const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return respond({
          ok: false, type: "push",
          subscriptions_found: 0, sent: 0, failed: 0, devices: [],
          error: "Chaves VAPID não configuradas. Peça ao administrador.",
        });
      }

      const { data: subscriptions, error: subErr } = await supabase
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user.id);

      if (subErr) throw subErr;

      if (!subscriptions || subscriptions.length === 0) {
        return respond({
          ok: false, type: "push",
          subscriptions_found: 0, sent: 0, failed: 0, devices: [],
          error: "Nenhuma inscrição push encontrada para este usuário. Ative as notificações nas Configurações.",
        });
      }

      const payload = JSON.stringify({
        title: "🔔 Teste de notificação",
        body:  "Se você está vendo isso, as notificações push estão funcionando!",
        icon:  "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag:   "test-push",
        data:  { url: "/" },
      });

      let sent = 0, failed = 0;
      const devices: Array<{ endpoint_short: string; ok: boolean; error: string | null }> = [];
      const expiredEndpoints: string[] = [];

      for (const sub of subscriptions) {
        const endpointShort = sub.endpoint.slice(-35);
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY,
          );
          sent++;
          devices.push({ endpoint_short: endpointShort, ok: true, error: null });
        } catch (err: any) {
          failed++;
          devices.push({ endpoint_short: endpointShort, ok: false, error: err.message });
          if ((err as any).status === 410 || (err as any).status === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      }

      // Clean up expired subscriptions
      if (expiredEndpoints.length > 0) {
        await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
      }

      return respond({
        ok:                   sent > 0,
        type:                 "push",
        subscriptions_found:  subscriptions.length,
        sent,
        failed,
        devices,
        error:                null,
      });
    }

    return respond({ error: "Campo 'type' deve ser 'whatsapp' ou 'push'" }, 400);

  } catch (err: any) {
    console.error("test-notifications error:", err);
    return respond({ error: err.message }, 500);
  }
});
