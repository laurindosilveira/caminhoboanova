import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Sends a push notification to the author of the original message
 * when someone replies in the chat.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").replace(/["\s,]/g, "");
    const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/["\s,]/g, "");

    // Verify caller
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, sender_name, message_preview } = await req.json();
    if (!target_user_id || target_user_id === user.id) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Check if target user has push enabled
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("master_enabled, mensagens")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (prefs && (!prefs.master_enabled || !prefs.mensagens)) {
      return new Response(JSON.stringify({ skipped: true, reason: "notifications disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", target_user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webpush = await import("https://esm.sh/web-push@3.6.7");
    webpush.setVapidDetails("mailto:app@caminhoboanova.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const preview = (message_preview || "").slice(0, 100);
    const payload = JSON.stringify({
      title: `💬 ${sender_name} respondeu sua mensagem`,
      body: preview,
      icon: "/pwa-192x192.png",
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch { /* ignore failed */ }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
