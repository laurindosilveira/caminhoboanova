import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SCHEMA_SQL } from "@/lib/schemaSQL";

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "'{}'";
    return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(", ")}]`;
  }
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function buildInserts(table: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- No data for ${table}\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(row => {
    const vals = cols.map(c => escapeSQL(row[c]));
    return `(${vals.join(", ")})`;
  });
  return `-- ${table} (${rows.length} rows)\nINSERT INTO public.${table} (${cols.join(", ")}) VALUES\n${lines.join(",\n")}\nON CONFLICT DO NOTHING;\n\n`;
}

export default function ExportData() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  function downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildHeader(type: string) {
    return `-- =============================================\n-- ${type} - Caminho Boa Nova\n-- Gerado em: ${new Date().toISOString()}\n-- =============================================\n\n`;
  }

  const disableTriggers = `ALTER TABLE public.profiles DISABLE TRIGGER on_profile_created;\nALTER TABLE public.profiles DISABLE TRIGGER update_profiles_updated_at;\nALTER TABLE public.discipleship_plans DISABLE TRIGGER update_discipleship_plans_updated_at;\nALTER TABLE public.lesson_responses DISABLE TRIGGER update_lesson_responses_updated_at;\nALTER TABLE public.lesson_content DISABLE TRIGGER update_lesson_content_timestamp;\nALTER TABLE public.devotional_content DISABLE TRIGGER update_devotional_content_updated_at;\nALTER TABLE public.meeting_evaluations DISABLE TRIGGER update_meeting_evaluations_updated_at;\nALTER TABLE public.notification_preferences DISABLE TRIGGER update_notification_preferences_updated_at;\nALTER TABLE public.leader_meeting_notes DISABLE TRIGGER update_leader_meeting_notes_updated_at;\nALTER TABLE public.area_pastors DISABLE TRIGGER update_area_pastors_updated_at;\n\n`;

  const enableTriggers = `\nALTER TABLE public.profiles ENABLE TRIGGER on_profile_created;\nALTER TABLE public.profiles ENABLE TRIGGER update_profiles_updated_at;\nALTER TABLE public.discipleship_plans ENABLE TRIGGER update_discipleship_plans_updated_at;\nALTER TABLE public.lesson_responses ENABLE TRIGGER update_lesson_responses_updated_at;\nALTER TABLE public.lesson_content ENABLE TRIGGER update_lesson_content_timestamp;\nALTER TABLE public.devotional_content ENABLE TRIGGER update_devotional_content_updated_at;\nALTER TABLE public.meeting_evaluations ENABLE TRIGGER update_meeting_evaluations_updated_at;\nALTER TABLE public.notification_preferences ENABLE TRIGGER update_notification_preferences_updated_at;\nALTER TABLE public.leader_meeting_notes ENABLE TRIGGER update_leader_meeting_notes_updated_at;\nALTER TABLE public.area_pastors ENABLE TRIGGER update_area_pastors_updated_at;\n`;

  async function fetchAllData() {
    const [b1, b2, b3] = await Promise.all([
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
    ]);

    const [courses, lessons, lessonContent, devotionalContent, activities, turmas, events, communitySettings, communityChallenges, courseUnlocks] = b1.map(r => r.data ?? []);
    const [profiles, userRoles, userProgress, lessonResponses, devotionalProgress, attendance, worshipAttendance, achievementUnlocks] = b2.map(r => r.data ?? []);
    const [discipleshipPlans, pastoralNotes, spiritualAssessments, meetingEvaluations, leaderMeetingNotes, messages, messageReactions, areaPastors, rankingSeasons, challengeParticipants, notificationPreferences, communityChat, prayerRequests, testimonies] = b3.map(r => r.data ?? []);

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
        setStatus("✅ Schema exportado!");
      } else if (mode === "data") {
        setStatus("Buscando dados...");
        const dataSql = buildHeader("DADOS") + await fetchAllData();
        downloadFile(dataSql, `dados-${date}.sql`);
        setStatus("✅ Dados exportados!");
      } else {
        setStatus("Buscando dados...");
        let sql = buildHeader("EXPORT COMPLETO");
        sql += "-- PARTE 1: ESTRUTURA\n\n" + SCHEMA_SQL;
        sql += "\n\n-- PARTE 2: DADOS\n\n" + await fetchAllData();
        downloadFile(sql, `completo-${date}.sql`);
        setStatus("✅ Arquivo completo exportado!");
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Erro: " + String(err));
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
          Escolha o tipo de exportação para backup ou migração.
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

        {status && (
          <p className="text-sm font-inter text-muted-foreground">{status}</p>
        )}

        <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs">
          ← Voltar
        </Button>
      </div>
    </div>
  );
}
