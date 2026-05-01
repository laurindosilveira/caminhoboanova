import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").replace(/["\s,]/g, "");
    const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

    // Verify caller is admin/lider
    const authHeader = req.headers.get("Authorization");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    let callerId: string | null = null;

    if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
      callerId = null;
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseUser.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = user.id;

      // Check role using service role client
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "lider"]);

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, target, targetValue } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get target user IDs based on filter
    let targetUserIds: string[] = [];

    if (target === "all") {
      // For "all", just get all subscriptions directly
      const { data: allSubs } = await supabase.from("push_subscriptions").select("user_id");
      targetUserIds = [...new Set((allSubs ?? []).map((d: any) => d.user_id))];
      console.log(`Target=all, found ${targetUserIds.length} unique users with subscriptions`);
    } else if (target === "area" && targetValue) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("area", targetValue);
      targetUserIds = (profiles ?? []).map((p: any) => p.user_id);
      console.log(`Target=area(${targetValue}), found ${targetUserIds.length} profiles`);
    } else if (target === "community" && targetValue) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("community", targetValue);
      targetUserIds = (profiles ?? []).map((p: any) => p.user_id);
      console.log(`Target=community(${targetValue}), found ${targetUserIds.length} profiles`);
    } else if (target === "turma" && targetValue) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("turma_id", targetValue);
      targetUserIds = (profiles ?? []).map((p: any) => p.user_id);
      console.log(`Target=turma(${targetValue}), found ${targetUserIds.length} profiles`);
    } else if (target === "user" && targetValue) {
      targetUserIds = [targetValue];
      console.log(`Target=user(${targetValue})`);
    }

    if (targetUserIds.length === 0) {
      console.log("No target users found, returning 0");
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No users found for target" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get subscriptions for target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    console.log(`Found ${subscriptions?.length ?? 0} subscriptions for ${targetUserIds.length} users`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: "No subscriptions for target" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check notification preferences - only send to users with mensagens enabled
    const subUserIds = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const { data: allPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id, master_enabled, mensagens")
      .in("user_id", subUserIds);

    const prefsMap = new Map((allPrefs ?? []).map((p: any) => [p.user_id, p]));

    let sent = 0;
    let failed = 0;
    const failedEndpoints: string[] = [];

    console.log(`VAPID_PUBLIC_KEY length: ${VAPID_PUBLIC_KEY.length}, VAPID_PRIVATE_KEY length: ${VAPID_PRIVATE_KEY.length}`);

    for (const sub of subscriptions) {
      const prefs = prefsMap.get(sub.user_id) as any;
      if (prefs && (!prefs.master_enabled || !prefs.mensagens)) {
        console.log(`Skipping user ${sub.user_id} - prefs disabled`);
        continue;
      }

      const payload = JSON.stringify({
        title,
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: "admin-push-" + Date.now(),
        data: { url: "/" },
      });

      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        );
        sent++;
        console.log(`Push sent OK to ${sub.endpoint.slice(-20)}`);
      } catch (err: any) {
        failed++;
        console.error(`Push FAILED to ${sub.endpoint.slice(-20)}: status=${err.status} message=${err.message}`);
        if (err.status === 410 || err.status === 404) {
          failedEndpoints.push(sub.endpoint);
        }
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints);
    }

    // Log the dispatch
    await supabase.from("push_notification_log").insert({
      type: "manual",
      title,
      body,
      target: target || "all",
      target_value: targetValue || null,
      sent_count: sent,
      failed_count: failed,
      sent_by: callerId,
    });

    return new Response(
      JSON.stringify({ sent, failed, cleaned: failedEndpoints.length, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Admin push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Web Push crypto (same as send-push-notifications) ───

async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
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
      Urgency: "high",
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

  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsignedToken));
  const rawSig = derToRaw(new Uint8Array(signature));
  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

// buildPkcs8 no longer needed

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
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, encrypted.length + 86);
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
