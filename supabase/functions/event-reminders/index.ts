import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Event Reminders — runs daily via pg_cron.
 * 1. 2 days before event → push with event info
 * 2. 1 day after event → push reminding to confirm attendance or justify absence
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").replace(/["\s,]/g, "");
    const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

    const authResult = await authorizeServiceOrAdminLeader(req, SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY);
    if (!authResult.ok) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Current time in Brazil (UTC-3)
    const nowUtc = new Date();
    const nowBrazil = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = nowBrazil.toISOString().slice(0, 10); // YYYY-MM-DD

    // Calculate target dates
    const twoDaysFromNow = new Date(nowBrazil);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysStr = twoDaysFromNow.toISOString().slice(0, 10);

    const oneDayAgo = new Date(nowBrazil);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoStr = oneDayAgo.toISOString().slice(0, 10);

    // 1. Events happening in 2 days
    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, location, area, community, type")
      .gte("event_date", `${twoDaysStr}T00:00:00`)
      .lte("event_date", `${twoDaysStr}T23:59:59`);

    // 2. Events that happened 1 day ago
    const { data: pastEvents } = await supabase
      .from("events")
      .select("id, title, event_date, area, community, type")
      .gte("event_date", `${oneDayAgoStr}T00:00:00`)
      .lte("event_date", `${oneDayAgoStr}T23:59:59`);

    // Get subscriptions + profiles + prefs
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions", upcoming: upcomingEvents?.length ?? 0, past: pastEvents?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    const [{ data: profiles }, { data: prefs }, { data: attendance }] = await Promise.all([
      supabase.from("profiles").select("user_id, community, area").in("user_id", userIds),
      supabase.from("notification_preferences").select("user_id, master_enabled, eventos").in("user_id", userIds),
      // Get attendance records for past events to know who already confirmed
      pastEvents && pastEvents.length > 0
        ? supabase.from("attendance").select("user_id, event_id").in("event_id", pastEvents.map(e => e.id))
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const prefsMap = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));

    // Build attendance set: "userId-eventId"
    const attendanceSet = new Set(
      (attendance ?? []).map((a: any) => `${a.user_id}-${a.event_id}`)
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const failedEndpoints: string[] = [];

    // Group subscriptions by user
    const subsByUser = new Map<string, any[]>();
    for (const sub of subscriptions) {
      const arr = subsByUser.get(sub.user_id) ?? [];
      arr.push(sub);
      subsByUser.set(sub.user_id, arr);
    }

    for (const [userId, userSubs] of subsByUser) {
      const userPrefs = prefsMap.get(userId) as any;
      const profile = profileMap.get(userId) as any;

      // Skip if master disabled or eventos disabled
      if (userPrefs && !userPrefs.master_enabled) { skipped++; continue; }
      if (userPrefs && userPrefs.eventos === false) { skipped++; continue; }
      if (!profile) { skipped++; continue; }

      const notifications: Array<{ title: string; body: string; tag: string }> = [];

      // --- Upcoming events (2 days before) ---
      if (upcomingEvents && upcomingEvents.length > 0) {
        const relevant = upcomingEvents.filter((e: any) =>
          (!e.area && !e.community) ||
          (e.area === profile.area) ||
          (e.community === profile.community)
        );
        for (const evt of relevant) {
          const evtDate = new Date(evt.event_date);
          const hours = evtDate.getHours().toString().padStart(2, "0");
          const mins = evtDate.getMinutes().toString().padStart(2, "0");
          const dayNum = evtDate.getDate();
          const month = evtDate.toLocaleDateString("pt-BR", { month: "short" });

          const typeLabels: Record<string, string> = {
            encontro: "Encontro", culto: "Culto", jemiac: "JEMIAC",
            retiro: "Retiro", confirmatorio: "Ens. Confirmatório", evento: "Evento",
          };
          const typeLabel = typeLabels[evt.type] ?? evt.type;

          let bodyText = `📅 ${typeLabel}: "${evt.title}" — ${dayNum} de ${month} às ${hours}:${mins}`;
          if (evt.location) bodyText += ` 📍 ${evt.location}`;

          notifications.push({
            title: "🔔 Evento em 2 dias!",
            body: bodyText,
            tag: `event-reminder-${evt.id}`,
          });
        }
      }

      // --- Past events (1 day after — attendance reminder) ---
      if (pastEvents && pastEvents.length > 0) {
        const relevant = pastEvents.filter((e: any) =>
          (!e.area && !e.community) ||
          (e.area === profile.area) ||
          (e.community === profile.community)
        );
        for (const evt of relevant) {
          // Only send if user hasn't confirmed attendance yet
          if (!attendanceSet.has(`${userId}-${evt.id}`)) {
            notifications.push({
              title: "📋 Confirme sua presença!",
              body: `O evento "${evt.title}" já aconteceu. Confirme sua presença ou justifique sua falta no app.`,
              tag: `attendance-reminder-${evt.id}`,
            });
          }
        }
      }

      if (notifications.length === 0) { skipped++; continue; }

      // Send to all devices of this user
      for (const sub of userSubs) {
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
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
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
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints);
    }

    // Log the dispatch
    if (sent > 0 || failed > 0) {
      const logEntries: any[] = [];
      if ((upcomingEvents?.length ?? 0) > 0) {
        logEntries.push({
          type: "event_reminder",
          title: "🔔 Evento em 2 dias!",
          body: `Lembrete automático para ${upcomingEvents!.length} evento(s)`,
          target: "auto",
          sent_count: sent,
          failed_count: failed,
        });
      }
      if ((pastEvents?.length ?? 0) > 0) {
        logEntries.push({
          type: "attendance_reminder",
          title: "📋 Confirme sua presença!",
          body: `Lembrete de presença para ${pastEvents!.length} evento(s)`,
          target: "auto",
          sent_count: sent,
          failed_count: failed,
        });
      }
      if (logEntries.length > 0) {
        await supabase.from("push_notification_log").insert(logEntries);
      }
    }

    return new Response(
      JSON.stringify({
        sent, failed, skipped,
        cleaned: failedEndpoints.length,
        upcomingEvents: upcomingEvents?.length ?? 0,
        pastEvents: pastEvents?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Event reminders error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Web Push implementation (same as send-push-notifications) ───

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string, vapidPublicKey: string, vapidPrivateKey: string
) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
  const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

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

async function createVapidJwt(audience: string, publicKey: string, privateKeyB64: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: "mailto:admin@caminhoboanova.lovable.app" }))
  );
  const unsignedToken = `${header}.${payload}`;
  const pubKeyBytes = base64UrlDecode(publicKey);
  const x = base64UrlEncode(pubKeyBytes.slice(1, 33));
  const y = base64UrlEncode(pubKeyBytes.slice(33, 65));
  const key = await crypto.subtle.importKey(
    "jwk", { kty: "EC", crv: "P-256", d: privateKeyB64, x, y },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsignedToken));
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

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string): Promise<Uint8Array> {
  const payloadBytes = new TextEncoder().encode(payload);
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth = base64UrlDecode(authSecret);
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...clientPublicKey, ...localPublicKeyRaw]);
  const ikm = await hkdf(clientAuth, sharedSecret, authInfo, 32);
  const contentEncKeyInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const contentEncKey = await hkdf(salt, ikm, contentEncKeyInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  const key = await crypto.subtle.importKey("raw", contentEncKey, "AES-GCM", false, ["encrypt"]);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, paddedPayload));
  const recordSize = encrypted.length;
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, recordSize + 86);
  const result = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length + encrypted.length);
  let pos = 0;
  result.set(salt, pos); pos += 16;
  result.set(new Uint8Array(rs.buffer), pos); pos += 4;
  result[pos++] = localPublicKeyRaw.length;
  result.set(localPublicKeyRaw, pos); pos += localPublicKeyRaw.length;
  result.set(encrypted, pos);
  return result;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
  const expandKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, infoWithCounter));
  return output.slice(0, length);
}

async function authorizeServiceOrAdminLeader(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader === `Bearer ${serviceRoleKey}`) return { ok: true };
  if (!authHeader) return { ok: false, status: 401, error: "Missing Authorization header" };

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await anonClient.auth.getUser();
  if (error || !user) return { ok: false, status: 401, error: "Unauthorized" };

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const [{ data: isAdmin }, { data: isLeader }] = await Promise.all([
    adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    adminClient.rpc("has_role", { _user_id: user.id, _role: "lider" }),
  ]);

  if (isAdmin === true || isLeader === true) return { ok: true };
  return { ok: false, status: 403, error: "Forbidden" };
}
