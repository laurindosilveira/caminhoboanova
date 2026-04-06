import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SCHEMA_SQL } from "@/lib/schemaSQL";

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'";
    return `ARRAY[${value.map((item) => `'${String(item).replace(/'/g, "''")}'`).join(", ")}]`;
  }
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInserts(table: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- No data for ${table}\n`;

  const columns = Object.keys(rows[0]);
  const values = rows.map((row) => {
    const rowValues = columns.map((column) => escapeSQL(row[column]));
    return `(${rowValues.join(", ")})`;
  });

  return `-- ${table} (${rows.length} rows)\nINSERT INTO public.${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")}\nON CONFLICT DO NOTHING;\n\n`;
}

function unwrapQuery<T>(label: string, result: { data: T[] | null; error: { message: string } | null }) {
  if (result.error) {
    throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

export default function ExportData() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function buildHeader(type: string) {
    return `-- =============================================\n-- ${type} - Caminho Boa Nova\n-- Gerado em: ${new Date().toISOString()}\n-- =============================================\n\n`;
  }

  const disableTriggers = [
    "ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created;",
    "ALTER TABLE public.profiles DISABLE TRIGGER update_profiles_updated_at;",
    "ALTER TABLE public.discipleship_plans DISABLE TRIGGER update_discipleship_plans_updated_at;",
    "ALTER TABLE public.lesson_responses DISABLE TRIGGER update_lesson_responses_updated_at;",
    "ALTER TABLE public.lesson_content DISABLE TRIGGER update_lesson_content_timestamp;",
    "ALTER TABLE public.devotional_content DISABLE TRIGGER update_devotional_content_updated_at;",
    "ALTER TABLE public.meeting_evaluations DISABLE TRIGGER update_meeting_evaluations_updated_at;",
    "ALTER TABLE public.notification_preferences DISABLE TRIGGER update_notification_preferences_updated_at;",
    "ALTER TABLE public.leader_meeting_notes DISABLE TRIGGER update_leader_meeting_notes_updated_at;",
    "ALTER TABLE public.area_pastors DISABLE TRIGGER update_area_pastors_updated_at;",
    "ALTER TABLE public.user_devotional_overrides DISABLE TRIGGER update_user_devotional_overrides_updated_at;",
    "ALTER TABLE public.user_lesson_overrides DISABLE TRIGGER update_user_lesson_overrides_updated_at;",
    "",
  ].join("\n");

  const enableTriggers = [
    "",
    "ALTER TABLE public.profiles ENABLE TRIGGER on_profile_created;",
    "ALTER TABLE public.profiles ENABLE TRIGGER update_profiles_updated_at;",
    "ALTER TABLE public.discipleship_plans ENABLE TRIGGER update_discipleship_plans_updated_at;",
    "ALTER TABLE public.lesson_responses ENABLE TRIGGER update_lesson_responses_updated_at;",
    "ALTER TABLE public.lesson_content ENABLE TRIGGER update_lesson_content_timestamp;",
    "ALTER TABLE public.devotional_content ENABLE TRIGGER update_devotional_content_updated_at;",
    "ALTER TABLE public.meeting_evaluations ENABLE TRIGGER update_meeting_evaluations_updated_at;",
    "ALTER TABLE public.notification_preferences ENABLE TRIGGER update_notification_preferences_updated_at;",
    "ALTER TABLE public.leader_meeting_notes ENABLE TRIGGER update_leader_meeting_notes_updated_at;",
    "ALTER TABLE public.area_pastors ENABLE TRIGGER update_area_pastors_updated_at;",
    "ALTER TABLE public.user_devotional_overrides ENABLE TRIGGER update_user_devotional_overrides_updated_at;",
    "ALTER TABLE public.user_lesson_overrides ENABLE TRIGGER update_user_lesson_overrides_updated_at;",
    "",
  ].join("\n");

  async function fetchAllData() {
    const [block1, block2, block3, block4] = await Promise.all([
      Promise.all([
        supabase.from("courses").select("*").order("order_num"),
        supabase.from("lessons").select("*").order("course_id, order_num"),
        supabase.from("lesson_content").select("*"),
        supabase.from("devotional_content").select("*").order("lesson_id, day_number"),
        supabase.from("activities").select("*").order("order_num"),
        supabase.from("turmas").select("*"),
        supabase.from("events").select("*").order("event_date"),
        supabase.from("community_settings").select("*"),
        supabase.from("community_challenges").select("*"),
        supabase.from("course_unlocks").select("*"),
      ]),
      Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("user_progress").select("*"),
        supabase.from("lesson_responses").select("*"),
        supabase.from("devotional_progress").select("*"),
        supabase.from("devotional_responses").select("*"),
        supabase.from("attendance").select("*"),
        supabase.from("worship_attendance").select("*"),
        supabase.from("achievement_unlocks").select("*"),
      ]),
      Promise.all([
        supabase.from("discipleship_plans").select("*"),
        supabase.from("pastoral_notes").select("*"),
        supabase.from("spiritual_assessments").select("*"),
        supabase.from("meeting_evaluations").select("*"),
        supabase.from("leader_meeting_notes").select("*"),
        supabase.from("messages").select("*"),
        supabase.from("message_reactions").select("*"),
        supabase.from("area_pastors").select("*"),
        supabase.from("ranking_seasons").select("*"),
        supabase.from("challenge_participants").select("*"),
        supabase.from("notification_preferences").select("*"),
        supabase.from("community_chat").select("*"),
        supabase.from("prayer_requests").select("*"),
        supabase.from("testimonies").select("*"),
      ]),
      Promise.all([
        supabase.from("user_devotional_overrides" as any).select("*"),
        supabase.from("user_lesson_overrides" as any).select("*"),
      ]),
    ]);

    const courses = unwrapQuery("courses", block1[0]);
    const lessons = unwrapQuery("lessons", block1[1]);
    const lessonContent = unwrapQuery("lesson_content", block1[2]);
    const devotionalContent = unwrapQuery("devotional_content", block1[3]);
    const activities = unwrapQuery("activities", block1[4]);
    const turmas = unwrapQuery("turmas", block1[5]);
    const events = unwrapQuery("events", block1[6]);
    const communitySettings = unwrapQuery("community_settings", block1[7]);
    const communityChallenges = unwrapQuery("community_challenges", block1[8]);
    const courseUnlocks = unwrapQuery("course_unlocks", block1[9]);

    const profiles = unwrapQuery("profiles", block2[0]);
    const userRoles = unwrapQuery("user_roles", block2[1]);
    const userProgress = unwrapQuery("user_progress", block2[2]);
    const lessonResponses = unwrapQuery("lesson_responses", block2[3]);
    const devotionalProgress = unwrapQuery("devotional_progress", block2[4]);
    const devotionalResponses = unwrapQuery("devotional_responses", block2[5]);
    const attendance = unwrapQuery("attendance", block2[6]);
    const worshipAttendance = unwrapQuery("worship_attendance", block2[7]);
    const achievementUnlocks = unwrapQuery("achievement_unlocks", block2[8]);

    const discipleshipPlans = unwrapQuery("discipleship_plans", block3[0]);
    const pastoralNotes = unwrapQuery("pastoral_notes", block3[1]);
    const spiritualAssessments = unwrapQuery("spiritual_assessments", block3[2]);
    const meetingEvaluations = unwrapQuery("meeting_evaluations", block3[3]);
    const leaderMeetingNotes = unwrapQuery("leader_meeting_notes", block3[4]);
    const messages = unwrapQuery("messages", block3[5]);
    const messageReactions = unwrapQuery("message_reactions", block3[6]);
    const areaPastors = unwrapQuery("area_pastors", block3[7]);
    const rankingSeasons = unwrapQuery("ranking_seasons", block3[8]);
    const challengeParticipants = unwrapQuery("challenge_participants", block3[9]);
    const notificationPreferences = unwrapQuery("notification_preferences", block3[10]);
    const communityChat = unwrapQuery("community_chat", block3[11]);
    const prayerRequests = unwrapQuery("prayer_requests", block3[12]);
    const testimonies = unwrapQuery("testimonies", block3[13]);

    const userDevotionalOverrides = unwrapQuery("user_devotional_overrides", block4[0] as any);
    const userLessonOverrides = unwrapQuery("user_lesson_overrides", block4[1] as any);

    let sql = "";
    sql += disableTriggers;
    sql += buildInserts("courses", courses);
    sql += buildInserts("activities", activities);
    sql += buildInserts("turmas", turmas);
    sql += buildInserts("community_settings", communitySettings);
    sql += buildInserts("area_pastors", areaPastors);
    sql += buildInserts("community_challenges", communityChallenges);
    sql += buildInserts("lessons", lessons);
    sql += buildInserts("course_unlocks", courseUnlocks);
    sql += buildInserts("ranking_seasons", rankingSeasons);
    sql += buildInserts("lesson_content", lessonContent);
    sql += buildInserts("devotional_content", devotionalContent);
    sql += buildInserts("events", events);
    sql += buildInserts("leader_meeting_notes", leaderMeetingNotes);
    sql += buildInserts("messages", messages);
    sql += buildInserts("profiles", profiles);
    sql += buildInserts("user_roles", userRoles);
    sql += buildInserts("user_progress", userProgress);
    sql += buildInserts("lesson_responses", lessonResponses);
    sql += buildInserts("devotional_progress", devotionalProgress);
    sql += buildInserts("devotional_responses", devotionalResponses);
    sql += buildInserts("attendance", attendance);
    sql += buildInserts("worship_attendance", worshipAttendance);
    sql += buildInserts("achievement_unlocks", achievementUnlocks);
    sql += buildInserts("challenge_participants", challengeParticipants);
    sql += buildInserts("meeting_evaluations", meetingEvaluations);
    sql += buildInserts("message_reactions", messageReactions);
    sql += buildInserts("discipleship_plans", discipleshipPlans);
    sql += buildInserts("pastoral_notes", pastoralNotes);
    sql += buildInserts("spiritual_assessments", spiritualAssessments);
    sql += buildInserts("notification_preferences", notificationPreferences);
    sql += buildInserts("community_chat", communityChat);
    sql += buildInserts("prayer_requests", prayerRequests);
    sql += buildInserts("testimonies", testimonies);
    sql += buildInserts("user_devotional_overrides", userDevotionalOverrides);
    sql += buildInserts("user_lesson_overrides", userLessonOverrides);
    sql += enableTriggers;
    return sql;
  }

  async function handleExport(mode: "schema" | "data" | "all") {
    setLoading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);

      if (mode === "schema") {
        setStatus("Gerando schema...");
        const sql = buildHeader("SCHEMA (Estrutura)") + SCHEMA_SQL;
        downloadFile(sql, `schema-${date}.sql`);
        setStatus("Schema exportado.");
      } else if (mode === "data") {
        setStatus("Buscando dados...");
        const dataSql = buildHeader("DADOS") + await fetchAllData();
        downloadFile(dataSql, `dados-${date}.sql`);
        setStatus("Dados exportados.");
      } else {
        setStatus("Buscando dados...");
        let sql = buildHeader("EXPORT COMPLETO");
        sql += "-- PARTE 1: ESTRUTURA\n\n" + SCHEMA_SQL;
        sql += "\n\n-- PARTE 2: DADOS\n\n" + await fetchAllData();
        downloadFile(sql, `completo-${date}.sql`);
        setStatus("Arquivo completo exportado.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Erro: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">📦</span>
        </div>
        <h1 className="font-montserrat font-black text-xl text-foreground">Exportar Banco de Dados</h1>
        <p className="text-muted-foreground font-inter text-sm">
          Escolha o tipo de exportacao para backup ou migracao.
        </p>

        <div className="space-y-3">
          <Button onClick={() => handleExport("schema")} disabled={loading} className="w-full" size="lg" variant="outline">
            📐 Exportar Schema (Estrutura)
          </Button>
          <Button onClick={() => handleExport("data")} disabled={loading} className="w-full" size="lg" variant="outline">
            📊 Exportar Dados (Registros)
          </Button>
          <Button onClick={() => handleExport("all")} disabled={loading} className="w-full" size="lg">
            📦 Exportar Tudo (Schema + Dados)
          </Button>
        </div>

        {status && <p className="text-sm font-inter text-muted-foreground">{status}</p>}

        <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs">
          ← Voltar
        </Button>
      </div>
    </div>
  );
}
