import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Heart, ChevronLeft, Save, AlertCircle, CheckCircle2, Flame, GraduationCap,
  Star, MessageSquare, Calendar, FileText, AlertTriangle, Plus, BookOpen, Eye, Clock
} from "lucide-react";
import PastoralReportPDF from "@/components/admin/PastoralReportPDF";
import JourneyLessonView from "@/components/home/JourneyLessonView";

type Assessment = {
  prayer_score: number | null; presence_score: number | null;
  struggle_score: number | null; doubt_score: number | null;
  needs_pastor: boolean; notes: string | null;
  month: number; year: number;
};

type Plan = {
  objectives: string | null; challenges: string | null;
  recommendations: string | null; next_steps: string | null;
  pastor_notes: string | null; health_status: string;
  is_priority: boolean; last_contact_at: string | null;
};

type PastoralNote = {
  id: string; note_type: string; content: string; created_at: string;
};

type AttendanceRecord = {
  id: string; event_id: string; status: string; created_at: string;
  event_title?: string; event_date?: string; event_type?: string;
};

type MeetingEval = {
  event_id: string; participation_score: number | null;
  understanding_score: number | null; engagement_score: number | null;
  notes: string | null; created_at: string;
  event_title?: string; event_date?: string;
};

type WorshipRecord = {
  id: string; worship_date: string; worship_time: string;
  preacher_name: string; status: string; event_type: string; created_at: string;
};

type TimelineCategory = "encontro" | "crise" | "progresso" | "conversa" | "marco";
type TimelineItem = {
  date: string;
  type: "activity" | "note" | "assessment" | "attendance" | "evaluation" | "worship" | "milestone" | "crisis";
  category: TimelineCategory;
  title: string;
  detail?: string;
  icon: string;
  severity?: "positive" | "neutral" | "warning" | "critical";
};

export type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  turma_id?: string | null;
  confirmation_year?: number | null;
  avatar_url?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  address?: string | null;
  email?: string | null;
};

export type Activity = { id: string; type: string; points: number; title: string; order_num: number; subtitle: string | null };

const EMOJIS = ["😔", "😐", "🙂", "😊", "🔥"];
const HEALTH_CFG = {
  saudavel: { label: "🟢 Saudável", bg: "bg-brand-green/10", text: "text-brand-green" },
  atencao:  { label: "🟡 Atenção", bg: "bg-accent/20", text: "text-accent-foreground" },
  critico:  { label: "🔴 Necessita cuidado", bg: "bg-destructive/10", text: "text-destructive" },
};
const NOTE_TYPES = [
  { value: "acompanhamento", label: "📋 Acompanhamento" },
  { value: "conversa", label: "💬 Conversa pastoral" },
  { value: "encontro_individual", label: "📅 Encontro individual" },
  { value: "observacao", label: "📝 Observação" },
];

export function HealthBadge({ status }: { status: string }) {
  const cfg = HEALTH_CFG[status as keyof typeof HEALTH_CFG] ?? HEALTH_CFG.atencao;
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-inter font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

function calcAge(birthDate: string) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

type Lesson = { id: string; title: string; order_num: number; objective: string | null; topics: string[] | null; course_id: string };

const COMMUNITIES_LIST = ["Martim Lutero","Bom Pastor","Rincão Fundo","Rincão Frente","Linha Brasil","Iriá Pira 1","Iriá Pira 2"] as const;
function getArea(community: string) {
  return ["Rincão Frente","Rincão Fundo","Bom Pastor","Iriá Pira 1"].includes(community) ? "Área 1" : "Área 2";
}

export default function ParticipantSheet({ participant: p, activities, onBack }: {
  participant: Participant; activities: Activity[]; onBack: () => void;
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [plan, setPlan] = useState<Plan>({
    objectives: "", challenges: "", recommendations: "", next_steps: "",
    pastor_notes: "", health_status: "atencao", is_priority: false, last_contact_at: null,
  });
  const [notes, setNotes] = useState<PastoralNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ note_type: "acompanhamento", content: "" });
  const [savingNote, setSavingNote] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview"|"plan"|"notes"|"jornada"|"presenca"|"timeline"|"relatorio"|"parecer">("overview");
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("14:00");
  const [scheduleNote, setScheduleNote] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState(false);
  const [newCommunity, setNewCommunity] = useState(p.community);
  const [savingCommunity, setSavingCommunity] = useState(false);
  const [turmas, setTurmas] = useState<{ id: string; name: string; area: string | null }[]>([]);
  const [currentTurmaName, setCurrentTurmaName] = useState<string | null>(null);
  const [editingTurma, setEditingTurma] = useState(false);
  const [newTurmaId, setNewTurmaId] = useState(p.turma_id ?? "");
  const [savingTurma, setSavingTurma] = useState(false);
  const [editingConfYear, setEditingConfYear] = useState(false);
  const [newConfYear, setNewConfYear] = useState<number | null>(p.confirmation_year ?? null);
  const [savingConfYear, setSavingConfYear] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [meetingEvals, setMeetingEvals] = useState<MeetingEval[]>([]);
  const [worshipRecords, setWorshipRecords] = useState<WorshipRecord[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<TimelineCategory | "todos">("todos");
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    async function load() {
      const [{ data: ass }, { data: planData }, { data: notesData }, { data: lessonsData }, { data: attendanceData }, { data: progressData }, { data: allAssessments }, { data: evalData }, { data: worshipData }, { data: challengeParticipations }] = await Promise.all([
        supabase.from("spiritual_assessments").select("*").eq("user_id", p.user_id).eq("month", month).eq("year", year).maybeSingle(),
        supabase.from("discipleship_plans").select("*").eq("user_id", p.user_id).maybeSingle(),
        supabase.from("pastoral_notes").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false }),
        supabase.from("lessons").select("id, title, order_num, objective, topics, course_id").order("order_num"),
        supabase.from("attendance").select("id, event_id, status, created_at").eq("user_id", p.user_id),
        supabase.from("user_progress").select("activity_id, completed_at").eq("user_id", p.user_id),
        supabase.from("spiritual_assessments").select("month, year, prayer_score, presence_score, created_at").eq("user_id", p.user_id),
        supabase.from("meeting_evaluations").select("event_id, participation_score, understanding_score, engagement_score, notes, created_at").eq("user_id", p.user_id),
        supabase.from("worship_attendance").select("id, worship_date, worship_time, preacher_name, status, event_type, created_at").eq("user_id", p.user_id).order("worship_date", { ascending: false }),
        supabase.from("challenge_participants").select("challenge_id, completed, completed_at, joined_at, response_text, file_url").eq("user_id", p.user_id),
      ]);

      setAssessment(ass ?? null);
      if (planData) setPlan(prev => ({ ...prev, ...planData }));
      setNotes(notesData ?? []);
      setLessons(lessonsData ?? []);

      // Fetch turmas
      const { data: turmasData } = await supabase.from("turmas").select("id, name, area").eq("is_active", true).order("area").order("name");
      setTurmas(turmasData ?? []);
      if (p.turma_id) {
        const t = (turmasData ?? []).find(t => t.id === p.turma_id);
        setCurrentTurmaName(t?.name ?? null);
      }

      // Fetch event details for attendance
      const attArr = attendanceData ?? [];
      if (attArr.length > 0) {
        const eventIds = [...new Set(attArr.map(a => a.event_id))];
        const { data: eventsData } = await supabase.from("events").select("id, title, event_date").in("id", eventIds);
        const eventsMap = new Map((eventsData ?? []).map(e => [e.id, e]));
        const enriched = attArr.map(a => ({
          ...a,
          event_title: eventsMap.get(a.event_id)?.title ?? "Evento",
          event_date: eventsMap.get(a.event_id)?.event_date ?? a.created_at,
        }));
        enriched.sort((a, b) => new Date(b.event_date!).getTime() - new Date(a.event_date!).getTime());
        setAttendanceRecords(enriched);
      }

      // Build timeline
      const actsMap = new Map(activities.map(a => [a.id, a]));
      const tl: TimelineItem[] = [];

      // Activities completed
      let completedCount = 0;
      const sortedProgress = [...(progressData ?? [])].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());
      sortedProgress.forEach(pr => {
        const act = actsMap.get(pr.activity_id);
        if (act) {
          completedCount++;
          const isMilestone = completedCount === 1 || completedCount === 10 || completedCount === 25 || completedCount === 50 || completedCount % 25 === 0;
          if (isMilestone) {
            tl.push({ date: pr.completed_at, type: "milestone", category: "marco", title: `🏆 Marco: ${completedCount}ª atividade concluída!`, detail: act.title, icon: "🏆", severity: "positive" });
          }
          tl.push({ date: pr.completed_at, type: "activity", category: "progresso", title: act.title, detail: act.type === "devocional" ? "Devocional" : act.type === "formacao" ? "Formação" : act.type === "encontro" ? "Encontro" : "Atividade", icon: act.type === "devocional" ? "📖" : act.type === "formacao" ? "🎓" : act.type === "encontro" ? "📅" : "✨", severity: "positive" });
        }
      });

      // Pastoral notes — detect crises vs conversations
      (notesData ?? []).forEach(n => {
        const typeLabel = NOTE_TYPES.find(t => t.value === n.note_type)?.label ?? n.note_type;
        const contentLower = n.content.toLowerCase();
        const isCrisis = contentLower.includes("crise") || contentLower.includes("urgente") || contentLower.includes("problema") || contentLower.includes("preocup") || contentLower.includes("afastand") || contentLower.includes("desist");
        tl.push({
          date: n.created_at, type: "note",
          category: isCrisis ? "crise" : "conversa",
          title: isCrisis ? `⚠️ ${typeLabel}` : typeLabel,
          detail: n.content.slice(0, 100),
          icon: isCrisis ? "⚠️" : "📝",
          severity: isCrisis ? "critical" : "neutral",
        });
      });

      // Assessments — detect spiritual milestones/crises
      const allAssArr = (allAssessments ?? []) as { month: number; year: number; prayer_score: number | null; presence_score: number | null; created_at: string }[];
      allAssArr.forEach(a => {
        const avg = ((a.prayer_score ?? 0) + (a.presence_score ?? 0)) / 2;
        const isHigh = avg >= 4;
        const isLow = avg > 0 && avg <= 2;
        if (isHigh) {
          tl.push({ date: a.created_at, type: "milestone", category: "marco", title: `🌟 Autoavaliação excelente — ${MONTH_NAMES[a.month - 1]}/${a.year}`, detail: `Média: ${avg.toFixed(1)}/5`, icon: "🌟", severity: "positive" });
        } else if (isLow) {
          tl.push({ date: a.created_at, type: "crisis", category: "crise", title: `💔 Autoavaliação preocupante — ${MONTH_NAMES[a.month - 1]}/${a.year}`, detail: `Média: ${avg.toFixed(1)}/5 — Precisa de atenção pastoral`, icon: "💔", severity: "critical" });
        }
        tl.push({ date: a.created_at, type: "assessment", category: "progresso", title: `Autoavaliação ${MONTH_NAMES[a.month - 1]}/${a.year}`, icon: "💗", severity: "neutral" });
      });

      // Attendance — detect consecutive absences as crises
      if (attArr.length > 0) {
        const eventIds = [...new Set(attArr.map(a => a.event_id))];
        const { data: eventsData } = await supabase.from("events").select("id, title, event_date").in("id", eventIds);
        const eventsMap = new Map((eventsData ?? []).map(e => [e.id, e]));
        const sortedAtt = [...attArr].sort((a, b) => {
          const da = eventsMap.get(a.event_id)?.event_date ?? a.created_at;
          const db = eventsMap.get(b.event_id)?.event_date ?? b.created_at;
          return new Date(da).getTime() - new Date(db).getTime();
        });

        let consecutiveMisses = 0;
        sortedAtt.forEach(a => {
          const ev = eventsMap.get(a.event_id);
          const statusEmoji = a.status === "presente" ? "🟢" : a.status === "faltou" ? "🔴" : "🟡";
          const severity = a.status === "presente" ? "positive" as const : a.status === "faltou" ? "warning" as const : "neutral" as const;
          
          if (a.status !== "presente") {
            consecutiveMisses++;
          } else {
            if (consecutiveMisses >= 3) {
              // Returning after crisis
              tl.push({ date: ev?.event_date ?? a.created_at, type: "milestone", category: "marco", title: `🎉 Retornou após ${consecutiveMisses} faltas!`, detail: "Momento de acolhimento", icon: "🎉", severity: "positive" });
            }
            consecutiveMisses = 0;
          }

          if (consecutiveMisses === 3) {
            tl.push({ date: ev?.event_date ?? a.created_at, type: "crisis", category: "crise", title: `🚨 3 faltas consecutivas`, detail: "Alerta pastoral — possível afastamento", icon: "🚨", severity: "critical" });
          }

          tl.push({ date: ev?.event_date ?? a.created_at, type: "attendance", category: "encontro", title: `${statusEmoji} ${ev?.title ?? "Evento"}`, detail: a.status === "presente" ? "Presente" : a.status === "faltou" ? "Faltou" : "Justificou", icon: statusEmoji, severity });
        });
      }

      // Meeting evaluations
      const evalsArr = evalData ?? [];
      if (evalsArr.length > 0) {
        const evalEventIds = [...new Set(evalsArr.map(e => e.event_id))];
        const { data: evalEventsData } = await supabase.from("events").select("id, title, event_date").in("id", evalEventIds);
        const evalEventsMap = new Map((evalEventsData ?? []).map(e => [e.id, e]));
        const enrichedEvals: MeetingEval[] = evalsArr.map(e => ({
          ...e,
          event_title: evalEventsMap.get(e.event_id)?.title ?? "Encontro",
          event_date: evalEventsMap.get(e.event_id)?.event_date ?? e.created_at,
        }));
        enrichedEvals.sort((a, b) => new Date(b.event_date!).getTime() - new Date(a.event_date!).getTime());
        setMeetingEvals(enrichedEvals);

        enrichedEvals.forEach(ev => {
          const scores = [ev.participation_score, ev.understanding_score, ev.engagement_score].filter(Boolean);
          const avg = scores.length > 0 ? (scores.reduce((s, v) => s + (v ?? 0), 0) / scores.length).toFixed(1) : "—";
          tl.push({
            date: ev.event_date ?? ev.created_at, type: "evaluation", category: "encontro",
            title: `⭐ Avaliação: ${ev.event_title}`,
            detail: `Média: ${avg}/5${ev.notes ? ` · ${ev.notes.slice(0, 50)}` : ""}`,
            icon: "⭐", severity: "neutral",
          });
        });
      }

      // Worship attendance — first worship as milestone
      const worshipArr = worshipData ?? [];
      setWorshipRecords(worshipArr);
      let worshipCount = 0;
      worshipArr.forEach(w => {
        const statusLabel = w.status === "aprovado" ? "✅ Aprovado" : w.status === "rejeitado" ? "❌ Rejeitado" : "⏳ Pendente";
        if (w.status === "aprovado") worshipCount++;
        if (worshipCount === 1 && w.status === "aprovado") {
          tl.push({ date: w.created_at, type: "milestone", category: "marco", title: "⛪ Primeiro culto confirmado!", detail: "Marco importante na caminhada", icon: "⛪", severity: "positive" });
        }
        const eventLabel = w.event_type === "jemiac" ? "JEMIAC" : w.event_type === "retiro" ? "Retiro" : "Culto";
        const eventEmoji = w.event_type === "jemiac" ? "✝️" : w.event_type === "retiro" ? "🏕️" : "⛪";
        tl.push({
          date: w.created_at, type: "worship", category: "encontro",
          title: `${eventEmoji} ${eventLabel}: ${new Date(w.worship_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${w.worship_time}`,
          detail: `Pregador: ${w.preacher_name} · ${statusLabel}`,
          icon: eventEmoji, severity: w.status === "aprovado" ? "positive" : "neutral",
        });
      });

      // First registered assessment as milestone
      if (allAssArr.length > 0) {
        const first = [...allAssArr].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        tl.push({ date: first.created_at, type: "milestone", category: "marco", title: "💗 Primeira autoavaliação espiritual", detail: "Início do acompanhamento da vida espiritual", icon: "💗", severity: "positive" });
      }

      // Challenge participations
      const challengeParts = challengeParticipations ?? [];
      if (challengeParts.length > 0) {
        const challengeIds = challengeParts.map((cp: any) => cp.challenge_id);
        const { data: challengesData } = await supabase.from("community_challenges").select("id, title, emoji").in("id", challengeIds);
        const challengeMap = new Map((challengesData ?? []).map((c: any) => [c.id, c]));
        challengeParts.forEach((cp: any) => {
          const ch = challengeMap.get(cp.challenge_id);
          if (!ch) return;
          const date = cp.completed && cp.completed_at ? cp.completed_at : cp.joined_at;
          const detail = [
            cp.completed ? "✅ Concluído (+15 pts)" : "⏳ Participando",
            cp.response_text ? `Resposta: "${cp.response_text.slice(0, 80)}"` : null,
            cp.file_url ? "📎 Arquivo anexado" : null,
          ].filter(Boolean).join(" · ");
          tl.push({
            date,
            type: cp.completed ? "activity" : "attendance",
            category: "progresso",
            title: `${ch.emoji} Desafio: ${ch.title}`,
            detail,
            icon: ch.emoji,
            severity: cp.completed ? "positive" : "neutral",
          });
        });
      }

      tl.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineItems(tl);
      setLoading(false);
    }
    load();
  }, [p.user_id]);

  async function handleSavePlan() {
    setSaving(true);
    await supabase.from("discipleship_plans").upsert({
      user_id: p.user_id,
      objectives: plan.objectives || null,
      challenges: plan.challenges || null,
      recommendations: plan.recommendations || null,
      next_steps: plan.next_steps || null,
      pastor_notes: plan.pastor_notes || null,
      health_status: plan.health_status,
      is_priority: plan.is_priority,
    }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveNote() {
    if (!noteForm.content.trim()) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("pastoral_notes").insert({
      user_id: p.user_id,
      admin_id: user!.id,
      note_type: noteForm.note_type,
      content: noteForm.content,
    });
    await supabase.from("discipleship_plans").upsert({
      user_id: p.user_id, last_contact_at: new Date().toISOString(), health_status: plan.health_status,
    }, { onConflict: "user_id" });
    setNoteForm({ note_type: "acompanhamento", content: "" });
    setShowNoteForm(false);
    setSavingNote(false);
    const { data } = await supabase.from("pastoral_notes").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false });
    setNotes(data ?? []);
  }

  const completedIds = new Set(p.completed_activity_ids);
  const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
  const formacoes = activities.filter(a => a.type === "formacao");
  const devocionais = activities.filter(a => a.type === "devocional");
  const encontros = activities.filter(a => a.type === "encontro");
  const doneForm = formacoes.filter(a => completedIds.has(a.id)).length;
  const doneDev = devocionais.filter(a => completedIds.has(a.id)).length;
  const doneEnc = encontros.filter(a => completedIds.has(a.id)).length;
  const age = calcAge(p.birth_date);

  // Attendance stats
  const totalEvents = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(a => a.status === "presente").length;
  const attendancePct = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0;

  if (loading) return <div className="py-20 text-center text-muted-foreground font-inter text-sm">Carregando ficha...</div>;

  if (selectedLesson) {
    return (
      <JourneyLessonView
        lesson={selectedLesson}
        onBack={() => setSelectedLesson(null)}
        isAdmin={true}
        targetUserId={p.user_id}
      />
    );
  }

  // ── PARECER PASTORAL AUTOMÁTICO ──
  const generateParecer = () => {
    // 🧠 Conhecimento: progresso formação + lições respondidas
    const conhecimentoPct = formacoes.length > 0 ? (doneForm / formacoes.length) * 100 : 0;
    const lessonResponseCount = lessons.length; // total lessons available
    const conhecimentoScore = Math.min(5, Math.round((conhecimentoPct / 20)));
    const conhecimentoLabel = conhecimentoScore >= 4 ? "Sólido" : conhecimentoScore >= 3 ? "Adequado" : conhecimentoScore >= 2 ? "Em desenvolvimento" : "Insuficiente";

    // ❤️ Vida espiritual: autoavaliação + devocionais completados
    const devPct = devocionais.length > 0 ? (doneDev / devocionais.length) * 100 : 0;
    const prayerScore = assessment?.prayer_score ?? 0;
    const presenceScore = assessment?.presence_score ?? 0;
    const spiritAvg = prayerScore > 0 && presenceScore > 0 ? (prayerScore + presenceScore) / 2 : 0;
    const vidaScore = spiritAvg > 0 ? Math.round((spiritAvg * 0.6 + (devPct / 20) * 0.4)) : Math.min(5, Math.round(devPct / 20));
    const vidaLabel = vidaScore >= 4 ? "Vibrante" : vidaScore >= 3 ? "Estável" : vidaScore >= 2 ? "Oscilante" : "Preocupante";

    // 👥 Comunhão: presença em encontros + cultos aprovados
    const worshipApproved = worshipRecords.filter(w => w.status === "aprovado").length;
    const comunhaoPct = totalEvents > 0 ? (presentCount / totalEvents) * 100 : 0;
    const comunhaoWorshipPct = worshipRecords.length > 0 ? (worshipApproved / worshipRecords.length) * 100 : 0;
    const comunhaoAvg = totalEvents > 0 && worshipRecords.length > 0
      ? (comunhaoPct + comunhaoWorshipPct) / 2
      : totalEvents > 0 ? comunhaoPct : comunhaoWorshipPct;
    const comunhaoScore = Math.min(5, Math.round(comunhaoAvg / 20));
    const comunhaoLabel = comunhaoScore >= 4 ? "Muito presente" : comunhaoScore >= 3 ? "Regular" : comunhaoScore >= 2 ? "Irregular" : "Ausente";

    // 🌍 Testemunho: avaliações de encontros (participação, engajamento)
    const evalScores = meetingEvals.map(ev => {
      const scores = [ev.participation_score, ev.engagement_score].filter(Boolean) as number[];
      return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }).filter(s => s > 0);
    const testemunhoAvg = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : 0;
    const testemunhoScore = Math.round(testemunhoAvg) || (p.completed_count > 0 ? 2 : 1);
    const testemunhoLabel = testemunhoScore >= 4 ? "Exemplar" : testemunhoScore >= 3 ? "Bom" : testemunhoScore >= 2 ? "Em crescimento" : "Precisa atenção";

    // Overall
    const overall = (conhecimentoScore + vidaScore + comunhaoScore + testemunhoScore) / 4;
    const aptidao = overall >= 3.5 ? "apto" : overall >= 2.5 ? "acompanhamento" : "nao_apto";
    const aptidaoLabel = aptidao === "apto" ? "✅ Apto para Profissão de Fé" : aptidao === "acompanhamento" ? "🟡 Em acompanhamento" : "🔴 Não apto no momento";

    return {
      dimensions: [
        { emoji: "🧠", label: "Conhecimento", score: conhecimentoScore, sublabel: conhecimentoLabel, detail: `${doneForm}/${formacoes.length} formações concluídas (${Math.round(conhecimentoPct)}%)` },
        { emoji: "❤️", label: "Vida Espiritual", score: vidaScore, sublabel: vidaLabel, detail: `${doneDev}/${devocionais.length} devocionais · Autoavaliação: ${spiritAvg > 0 ? spiritAvg.toFixed(1) : "N/A"}/5` },
        { emoji: "👥", label: "Comunhão", score: comunhaoScore, sublabel: comunhaoLabel, detail: `${presentCount}/${totalEvents} encontros (${attendancePct}%) · ${worshipApproved} cultos aprovados` },
        { emoji: "🌍", label: "Testemunho", score: testemunhoScore, sublabel: testemunhoLabel, detail: `Média avaliações: ${testemunhoAvg > 0 ? testemunhoAvg.toFixed(1) : "N/A"}/5 · ${meetingEvals.length} avaliações` },
      ],
      overall,
      aptidao,
      aptidaoLabel,
    };
  };

  const SECTIONS = [
    { id: "overview" as const, label: "Visão Geral" },
    { id: "plan" as const, label: "Plano" },
    { id: "notes" as const, label: `Notas (${notes.length})` },
    { id: "presenca" as const, label: "Presença" },
    { id: "timeline" as const, label: "Timeline" },
    { id: "jornada" as const, label: "Jornada" },
    { id: "parecer" as const, label: "📄 Parecer" },
    { id: "relatorio" as const, label: "Relatório" },
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar ao painel
      </button>

      {/* Profile header */}
      <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-4 mb-3">
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={p.full_name}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border-2 border-white/30 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowAvatarZoom(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 border border-white/20">
              <span className="font-montserrat font-black text-primary-foreground text-2xl">{p.full_name.charAt(0)}</span>
            </div>
          )}

          {/* Avatar zoom dialog */}
          {showAvatarZoom && p.avatar_url && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setShowAvatarZoom(false)}>
              <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <img src={p.avatar_url} alt={p.full_name} className="w-full rounded-2xl object-contain max-h-[70vh]" />
                <button
                  onClick={() => setShowAvatarZoom(false)}
                  className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-lg"
                >
                  <span className="text-foreground text-sm font-bold">✕</span>
                </button>
              </div>
            </div>
          )}
          <div className="flex-1">
            <h2 className="font-montserrat font-black text-primary-foreground text-lg leading-tight">{p.full_name}</h2>
            <p className="text-primary-foreground/70 font-inter text-xs">
              {p.community} · {p.area}{age ? ` · ${age} anos` : ""}
              <button onClick={() => { setEditingCommunity(true); setNewCommunity(p.community); }} className="ml-1.5 text-primary-foreground/50 hover:text-primary-foreground underline text-[10px]">✏️ alterar</button>
            </p>
            <p className="text-primary-foreground/60 font-inter text-xs">📞 <a href={`https://wa.me/${p.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-foreground transition-colors">{p.phone}</a></p>
            {p.email && <p className="text-primary-foreground/60 font-inter text-xs">📧 {p.email}</p>}
            <p className="text-primary-foreground/60 font-inter text-xs">
              🎓 Confirmatório {new Date().getFullYear()} - {p.area}
              <button onClick={() => { setEditingTurma(true); setNewTurmaId(p.turma_id ?? ""); }} className="ml-1.5 text-primary-foreground/50 hover:text-primary-foreground underline text-[10px]">✏️ alterar</button>
            </p>
            <p className="text-primary-foreground/60 font-inter text-xs">
              📖 {p.confirmation_year ? `${p.confirmation_year}º ano do Ensino Confirmatório` : "Ano não definido"}
              <button onClick={() => { setEditingConfYear(true); setNewConfYear(p.confirmation_year ?? null); }} className="ml-1.5 text-primary-foreground/50 hover:text-primary-foreground underline text-[10px]">✏️ alterar</button>
            </p>
          </div>
          <button onClick={() => setPlan(prev => ({ ...prev, is_priority: !prev.is_priority }))}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${plan.is_priority ? "bg-accent border-accent/50" : "bg-white/10 border-white/20"}`}
            title="Marcar como prioridade pastoral">
            <Star className={`w-4 h-4 ${plan.is_priority ? "text-accent-foreground" : "text-primary-foreground/60"}`} style={{ fill: plan.is_priority ? "hsl(var(--accent-foreground))" : "transparent" }} />
          </button>
        </div>

        {/* Family info */}
        {(p.father_name || p.mother_name) && (
          <div className="bg-white/10 rounded-xl p-3 mb-3 space-y-1.5">
            {p.father_name && (
              <p className="text-primary-foreground/80 font-inter text-xs">
                👨 <strong>Pai:</strong> {p.father_name}
                {p.father_phone && <> · 📞 <a href={`https://wa.me/${p.father_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-foreground transition-colors">{p.father_phone}</a></>}
              </p>
            )}
            {p.mother_name && (
              <p className="text-primary-foreground/80 font-inter text-xs">
                👩 <strong>Mãe:</strong> {p.mother_name}
                {p.mother_phone && <> · 📞 <a href={`https://wa.me/${p.mother_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary-foreground transition-colors">{p.mother_phone}</a></>}
              </p>
            )}
            {p.address && (
              <p className="text-primary-foreground/80 font-inter text-xs">
                📍 <strong>Endereço:</strong> {p.address}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <HealthBadge status={plan.health_status} />
          {plan.is_priority && <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-accent text-accent-foreground">⭐ Prioridade</span>}
          {assessment?.needs_pastor && <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-white/20 text-primary-foreground">🙏 Pediu conversa</span>}
          <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-white/20 text-primary-foreground">📊 {pct}% jornada</span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-white/20 text-primary-foreground">📅 {attendancePct}% presença</span>
        </div>
      </div>

      {/* Edit community modal */}
      {editingCommunity && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="font-montserrat font-bold text-foreground text-sm">Alterar Comunidade / Área</p>
          <select
            value={newCommunity}
            onChange={(e) => setNewCommunity(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 pr-8 text-sm text-foreground appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {COMMUNITIES_LIST.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground font-inter">
            Nova área: <strong className="text-foreground">{getArea(newCommunity)}</strong>
          </p>
          <div className="flex gap-2">
            <button
              disabled={savingCommunity}
              onClick={async () => {
                setSavingCommunity(true);
                const newArea = getArea(newCommunity);
                const { error } = await supabase.from("profiles").update({
                  community: newCommunity as any,
                  area: newArea as any,
                }).eq("user_id", p.user_id);
                setSavingCommunity(false);
                if (!error) {
                  p.community = newCommunity;
                  p.area = newArea;
                  setEditingCommunity(false);
                }
              }}
              className="flex-1 h-9 rounded-xl font-inter text-xs font-bold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-hero)" }}
            >
              {savingCommunity ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setEditingCommunity(false)} className="px-4 h-9 rounded-xl border border-border text-xs font-inter text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit turma modal */}
      {editingTurma && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="font-montserrat font-bold text-foreground text-sm">Alterar Turma</p>
          <select
            value={newTurmaId}
            onChange={(e) => setNewTurmaId(e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 pr-8 text-sm text-foreground appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sem turma</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.area ?? "Geral"})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              disabled={savingTurma}
              onClick={async () => {
                setSavingTurma(true);
                const { error } = await supabase.from("profiles").update({
                  turma_id: newTurmaId || null,
                }).eq("user_id", p.user_id);
                setSavingTurma(false);
                if (!error) {
                  p.turma_id = newTurmaId || null;
                  const t = turmas.find(t => t.id === newTurmaId);
                  setCurrentTurmaName(t?.name ?? null);
                  setEditingTurma(false);
                }
              }}
              className="flex-1 h-9 rounded-xl font-inter text-xs font-bold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-hero)" }}
            >
              {savingTurma ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setEditingTurma(false)} className="px-4 h-9 rounded-xl border border-border text-xs font-inter text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit confirmation year */}
      {editingConfYear && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
          <p className="font-montserrat font-bold text-foreground text-sm">Ano do Ensino Confirmatório</p>
          <div className="flex gap-2">
            {[{ val: null, label: "Não definido" }, { val: 1, label: "1º Ano" }, { val: 2, label: "2º Ano" }].map(opt => (
              <button
                key={String(opt.val)}
                onClick={() => setNewConfYear(opt.val)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-montserrat font-bold border transition-all ${
                  newConfYear === opt.val ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              disabled={savingConfYear}
              onClick={async () => {
                setSavingConfYear(true);
                const { error } = await supabase.from("profiles").update({
                  confirmation_year: newConfYear,
                } as any).eq("user_id", p.user_id);
                setSavingConfYear(false);
                if (!error) {
                  (p as any).confirmation_year = newConfYear;
                  setEditingConfYear(false);
                }
              }}
              className="flex-1 h-9 rounded-xl font-inter text-xs font-bold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-hero)" }}
            >
              {savingConfYear ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setEditingConfYear(false)} className="px-4 h-9 rounded-xl border border-border text-xs font-inter text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: MessageSquare, label: "Enviar mensagem", action: () => setActiveSection("notes") },
          { icon: FileText, label: "Registrar acomp.", action: () => { setActiveSection("notes"); setShowNoteForm(true); } },
          { icon: Calendar, label: "Agendar conversa", action: () => setShowScheduleForm(true) },
          { icon: AlertTriangle, label: plan.health_status === "critico" ? "⚠️ Crítico" : "Marcar crítico", action: () => setPlan(prev => ({ ...prev, health_status: prev.health_status === "critico" ? "atencao" : "critico" })) },
        ].map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={action}
            className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors text-left">
            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-inter text-xs font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* Schedule conversation form */}
      {showScheduleForm && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-montserrat font-bold text-foreground text-sm">📅 Agendar Conversa com {p.full_name.split(" ")[0]}</p>
          <p className="text-muted-foreground font-inter text-[10px]">
            O aluno receberá uma notificação push e verá o agendamento na aba Jornada e Agenda.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-inter font-bold text-foreground mb-1">Data</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-inter font-bold text-foreground mb-1">Horário</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-inter font-bold text-foreground mb-1">Observação (opcional)</label>
            <input
              type="text"
              value={scheduleNote}
              onChange={e => setScheduleNote(e.target.value)}
              placeholder="Ex: Conversa sobre frequência"
              maxLength={120}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={savingSchedule || !scheduleDate}
              onClick={async () => {
                setSavingSchedule(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  // Create event with local date to avoid timezone issues
                  const eventDate = `${scheduleDate}T${scheduleTime}:00`;
                  const { error } = await supabase.from("events").insert({
                    title: `Conversa pastoral — ${p.full_name.split(" ")[0]}`,
                    description: scheduleNote || `Conversa agendada com ${p.full_name}`,
                    event_date: eventDate,
                    type: "conversa",
                    area: p.area,
                    target_user_id: p.user_id,
                    created_by: user.id,
                  } as any);
                  if (error) throw error;

                  // Send push notification via admin-push
                  await supabase.functions.invoke("admin-push", {
                    body: {
                      title: "💬 Conversa agendada!",
                      body: `Seu líder agendou uma conversa com você para ${new Date(eventDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${scheduleTime}. Confira na sua agenda!`,
                      target: "user",
                      targetValue: p.user_id,
                    },
                  });

                  // Also register a pastoral note
                  await supabase.from("pastoral_notes").insert({
                    user_id: p.user_id,
                    admin_id: user.id,
                    note_type: "encontro_individual",
                    content: `Conversa agendada para ${new Date(eventDate).toLocaleDateString("pt-BR")} às ${scheduleTime}${scheduleNote ? `. ${scheduleNote}` : ""}`,
                  });

                  setShowScheduleForm(false);
                  setScheduleDate("");
                  setScheduleTime("14:00");
                  setScheduleNote("");
                  // Refresh notes
                  const { data } = await supabase.from("pastoral_notes").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false });
                  setNotes(data ?? []);
                } catch (err) {
                  console.error("Failed to schedule conversation:", err);
                } finally {
                  setSavingSchedule(false);
                }
              }}
              className="flex-1 h-9 rounded-xl font-inter text-xs font-bold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-hero)" }}
            >
              {savingSchedule ? "Agendando..." : "✅ Confirmar Agendamento"}
            </button>
            <button onClick={() => setShowScheduleForm(false)} className="px-4 h-9 rounded-xl border border-border text-xs font-inter text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}


      <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-inter font-medium transition-all ${activeSection === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW SECTION */}
      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Flame className="w-4 h-4 text-secondary" />
              <p className="font-montserrat font-bold text-foreground text-sm">Saúde Espiritual</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "📊 Progresso geral", done: p.completed_count, total: activities.length, color: pct >= 70 ? "var(--gradient-green)" : pct >= 34 ? "var(--gradient-orange)" : "hsl(var(--destructive))" },
                { label: "📖 Devocionais", done: doneDev, total: devocionais.length, color: "var(--gradient-green)" },
                { label: "🎓 Formação", done: doneForm, total: formacoes.length, color: "hsl(var(--secondary))" },
                { label: "📅 Encontros", done: doneEnc, total: encontros.length, color: "hsl(var(--primary))" },
                { label: "✅ Presença", done: presentCount, total: totalEvents, color: attendancePct >= 70 ? "var(--gradient-green)" : "hsl(var(--destructive))" },
              ].map(({ label, done, total, color }) => {
                const p2 = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-inter text-xs text-foreground">{label}</span>
                      <span className="font-inter text-xs text-muted-foreground">{done}/{total} · <strong className="text-foreground">{p2}%</strong></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${p2}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Autoavaliação */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary" />
              <p className="font-montserrat font-bold text-foreground text-sm">Autoavaliação — {MONTH_NAMES[month-1]}/{year}</p>
            </div>
            <div className="p-4">
              {assessment ? (
                <div className="space-y-2.5">
                  {[
                    { label: "🙏 Vida de oração", score: assessment.prayer_score },
                    { label: "✨ Sente Deus perto", score: assessment.presence_score },
                    { label: "⚡ Tentações/dificuldades", score: assessment.struggle_score },
                    { label: "❓ Dúvidas na fé", score: assessment.doubt_score },
                  ].map(({ label, score }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="font-inter text-xs text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`w-4 h-1.5 rounded-full ${i <= (score ?? 0) ? "bg-primary" : "bg-muted"}`} />
                          ))}
                        </div>
                        <span className="text-base">{score ? EMOJIS[score - 1] : "—"}</span>
                      </div>
                    </div>
                  ))}
                  {assessment.needs_pastor && (
                    <div className="flex items-center gap-2 p-2.5 bg-primary/10 rounded-xl mt-1">
                      <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      <p className="font-inter text-xs text-primary font-semibold">Solicitou conversa com o pastor</p>
                    </div>
                  )}
                  {assessment.notes && (
                    <p className="font-inter text-xs text-muted-foreground italic p-2.5 bg-muted rounded-xl">"{assessment.notes}"</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground font-inter text-sm py-2">Nenhuma avaliação este mês.</p>
              )}
            </div>
          </div>

          {/* Cursos */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-secondary" />
              <p className="font-montserrat font-bold text-foreground text-sm">Formação nos Cursos</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: "Curso 1 — Começando a Vida Cristã", total: 16 },
                { label: "Curso 2 — Crescimento Cristão", total: 16 },
              ].map((course, i) => {
                const courseActs = formacoes.slice(i * course.total, (i + 1) * course.total);
                const done = courseActs.filter(a => completedIds.has(a.id)).length;
                const cp = course.total > 0 ? Math.round((done / course.total) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="font-inter text-xs text-foreground">{course.label}</span>
                      <span className="font-inter text-xs text-muted-foreground">{done}/{course.total} · <strong className="text-foreground">{cp}%</strong></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${cp}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PLAN SECTION */}
      {activeSection === "plan" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent-foreground" />
            <p className="font-montserrat font-bold text-foreground text-sm">Plano de Discipulado</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              { key: "objectives" as const, label: "🎯 Objetivos espirituais" },
              { key: "next_steps" as const, label: "➡️ Próximos passos (um por linha)" },
              { key: "challenges" as const, label: "⚡ Desafios propostos" },
              { key: "recommendations" as const, label: "🙏 Recomendações pastorais" },
              { key: "pastor_notes" as const, label: "📝 Observações privadas" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="font-inter text-xs font-medium text-foreground block mb-1">{label}</label>
                <textarea value={plan[key] ?? ""} onChange={e => setPlan(prev => ({ ...prev, [key]: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            ))}
            <div>
              <label className="font-inter text-xs font-medium text-foreground block mb-1.5">Status de saúde espiritual</label>
              <div className="grid grid-cols-3 gap-2">
                {(["saudavel", "atencao", "critico"] as const).map(s => {
                  const cfg = HEALTH_CFG[s];
                  return (
                    <button key={s} onClick={() => setPlan(prev => ({ ...prev, health_status: s }))}
                      className={`py-2 rounded-xl text-xs font-inter font-medium border transition-all ${plan.health_status === s ? `border-transparent ${cfg.bg} ${cfg.text}` : "border-border bg-muted text-muted-foreground"}`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleSavePlan} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70 transition-all"
              style={{ background: "var(--gradient-hero)" }}>
              {saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : saving ? "Salvando..." : <><Save className="w-4 h-4" /> Salvar plano</>}
            </button>
          </div>
        </div>
      )}

      {/* NOTES SECTION */}
      {activeSection === "notes" && (
        <div className="space-y-3">
          <button onClick={() => setShowNoteForm(!showNoteForm)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-inter text-sm font-medium text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}>
            <Plus className="w-4 h-4" /> Registrar acompanhamento
          </button>

          {showNoteForm && (
            <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
              <p className="font-montserrat font-bold text-foreground text-sm">Novo registro pastoral</p>
              <select value={noteForm.note_type} onChange={e => setNoteForm(f => ({ ...f, note_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Descreva o acompanhamento, observações ou próximos passos..." rows={3}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSaveNote} disabled={savingNote || !noteForm.content.trim()}
                  className="flex-1 py-2.5 rounded-xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-hero)" }}>
                  {savingNote ? "Salvando..." : "Salvar registro"}
                </button>
                <button onClick={() => setShowNoteForm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="font-montserrat font-bold text-foreground text-sm">Nenhum registro ainda</p>
              <p className="text-muted-foreground font-inter text-xs mt-1">Registre acompanhamentos, conversas e observações pastorais.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(note => {
                const typeInfo = NOTE_TYPES.find(t => t.value === note.note_type);
                return (
                  <div key={note.id} className="bg-card rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-inter text-xs font-semibold text-foreground">{typeInfo?.label ?? note.note_type}</span>
                      <span className="text-muted-foreground font-inter text-[10px] ml-auto">
                        {new Date(note.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <p className="font-inter text-xs text-muted-foreground leading-relaxed">{note.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PRESENÇA SECTION */}
      {activeSection === "presenca" && (
        <div className="space-y-3">
          {/* Attendance summary */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="font-montserrat font-bold text-foreground text-sm">Resumo de Presença</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Presente", count: presentCount, emoji: "🟢", color: "text-brand-green", bg: "bg-brand-green/10" },
                { label: "Faltou", count: attendanceRecords.filter(a => a.status === "faltou").length, emoji: "🔴", color: "text-destructive", bg: "bg-destructive/10" },
                { label: "Justificou", count: attendanceRecords.filter(a => a.status === "justificou").length, emoji: "🟡", color: "text-accent-foreground", bg: "bg-accent/20" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.bg}`}>
                  <p className={`font-montserrat font-black text-xl ${s.color}`}>{s.count}</p>
                  <p className={`font-inter text-[10px] ${s.color} opacity-80`}>{s.emoji} {s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <span className="font-inter text-xs text-muted-foreground">Taxa de frequência</span>
              <span className={`font-montserrat font-bold text-sm ${attendancePct >= 70 ? "text-brand-green" : attendancePct >= 40 ? "text-accent-foreground" : "text-destructive"}`}>
                {attendancePct}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all" style={{ width: `${attendancePct}%`, background: attendancePct >= 70 ? "var(--gradient-green)" : "hsl(var(--destructive))" }} />
            </div>
          </div>

          {/* Attendance list */}
          {attendanceRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-inter text-sm">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum registro de presença ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.map(a => {
                const statusEmoji = a.status === "presente" ? "🟢" : a.status === "faltou" ? "🔴" : "🟡";
                const statusLabel = a.status === "presente" ? "Presente" : a.status === "faltou" ? "Faltou" : "Justificou";
                return (
                  <div key={a.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                    <span className="text-lg">{statusEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter text-sm font-medium text-foreground truncate">{a.event_title}</p>
                      <p className="font-inter text-[10px] text-muted-foreground">
                        {new Date(a.event_date!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className={`text-xs font-inter font-medium px-2 py-0.5 rounded-full ${
                      a.status === "presente" ? "bg-brand-green/10 text-brand-green" :
                      a.status === "faltou" ? "bg-destructive/10 text-destructive" :
                      "bg-accent/20 text-accent-foreground"
                    }`}>{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Meeting Evaluations */}
          {meetingEvals.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-primary" />
                <p className="font-montserrat font-bold text-foreground text-sm">Avaliações de Encontros</p>
              </div>
              <div className="space-y-2">
                {meetingEvals.map((ev, i) => {
                  const scores = [
                    { label: "Participação", value: ev.participation_score },
                    { label: "Compreensão", value: ev.understanding_score },
                    { label: "Engajamento", value: ev.engagement_score },
                  ];
                  const validScores = scores.filter(s => s.value);
                  const avg = validScores.length > 0 ? (validScores.reduce((s, v) => s + (v.value ?? 0), 0) / validScores.length).toFixed(1) : "—";
                  return (
                    <div key={i} className="bg-card rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-inter text-sm font-medium text-foreground">{ev.event_title}</p>
                          <p className="font-inter text-[10px] text-muted-foreground">
                            {new Date(ev.event_date!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className="font-montserrat font-black text-primary text-lg">{avg}<span className="text-xs font-normal text-muted-foreground">/5</span></span>
                      </div>
                      <div className="flex gap-3">
                        {scores.map(s => (
                          <div key={s.label} className="flex-1 text-center">
                            <p className="font-montserrat font-bold text-foreground text-sm">{s.value ?? "—"}</p>
                            <p className="font-inter text-[9px] text-muted-foreground">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      {ev.notes && (
                        <p className="font-inter text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1.5">📝 {ev.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Worship Attendance */}
          {worshipRecords.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📅</span>
                <p className="font-montserrat font-bold text-foreground text-sm">Presença em Eventos</p>
              </div>
              <div className="space-y-2">
                {worshipRecords.map(w => {
                  const statusCfg = {
                    aprovado: { label: "Aprovado", color: "text-brand-green", bg: "bg-brand-green/10" },
                    rejeitado: { label: "Rejeitado", color: "text-destructive", bg: "bg-destructive/10" },
                    pendente: { label: "Pendente", color: "text-accent-foreground", bg: "bg-accent/20" },
                  }[w.status] ?? { label: w.status, color: "text-muted-foreground", bg: "bg-muted" };
                  return (
                    <div key={w.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                      <span className="text-lg">{w.event_type === "jemiac" ? "✝️" : w.event_type === "retiro" ? "🏕️" : "⛪"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter text-sm font-medium text-foreground">
                          {w.event_type === "jemiac" ? "JEMIAC" : w.event_type === "retiro" ? "Retiro" : "Culto"} · {new Date(w.worship_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {w.worship_time}
                        </p>
                        <p className="font-inter text-[10px] text-muted-foreground">Pregador: {w.preacher_name}</p>
                      </div>
                      <span className={`text-xs font-inter font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIMELINE SECTION */}
      {activeSection === "timeline" && (() => {
        const FILTERS: { id: TimelineCategory | "todos"; label: string; icon: string }[] = [
          { id: "todos", label: "Todos", icon: "📋" },
          { id: "marco", label: "Marcos", icon: "🏆" },
          { id: "crise", label: "Crises", icon: "⚠️" },
          { id: "encontro", label: "Encontros", icon: "📅" },
          { id: "conversa", label: "Conversas", icon: "💬" },
          { id: "progresso", label: "Progressos", icon: "📈" },
        ];
        const [filter, setFilter] = [timelineFilter, setTimelineFilter];
        const filtered = filter === "todos" ? timelineItems : timelineItems.filter(i => i.category === filter);
        const crisisCount = timelineItems.filter(i => i.category === "crise").length;
        const marcoCount = timelineItems.filter(i => i.category === "marco").length;

        const severityBg = (s?: string) =>
          s === "positive" ? "bg-brand-green/15 border-brand-green/30" :
          s === "critical" ? "bg-destructive/10 border-destructive/20" :
          s === "warning" ? "bg-accent/15 border-accent/30" :
          "bg-muted/40 border-border";

        const severityDot = (s?: string) =>
          s === "positive" ? "bg-brand-green" :
          s === "critical" ? "bg-destructive" :
          s === "warning" ? "bg-accent" :
          "bg-muted-foreground/40";

        return (
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-start gap-2">
            <Clock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-inter text-xs text-primary leading-relaxed">
                Linha do tempo completa de <strong>{p.full_name}</strong>
              </p>
              <div className="flex gap-2 mt-1">
                {marcoCount > 0 && <span className="text-[10px] font-inter font-semibold text-brand-green">🏆 {marcoCount} marcos</span>}
                {crisisCount > 0 && <span className="text-[10px] font-inter font-semibold text-destructive">⚠️ {crisisCount} crises</span>}
                <span className="text-[10px] font-inter text-muted-foreground">{timelineItems.length} registros</span>
              </div>
            </div>
          </div>

          {/* Category filters */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setTimelineFilter(f.id as any)}
                className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium transition-all ${
                  filter === f.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}>
                <span>{f.icon}</span> {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-inter text-sm">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum registro {filter !== "todos" ? `na categoria "${FILTERS.find(f => f.id === filter)?.label}"` : "na timeline ainda"}.</p>
            </div>
          ) : (
            <div className="relative">
              {filtered.map((item, idx) => (
                <div key={idx} className="flex gap-3 mb-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 border ${severityBg(item.severity)}`}>
                      {item.icon}
                    </div>
                    {idx < filtered.length - 1 && (
                      <div className={`w-0.5 h-6 rounded-full mt-1 ${severityDot(item.severity)}`} />
                    )}
                  </div>
                  <div className={`flex-1 pb-4 pt-1 ${item.severity === "critical" || item.severity === "positive" ? "" : ""}`}>
                    <div className="flex items-center gap-2">
                      <p className={`font-inter text-sm font-medium ${
                        item.severity === "critical" ? "text-destructive" :
                        item.severity === "positive" ? "text-brand-green" :
                        "text-foreground"
                      }`}>{item.title}</p>
                      <span className="text-muted-foreground font-inter text-[10px] ml-auto flex-shrink-0">
                        {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    {item.detail && (
                      <p className="font-inter text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                    )}
                    {item.category !== "encontro" && item.category !== "progresso" && (
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-inter font-medium ${
                        item.category === "marco" ? "bg-brand-green/10 text-brand-green" :
                        item.category === "crise" ? "bg-destructive/10 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {item.category === "marco" ? "Marco espiritual" : item.category === "crise" ? "Momento de crise" : item.category === "conversa" ? "Conversa pastoral" : item.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })()}

      {/* JORNADA SECTION */}
      {activeSection === "jornada" && (
        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-start gap-2">
            <Eye className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="font-inter text-xs text-primary leading-relaxed">
              Visualize as respostas de <strong>{p.full_name}</strong> para cada lição da Minha Jornada. Use no encontro presencial.
            </p>
          </div>
          {lessons.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground font-inter text-sm">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma lição cadastrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lessons.map(lesson => (
                <button key={lesson.id} onClick={() => setSelectedLesson(lesson)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                    <span className="font-montserrat font-black text-primary-foreground text-sm">{lesson.order_num}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-foreground truncate">{lesson.title}</p>
                    {lesson.objective && <p className="font-inter text-[10px] text-muted-foreground truncate mt-0.5">{lesson.objective}</p>}
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PARECER PASTORAL */}
      {activeSection === "parecer" && (() => {
        const parecer = generateParecer();
        return (
          <div className="space-y-4">
            {/* Resultado geral */}
            <div className={`rounded-2xl p-4 border ${
              parecer.aptidao === "apto" ? "bg-brand-green/5 border-brand-green/20" :
              parecer.aptidao === "acompanhamento" ? "bg-accent/5 border-accent/20" :
              "bg-destructive/5 border-destructive/20"
            }`}>
              <p className="font-montserrat font-black text-lg text-center mb-1">{parecer.aptidaoLabel}</p>
              <p className="font-inter text-xs text-muted-foreground text-center">
                Média geral: <strong className="text-foreground">{parecer.overall.toFixed(1)}/5</strong> — Gerado automaticamente com base nos dados reais
              </p>
            </div>

            {/* 4 dimensões */}
            <div className="space-y-3">
              {parecer.dimensions.map((dim, idx) => (
                <div key={idx} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{dim.emoji}</span>
                      <div>
                        <p className="font-montserrat font-bold text-sm text-foreground">{dim.label}</p>
                        <p className={`font-inter text-[10px] font-semibold ${
                          dim.score >= 4 ? "text-brand-green" : dim.score >= 3 ? "text-accent-foreground" : "text-destructive"
                        }`}>{dim.sublabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-montserrat font-black text-lg text-foreground">{dim.score}</span>
                      <span className="font-inter text-xs text-muted-foreground">/5</span>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${(dim.score / 5) * 100}%`,
                      background: dim.score >= 4 ? "var(--gradient-green)" : dim.score >= 3 ? "hsl(var(--accent))" : "hsl(var(--destructive))",
                    }} />
                  </div>
                  <p className="font-inter text-[11px] text-muted-foreground">{dim.detail}</p>
                </div>
              ))}
            </div>

            {/* Save aptidão */}
            <button
              onClick={async () => {
                const parecer = generateParecer();
                await supabase.from("discipleship_plans").upsert({
                  user_id: p.user_id,
                  aptidao: parecer.aptidao,
                  health_status: plan.health_status,
                }, { onConflict: "user_id" });
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              className="w-full py-3 rounded-xl font-inter font-semibold text-sm transition-all"
              style={{ background: "var(--gradient-hero)", color: "hsl(var(--primary-foreground))" }}
            >
              {saved ? "✅ Parecer salvo!" : "💾 Salvar parecer no plano de discipulado"}
            </button>

            <p className="font-inter text-[10px] text-muted-foreground text-center leading-relaxed">
              Este parecer é gerado automaticamente com base em dados de formação, devocionais, autoavaliação espiritual, presença em encontros e cultos, e avaliações de participação. O pastor pode ajustar manualmente na aba "Plano".
            </p>
          </div>
        );
      })()}

      {/* RELATÓRIO SECTION */}
      {activeSection === "relatorio" && (
        <PastoralReportPDF participant={p} activities={activities} />
      )}
    </div>
  );
}
