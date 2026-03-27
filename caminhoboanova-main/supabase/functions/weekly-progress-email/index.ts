import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all users with profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, community, area");

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = profiles.map((p: any) => p.user_id);

    // Fetch activity progress from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();

    const [{ data: recentProgress }, { data: recentDevotionals }, { data: activities }, { data: allProgress }] = await Promise.all([
      supabase.from("user_progress").select("user_id, activity_id, completed_at").gte("completed_at", since),
      supabase.from("devotional_progress").select("user_id, devotional_id, completed_at").gte("completed_at", since),
      supabase.from("activities").select("id, title, points"),
      supabase.from("user_progress").select("user_id, activity_id"),
    ]);

    const totalActivities = (activities ?? []).length;
    const results: { email: string; name: string; summary: string }[] = [];

    // Get user emails
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    (users ?? []).forEach((u: any) => {
      if (u.email) emailMap[u.id] = u.email;
    });

    for (const profile of profiles) {
      const email = emailMap[profile.user_id];
      if (!email) continue;

      const weekActivities = (recentProgress ?? []).filter((p: any) => p.user_id === profile.user_id).length;
      const weekDevotionals = (recentDevotionals ?? []).filter((p: any) => p.user_id === profile.user_id).length;
      const totalCompleted = (allProgress ?? []).filter((p: any) => p.user_id === profile.user_id).length;
      const overallPct = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;
      const weekPoints = weekDevotionals * 5 + (recentProgress ?? [])
        .filter((p: any) => p.user_id === profile.user_id)
        .reduce((sum: number, p: any) => {
          const act = (activities ?? []).find((a: any) => a.id === p.activity_id);
          return sum + (act?.points ?? 0);
        }, 0);

      const summary = [
        `Olá, ${profile.full_name.split(" ")[0]}! 👋`,
        ``,
        `📊 Seu resumo semanal do Caminho Boa Nova:`,
        ``,
        `✅ Atividades concluídas esta semana: ${weekActivities}`,
        `📖 Devocionais concluídos esta semana: ${weekDevotionals}`,
        `⭐ Pontos ganhos esta semana: ${weekPoints}`,
        `📈 Progresso geral: ${overallPct}% (${totalCompleted}/${totalActivities})`,
        ``,
        weekActivities === 0 && weekDevotionals === 0
          ? `😔 Você não completou atividades esta semana. Não desista! Cada passo conta.`
          : weekDevotionals >= 5
          ? `🔥 Incrível! Você foi super fiel nos devocionais! Continue assim!`
          : `💪 Bom progresso! Tente completar seus devocionais diários para crescer ainda mais.`,
        ``,
        `Que Deus abençoe sua semana! 🙏`,
        `— Equipe Caminho Boa Nova`,
      ].join("\n");

      results.push({ email, name: profile.full_name, summary });
    }

    // For now, log the summaries (email sending would require Resend/SendGrid)
    console.log(`Generated ${results.length} weekly summaries`);
    
    return new Response(
      JSON.stringify({
        message: `Weekly summaries generated for ${results.length} users`,
        summaries: results.map(r => ({ email: r.email, name: r.name })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
