import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Web Push notification sender.
 * Called by cron EVERY HOUR. Sends:
 * 1. Devotional reminders (at user's preferred hour)
 * 2. Upcoming event reminders (48h before, at preferred hour)
 * 3. Streak risk alerts (at preferred hour)
 * 4. New pastor messages (at preferred hour)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").replace(/["\s,]/g, "");
    const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get all push subscriptions
    const { data: subscriptions, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subErr) throw subErr;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get notification preferences for all subscribed users
    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const { data: allPrefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const prefsMap = new Map(
      (allPrefs ?? []).map((p: any) => [p.user_id, p])
    );

    // Get all devotional content for pending check
    const { data: allDevotionals } = await supabase
      .from("devotional_content")
      .select("id");
    const totalDevotionals = allDevotionals?.length ?? 0;

    // Get upcoming events (within next 48h)
    const nowUtc = new Date();
    const in48h = new Date(nowUtc.getTime() + 48 * 60 * 60 * 1000);
    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, community, area")
      .gte("event_date", nowUtc.toISOString())
      .lte("event_date", in48h.toISOString());

    // Get recent messages (last 24h)
    const yesterday = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000);
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, title, community, area")
      .gte("created_at", yesterday.toISOString());

    // Get user profiles for community/area matching
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, community, area")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.user_id, p])
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const prefs = prefsMap.get(sub.user_id) as any;
      const profile = profileMap.get(sub.user_id) as any;

      // Skip if master disabled
      if (prefs && !prefs.master_enabled) { skipped++; continue; }

      // Check if current hour matches user's preferred hour
      const tz = prefs?.timezone || "America/Sao_Paulo";
      const preferredHour = prefs?.preferred_hour ?? 7;
      const currentHourInTz = getCurrentHourInTimezone(nowUtc, tz);
      if (currentHourInTz !== preferredHour) { skipped++; continue; }

      const notifications: Array<{ title: string; body: string; tag: string }> = [];

      // 1. Devotional reminder
      const devocionalOn = prefs ? prefs.devocional : true;
      if (devocionalOn) {
        const { data: userProgress } = await supabase
          .from("devotional_progress")
          .select("devotional_id")
          .eq("user_id", sub.user_id);

        const completedCount = userProgress?.length ?? 0;
        const pendingCount = totalDevotionals - completedCount;

        if (pendingCount > 0) {
          notifications.push({
            title: "📖 Hora do Devocional!",
            body: pendingCount === 1
              ? "Você tem 1 devocional esperando. Não perca sua caminhada!"
              : `Você tem ${pendingCount} devocionais pendentes. Cada dia conta!`,
            tag: "daily-devotional",
          });
        }
      }

      // 2. Upcoming events
      const eventosOn = prefs ? prefs.eventos : true;
      if (eventosOn && upcomingEvents && profile) {
        const userEvents = upcomingEvents.filter((e: any) =>
          (e.community === profile.community) ||
          (e.area === profile.area) ||
          (!e.community && !e.area)
        );
        for (const evt of userEvents) {
          const evtDate = new Date(evt.event_date);
          const hoursUntil = Math.round((evtDate.getTime() - nowUtc.getTime()) / (1000 * 60 * 60));
          notifications.push({
            title: "📅 Evento Próximo!",
            body: `"${evt.title}" em ${hoursUntil}h. Não falte!`,
            tag: `event-${evt.id}`,
          });
        }
      }

      // 3. Streak risk
      const streakOn = prefs ? prefs.streak : true;
      if (streakOn) {
        const twoDaysAgo = new Date(nowUtc.getTime() - 2 * 24 * 60 * 60 * 1000);
        const { data: recentDevos } = await supabase
          .from("devotional_progress")
          .select("completed_at")
          .eq("user_id", sub.user_id)
          .gte("completed_at", twoDaysAgo.toISOString())
          .limit(1);

        // If no devotional in 2 days but they have some history, warn
        if ((!recentDevos || recentDevos.length === 0)) {
          const { count } = await supabase
            .from("devotional_progress")
            .select("id", { count: "exact", head: true })
            .eq("user_id", sub.user_id);

          if (count && count > 0) {
            notifications.push({
              title: "🔥 Sua sequência está em risco!",
              body: "Faz 2 dias sem devocional. Não deixe sua caminhada esfriar!",
              tag: "streak-risk",
            });
          }
        }
      }

      // 4. New pastor messages
      const mensagensOn = prefs ? prefs.mensagens : true;
      if (mensagensOn && recentMessages && profile) {
        const userMessages = recentMessages.filter((m: any) =>
          (!m.area && !m.community) ||
          (m.area === profile.area) ||
          (m.community === profile.community)
        );
        if (userMessages.length > 0) {
          const latest = userMessages[0];
          notifications.push({
            title: "💬 Nova Mensagem do Pastor",
            body: latest.title.length > 60 ? latest.title.slice(0, 57) + "..." : latest.title,
            tag: "pastor-message",
          });
        }
      }

      // Send all notifications for this user
      if (notifications.length === 0) { skipped++; continue; }

      for (const notif of notifications) {
        const payload = JSON.stringify({
          title: notif.title,
          body: notif.body,
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          tag: notif.tag,
          data: { url: "/" },
        });

        try {
          await sendWebPush(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
          );
          sent++;
        } catch (err: any) {
          console.error(`Push failed for ${sub.endpoint}:`, err.message);
          failed++;
          if (err.status === 410 || err.status === 404) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      }
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", failedEndpoints);
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        skipped,
        cleaned: failedEndpoints.length,
        total: subscriptions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Push notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getCurrentHourInTimezone(date: Date, tz: string): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(date);
    return parseInt(formatted, 10);
  } catch {
    const utcHour = date.getUTCHours();
    return (utcHour - 3 + 24) % 24;
  }
}

// ─── Web Push implementation using Web Crypto API ───

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
  const encrypted = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encrypted,
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`Push failed: ${response.status} ${text}`);
    (err as any).status = response.status;
    throw err;
  }
  await response.text();
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(
  audience: string,
  publicKey: string,
  privateKeyB64: string
): Promise<string> {
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: now + 12 * 3600,
        sub: "mailto:admin@caminhoboanova.lovable.app",
      })
    )
  );
  const unsignedToken = `${header}.${payload}`;

  // Extract x, y from uncompressed public key (65 bytes: 0x04 || x || y)
  const pubKeyBytes = base64UrlDecode(publicKey);
  const x = base64UrlEncode(pubKeyBytes.slice(1, 33));
  const y = base64UrlEncode(pubKeyBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privateKeyB64, x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  const rawSig = derToRaw(new Uint8Array(signature));
  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  const raw = new Uint8Array(64);
  let offset = 2;
  if (der[offset] !== 0x02) return der;
  offset++;
  const rLen = der[offset++];
  const rStart = offset + (rLen > 32 ? rLen - 32 : 0);
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, offset + rLen), rDest);
  offset += rLen;
  if (der[offset] !== 0x02) return der;
  offset++;
  const sLen = der[offset++];
  const sStart = offset + (sLen > 32 ? sLen - 32 : 0);
  const sDest = 32 + (sLen > 32 ? 0 : 32 - sLen);
  raw.set(der.slice(sStart, offset + sLen), sDest);
  return raw;
}

async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth = base64UrlDecode(authSecret);
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256
    )
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...clientPublicKey,
    ...localPublicKeyRaw,
  ]);
  const ikm = await hkdf(clientAuth, sharedSecret, authInfo, 32);
  const contentEncKeyInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const contentEncKey = await hkdf(salt, ikm, contentEncKeyInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      key,
      paddedPayload
    )
  );
  const recordSize = encrypted.length;
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, recordSize + 86);
  const result = new Uint8Array(
    16 + 4 + 1 + localPublicKeyRaw.length + encrypted.length
  );
  let pos = 0;
  result.set(salt, pos);
  pos += 16;
  result.set(new Uint8Array(rs.buffer), pos);
  pos += 4;
  result[pos++] = localPublicKeyRaw.length;
  result.set(localPublicKeyRaw, pos);
  pos += localPublicKeyRaw.length;
  result.set(encrypted, pos);
  return result;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    salt.length ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const expandKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const output = new Uint8Array(
    await crypto.subtle.sign("HMAC", expandKey, infoWithCounter)
  );
  return output.slice(0, length);
}
