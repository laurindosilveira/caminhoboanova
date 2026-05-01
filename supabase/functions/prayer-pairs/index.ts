import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Weekly prayer pair generator.
 * Called by cron every Monday at 07:00 BRT (10:00 UTC).
 * For each community, shuffles active members and creates pairs.
 * Sends push notifications to paired members.
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

    // Current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Check if pairs already generated this week
    const { data: existing } = await supabase
      .from("prayer_pairs")
      .select("id")
      .eq("week_start", weekStartStr)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ message: "Pairs already generated this week" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all communities
    const communities = [
      "Martim Lutero", "Bom Pastor", "Rincão Fundo",
      "Rincão Frente", "Linha Brasil", "Iriá Pira 1", "Iriá Pira 2"
    ];

    let totalPairs = 0;
    const allPairedUserIds: string[] = [];

    for (const community of communities) {
      // Get active members (with turma)
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("community", community)
        .not("turma_id", "is", null);

      if (!members || members.length < 2) continue;

      // Shuffle
      const shuffled = [...members].sort(() => Math.random() - 0.5);

      // Create pairs
      const pairs: any[] = [];
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        pairs.push({
          community,
          user_a_id: shuffled[i].user_id,
          user_b_id: shuffled[i + 1].user_id,
          user_a_name: shuffled[i].full_name,
          user_b_name: shuffled[i + 1].full_name,
          week_start: weekStartStr,
        });
        allPairedUserIds.push(shuffled[i].user_id, shuffled[i + 1].user_id);
      }

      // If odd number, last person pairs with first pair's user_a
      if (shuffled.length % 2 !== 0 && pairs.length > 0) {
        const lastPerson = shuffled[shuffled.length - 1];
        pairs.push({
          community,
          user_a_id: lastPerson.user_id,
          user_b_id: pairs[0].user_a_id,
          user_a_name: lastPerson.full_name,
          user_b_name: pairs[0].user_a_name,
          week_start: weekStartStr,
        });
        allPairedUserIds.push(lastPerson.user_id);
      }

      if (pairs.length > 0) {
        await supabase.from("prayer_pairs").insert(pairs);
        totalPairs += pairs.length;
      }
    }

    // Send push notifications to all paired users
    if (allPairedUserIds.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", allPairedUserIds);

      if (subs && subs.length > 0) {
        // Import web-push
        const webpush = await import("https://esm.sh/web-push@3.6.7");
        webpush.setVapidDetails(
          "mailto:app@caminhoboanova.com",
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify({
          title: "🙏 Dupla de Oração da Semana",
          body: "Você foi pareado com alguém especial! Abra o app para ver sua dupla.",
          icon: "/pwa-192x192.png",
        });

        let sentCount = 0;
        let failedCount = 0;

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sentCount++;
          } catch {
            failedCount++;
          }
        }

        // Log
        await supabase.from("push_notification_log").insert({
          type: "prayer_pairs",
          title: "🙏 Dupla de Oração da Semana",
          body: "Pareamento semanal de oração",
          target: "paired_users",
          sent_count: sentCount,
          failed_count: failedCount,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, totalPairs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
