import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Web Push notification sender.
 * Called by cron EVERY HOUR. Sends:
 * 1. Devotional reminders — counts pending devotionals of the ACTIVE LESSON only
 * 2. Upcoming event reminders (48h before, at preferred hour)
 * 3. Streak risk alerts (no devotional for 2+ days)
 * 4. New pastor messages
 * Also processes any push_scheduled rows that are due.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY   = (Deno.env.get("VAPID_PUBLIC_KEY")  ?? "").replace(/["\s,]/g, "");
    const VAPID_PRIVATE_KEY  = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

    if (req.headers.get("Authorization") !== `Bearer ${SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── 1. Fetch all push subscriptions ──────────────────────────────────────
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

    const userIds = [...new Set(subscriptions.map((s: any) => s.user_id))];

    // ── 2. Pre-fetch all supporting data (outside the per-user loop) ──────────

    // Notification prefs
    const { data: allPrefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .in("user_id", userIds);
    const prefsMap = new Map((allPrefs ?? []).map((p: any) => [p.user_id, p]));

    // Devotional content: id → lesson_id, lesson_id → Set<devId>
    const { data: allDevContent } = await supabase
      .from("devotional_content")
      .select("id, lesson_id");
    const devToLesson  = new Map<string, string>();
    const lessonToDevs = new Map<string, Set<string>>();
    for (const d of allDevContent ?? []) {
      devToLesson.set(d.id, d.lesson_id);
      if (!lessonToDevs.has(d.lesson_id)) lessonToDevs.set(d.lesson_id, new Set());
      lessonToDevs.get(d.lesson_id)!.add(d.id);
    }

    // All devotional progress for subscribed users (desc → first entry = most recent)
    const { data: allDevProgress } = await supabase
      .from("devotional_progress")
      .select("user_id, devotional_id, completed_at")
      .in("user_id", userIds)
      .order("completed_at", { ascending: false });

    // Build per-user devotional state
    type UserDevState = {
      completedIds:   Set<string>;
      mostRecentDevId: string | null;
      mostRecentAt:    Date | null;
    };
    const userDevData = new Map<string, UserDevState>();
    for (const uid of userIds) {
      userDevData.set(uid, { completedIds: new Set(), mostRecentDevId: null, mostRecentAt: null });
    }
    for (const dp of allDevProgress ?? []) {
      const ud = userDevData.get(dp.user_id);
      if (!ud) continue;
      ud.completedIds.add(dp.devotional_id);
      if (!ud.mostRecentDevId) {
        ud.mostRecentDevId = dp.devotional_id;
        ud.mostRecentAt    = new Date(dp.completed_at);
      }
    }

    // Push automation config (editable by admins/lideres)
    const { data: automationConfigs } = await supabase
      .from("push_automation_config")
      .select("key, title, body, enabled");
    const automMap = new Map<string, { title: string; body: string; enabled: boolean }>(
      (automationConfigs ?? []).map((c: any) => [c.key, c])
    );
    const getAutom = (key: string, defTitle: string, defBody: string) => ({
      title:   automMap.get(key)?.title   ?? defTitle,
      body:    automMap.get(key)?.body    ?? defBody,
      enabled: automMap.get(key)?.enabled ?? true,
    });

    // Upcoming events (next 48h)
    const nowUtc = new Date();
    const in48h  = new Date(nowUtc.getTime() + 48 * 60 * 60 * 1000);
    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, event_date, community, area")
      .gte("event_date", nowUtc.toISOString())
      .lte("event_date", in48h.toISOString());

    // Recent messages (last 24h)
    const yesterday = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000);
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, title, community, area")
      .gte("created_at", yesterday.toISOString());

    // User profiles for community/area matching and birthday automation.
    // Some production databases have not received enrollment_status yet, so retry
    // without it instead of breaking the whole notification run.
    let { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, community, area, birth_date, enrollment_status");
    if (profilesError?.message?.includes("enrollment_status")) {
      const retry = await supabase
        .from("profiles")
        .select("user_id, full_name, community, area, birth_date");
      profiles = retry.data;
      profilesError = retry.error;
    }
    if (profilesError) throw profilesError;
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

    const brtParts = getDatePartsInTimezone(nowUtc, "America/Sao_Paulo");
    const birthdayCfg = getAutom(
      "birthday_today",
      "Aniversariante do dia!",
      "Hoje e aniversario de {nome}. Envie uma mensagem de carinho!"
    );
    const birthdayAutomationOn = birthdayCfg.enabled && brtParts.hour >= 8;
    const birthdaysToday = birthdayAutomationOn
      ? (profiles ?? []).filter((p: any) => {
          if (!p.birth_date || !p.area) return false;
          if (p.enrollment_status && p.enrollment_status !== "approved") return false;
          const birthday = parseDateOnly(p.birth_date);
          return birthday.month === brtParts.month && birthday.day === brtParts.day;
        })
      : [];
    const birthdaysByArea = new Map<string, any[]>();
    for (const birthday of birthdaysToday) {
      if (!birthdaysByArea.has(birthday.area)) birthdaysByArea.set(birthday.area, []);
      birthdaysByArea.get(birthday.area)!.push(birthday);
    }
    const { data: existingBirthdayLogs } = birthdayAutomationOn
      ? await supabase
          .from("push_notification_log")
          .select("target_value")
          .eq("type", "birthday")
          .like("target_value", `%|${brtParts.date}|%`)
      : { data: [] as any[] };
    const existingBirthdayLogKeys = new Set((existingBirthdayLogs ?? []).map((log: any) => log.target_value));
    const birthdayLogStats = new Map<string, { title: string; body: string; area: string; sent: number; failed: number }>();

    let sent = 0, failed = 0, skipped = 0;
    const failedEndpoints: string[] = [];

    // ── 3. Per-user notification logic ───────────────────────────────────────
    for (const sub of subscriptions) {
      const prefs   = prefsMap.get(sub.user_id) as any;
      const profile = profileMap.get(sub.user_id) as any;

      // Skip if master disabled
      if (prefs && !prefs.master_enabled) { skipped++; continue; }

      // Only send at user's preferred hour
      const tz            = prefs?.timezone || "America/Sao_Paulo";
      const preferredHour = prefs?.preferred_hour ?? 7;
      const currentHourInTz = getCurrentHourInTimezone(nowUtc, tz);
      const isPreferredHour = currentHourInTz === preferredHour;

      const notifications: Array<{ title: string; body: string; tag: string; birthdayLogKey?: string }> = [];

      // ── 3b. Upcoming events ────────────────────────────────────────────────
      const eventosOn = prefs ? prefs.eventos : true;
      if (isPreferredHour && eventosOn && upcomingEvents && profile) {
        const userEvents = upcomingEvents.filter((e: any) =>
          (e.community === profile.community) ||
          (e.area === profile.area) ||
          (!e.community && !e.area)
        );
        for (const evt of userEvents) {
          const hoursUntil = Math.round(
            (new Date(evt.event_date).getTime() - nowUtc.getTime()) / (1000 * 60 * 60)
          );
          notifications.push({
            title: "📅 Evento Próximo!",
            body:  `"${evt.title}" em ${hoursUntil}h. Não falte!`,
            tag:   `event-${evt.id}`,
          });
        }
      }

      // ── 3c. Streak risk (uses precomputed data — no extra DB query) ─────────
      const streakOn  = prefs ? prefs.streak : true;
      const streakCfg = getAutom("streak_risk", "🔥 Sua sequência está em risco!", "Faz 2 dias sem devocional. Não deixe sua caminhada esfriar!");
      if (isPreferredHour && streakOn && streakCfg.enabled) {
        const twoDaysAgo = new Date(nowUtc.getTime() - 2 * 24 * 60 * 60 * 1000);
        const ud = userDevData.get(sub.user_id);
        if (ud && ud.completedIds.size > 0 && ud.mostRecentAt && ud.mostRecentAt < twoDaysAgo) {
          notifications.push({
            title: streakCfg.title,
            body:  streakCfg.body,
            tag:   "streak-risk",
          });
        }
      }

      // ── 3d. New pastor messages ────────────────────────────────────────────
      const mensagensOn = prefs ? prefs.mensagens : true;
      const msgCfg = getAutom("pastor_message", "💬 Nova Mensagem do Pastor", "");
      if (isPreferredHour && mensagensOn && msgCfg.enabled && recentMessages && profile) {
        const userMessages = recentMessages.filter((m: any) =>
          (!m.area && !m.community) ||
          (m.area === profile.area) ||
          (m.community === profile.community)
        );
        if (userMessages.length > 0) {
          const latest   = userMessages[0];
          const bodyText = msgCfg.body ||
            (latest.title.length > 60 ? latest.title.slice(0, 57) + "..." : latest.title);
          notifications.push({
            title: msgCfg.title,
            body:  bodyText,
            tag:   "pastor-message",
          });
        }
      }

      // Birthday greetings are sent once per birthday/day to everyone in that area.
      if (birthdayAutomationOn && profile?.area) {
        const areaBirthdays = birthdaysByArea.get(profile.area) ?? [];
        for (const birthday of areaBirthdays) {
          const birthdayLogKey = `${birthday.area}|${brtParts.date}|${birthday.user_id}`;
          if (existingBirthdayLogKeys.has(birthdayLogKey)) continue;

          const title = birthdayCfg.title
            .replaceAll("{nome}", birthday.full_name)
            .replaceAll("{area}", birthday.area);
          const body = birthdayCfg.body
            .replaceAll("{nome}", birthday.full_name)
            .replaceAll("{area}", birthday.area);

          notifications.push({
            title,
            body,
            tag: `birthday-${brtParts.date}-${birthday.user_id}`,
            birthdayLogKey,
          });

          if (!birthdayLogStats.has(birthdayLogKey)) {
            birthdayLogStats.set(birthdayLogKey, { title, body, area: birthday.area, sent: 0, failed: 0 });
          }
        }
      }

      if (notifications.length === 0) { skipped++; continue; }

      // Send all notifications for this user
      for (const notif of notifications) {
        const payload = JSON.stringify({
          title:  notif.title,
          body:   notif.body,
          icon:   "/pwa-192x192.png",
          badge:  "/pwa-192x192.png",
          tag:    notif.tag,
          data:   { url: "/" },
        });
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
          );
          sent++;
          if (notif.birthdayLogKey) {
            const stat = birthdayLogStats.get(notif.birthdayLogKey);
            if (stat) stat.sent++;
          }
        } catch (err: any) {
          console.error(`Push failed for ${sub.endpoint}:`, err.message);
          failed++;
          if (notif.birthdayLogKey) {
            const stat = birthdayLogStats.get(notif.birthdayLogKey);
            if (stat) stat.failed++;
          }
          if (err.status === 410 || err.status === 404) failedEndpoints.push(sub.endpoint);
        }
      }
    }

    // ── 4. Clean up expired subscriptions ────────────────────────────────────
    if (failedEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints);
    }

    const birthdayLogEntries = [...birthdayLogStats.entries()]
      .filter(([key]) => !existingBirthdayLogKeys.has(key))
      .map(([key, stat]) => ({
        type: "birthday",
        title: stat.title,
        body: stat.body,
        target: "area",
        target_value: key,
        sent_count: stat.sent,
        failed_count: stat.failed,
      }));

    if (birthdayLogEntries.length > 0) {
      await supabase.from("push_notification_log").insert(birthdayLogEntries);
    }

    // ── 5. Process scheduled pushes that are now due ──────────────────────────
    const { data: pendingScheduled } = await supabase
      .from("push_scheduled")
      .select("*")
      .lte("scheduled_at", nowUtc.toISOString())
      .eq("sent", false);

    for (const sched of pendingScheduled ?? []) {
      try {
        const { data: sendResult } = await supabase.functions.invoke("admin-push", {
          headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          body: {
            title:       sched.title,
            body:        sched.body,
            target:      sched.target,
            targetValue: sched.target_value ?? undefined,
          },
        });
        await supabase
          .from("push_scheduled")
          .update({
            sent:       true,
            sent_at:    nowUtc.toISOString(),
            sent_count: sendResult?.sent ?? 0,
          })
          .eq("id", sched.id);
        console.log(`Scheduled push sent: "${sched.title}" → ${sendResult?.sent ?? 0} devices`);
      } catch (schedErr: any) {
        console.error("Scheduled push error:", schedErr.message);
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        skipped,
        cleaned:   failedEndpoints.length,
        birthdays: birthdayLogEntries.length,
        scheduled: (pendingScheduled ?? []).length,
        total:     subscriptions.length,
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
    return (date.getUTCHours() - 3 + 24) % 24;
  }
}

// ─── Web Push implementation using Web Crypto API ────────────────────────────

function getDatePartsInTimezone(date: Date, tz: string): { date: string; month: number; day: number; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    return {
      date: `${year}-${month}-${day}`,
      month: Number(month),
      day: Number(day),
      hour: Number(get("hour")),
    };
  } catch {
    const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const month = brt.getUTCMonth() + 1;
    const day = brt.getUTCDate();
    return {
      date: `${brt.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      month,
      day,
      hour: brt.getUTCHours(),
    };
  }
}

function parseDateOnly(date: string): { month: number; day: number } {
  const [, month, day] = date.split("-").map(Number);
  return { month, day };
}

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const url      = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
  const encrypted = await encryptPayload(payload, subscription.keys.p256dh, subscription.keys.auth);

  const response = await fetch(subscription.endpoint, {
    method:  "POST",
    headers: {
      Authorization:    `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type":   "application/octet-stream",
      TTL:              "86400",
      Urgency:          "normal",
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
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(derToRaw(new Uint8Array(signature)))}`;
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

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string): Promise<Uint8Array> {
  const payloadBytes    = new TextEncoder().encode(payload);
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth      = base64UrlDecode(authSecret);
  const localKeyPair    = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeyPair.privateKey, 256));
  const salt     = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...clientPublicKey, ...localPublicKeyRaw]);
  const ikm      = await hkdf(clientAuth, sharedSecret, authInfo, 32);
  const contentEncKey = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce         = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", contentEncKey, "AES-GCM", false, ["encrypt"]);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;
  const encrypted  = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, paddedPayload));
  const recordSize = encrypted.length;
  const rs         = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, recordSize + 86);
  const result = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length + encrypted.length);
  let pos = 0;
  result.set(salt, pos);           pos += 16;
  result.set(new Uint8Array(rs.buffer), pos); pos += 4;
  result[pos++] = localPublicKeyRaw.length;
  result.set(localPublicKeyRaw, pos); pos += localPublicKeyRaw.length;
  result.set(encrypted, pos);
  return result;
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
