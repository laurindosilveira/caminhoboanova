import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ChevronDown, Filter, Users, CheckCircle, Clock, BookOpen,
  GraduationCap, CalendarDays, Zap, ChevronLeft, Phone, MapPin, Calendar, Star, AlertTriangle,
  Trash2, Eye, X, ChevronRight, Church, History, Pencil, Save, Heart, Lock, Unlock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ParticipantSheet from "./ParticipantSheet";

type Activity = { id: string; type: string; title: string; points: number; order_num: number; subtitle: string | null };
type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  confirmation_year?: number | null;
  completed_lesson_count?: number;
  completed_devotional_count?: number;
  completed_event_count?: number;
  faith_points?: number;
  avatar_url?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  address?: string | null;
};

type StatusReason = {
  icon: string;
  label: string;
  severity: "high" | "medium" | "low";
};

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

// ─── Real completion data types ───────────────────────────
type RealLessonCompletion = {
  lesson_id: string;
  lesson_title: string;
  course_title: string;
  responses: { question: string; response: string }[];
  completed_at: string | null;
  awarded_points: number;
};

type RealDevotionalCompletion = {
  devotional_id: string;
  title: string;
  day_number: number;
  lesson_title: string;
  bible_reference: string;
  questions: string[];
  completed_at: string;
  is_weekend: boolean;
  awarded_points: number;
};

type RealAttendanceRecord = {
  event_id: string;
  event_title: string;
  event_date: string;
  event_type: string;
  status: string;
};

type RealWorshipRecord = {
  id: string;
  event_type: string;
  worship_date: string;
  status: string;
};

const ACTIVITY_TYPES = [
  { value: "todos", label: "Todos os tipos" },
  { value: "devocional", label: "Devocionais" },
  { value: "estudo", label: "Estudos de licao" },
  { value: "presenca", label: "Presencas" },
  { value: "culto", label: "Cultos" },
];

function getStatusInfo(completed: number, total: number) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  if (pct === 0) return { label: "Nao iniciou", color: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" };
  if (pct < 34) return { label: "Iniciando", color: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive" };
  if (pct < 70) return { label: "Em andamento", color: "text-accent-foreground", bg: "bg-accent/30", dot: "bg-accent" };
  return { label: "Avancado", color: "text-brand-green", bg: "bg-brand-green/10", dot: "bg-brand-green" };
}

function calcAge(birthDate: string) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Audit Log Section ───────────────────────────────────
function AuditLogSection({ targetUserId, userName }: { targetUserId: string; userName: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_removal_log" as any)
        .select("*")
        .eq("target_user_id", targetUserId)
        .order("removed_at", { ascending: false }) as any;
      if (error) {
        setLogs([]);
        setProfiles({});
        setLoading(false);
        toast({ title: "Erro ao carregar log", description: error.message, variant: "destructive" });
        return;
      }
      const items = data ?? [];
      setLogs(items);

      // Fetch admin names
      const adminIds = [...new Set(items.map((l: any) => l.removed_by))] as string[];
      if (adminIds.length > 0) {
        const { data: profs, error: profilesError } = await supabase.from("profiles").select("user_id, full_name").in("user_id", adminIds);
        if (profilesError) {
          toast({ title: "Erro ao carregar responsaveis", description: profilesError.message, variant: "destructive" });
        }
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p.full_name; });
        setProfiles(map);
      }
      setLoading(false);
    }
    fetch();
  }, [targetUserId]);

  const typeEmoji: Record<string, string> = { estudo: "L", devocional: "D", presenca: "P" };

  if (loading) return <p className="text-center text-muted-foreground font-inter text-xs py-4 animate-pulse">Carregando log...</p>;

  if (logs.length === 0) return (
    <div className="text-center py-6 mt-3">
      <History className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
      <p className="font-inter text-xs text-muted-foreground">Nenhuma remocao registrada para {userName}.</p>
    </div>
  );

  return (
    <div className="mt-3 bg-card rounded-2xl border border-border p-4 space-y-2">
      <p className="font-montserrat font-bold text-foreground text-sm mb-2">Log de remocoes</p>
      {logs.map((log: any) => (
        <div key={log.id} className="bg-muted/30 rounded-xl p-3 border border-border">
          <div className="flex items-start gap-2">
            <span className="text-base">{typeEmoji[log.activity_type] ?? "🗑️"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-inter text-xs text-foreground font-medium truncate">
                {log.activity_title || log.activity_type}
              </p>
              <p className="font-inter text-[10px] text-muted-foreground">
                Removido por <strong>{profiles[log.removed_by] ?? "Admin"}</strong> - {log.points_removed}pts
              </p>
              <p className="font-inter text-[10px] text-muted-foreground">
                {new Date(log.removed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ParticipantDetail (rebuilt with REAL data) ──────────
type DetailProps = { participant: Participant; activities: Activity[]; onBack: () => void };

function ParticipantDetail({ participant: pOriginal, activities, onBack }: DetailProps) {
  const [localOverrides, setLocalOverrides] = useState<Partial<Participant>>({});
  const p = { ...pOriginal, ...localOverrides };
  const [typeFilter, setTypeFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Real data states
  const [lessonCompletions, setLessonCompletions] = useState<RealLessonCompletion[]>([]);
  const [devotionalCompletions, setDevotionalCompletions] = useState<RealDevotionalCompletion[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<RealAttendanceRecord[]>([]);
  const [worshipRecords, setWorshipRecords] = useState<RealWorshipRecord[]>([]);

  // Viewing detail
  const [viewingLesson, setViewingLesson] = useState<RealLessonCompletion | null>(null);
  const [viewingDevotional, setViewingDevotional] = useState<RealDevotionalCompletion | null>(null);

  // Delete states
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Extended profile data & edit
  type ExtendedProfile = {
    address?: string; father_name?: string; mother_name?: string;
    father_phone?: string; mother_phone?: string; turma_id?: string | null;
  };
  const [extProfile, setExtProfile] = useState<ExtendedProfile>({});
  const [turmas, setTurmas] = useState<{ id: string; name: string; area: string | null }[]>([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);

  useEffect(() => {
    fetchRealData();
    fetchExtendedProfile();
  }, [p.user_id]);

  async function fetchRealData() {
    setLoading(true);

    const [
      { data: lessonResps, error: lessonRespsError },
      { data: devProgress, error: devProgressError },
      { data: attData, error: attDataError },
      { data: worshipData, error: worshipDataError },
      { data: lessonsData, error: lessonsDataError },
      { data: coursesData, error: coursesDataError },
      { data: lessonContentData, error: lessonContentError },
      { data: devContentData, error: devContentError },
      { data: eventsData, error: eventsDataError },
    ] = await Promise.all([
      supabase.from("lesson_responses").select("lesson_id, question_key, response, created_at, awarded_points").eq("user_id", p.user_id).order("created_at"),
      supabase.from("devotional_progress").select("devotional_id, completed_at, awarded_points").eq("user_id", p.user_id).order("completed_at"),
      supabase.from("attendance").select("event_id, status, created_at").eq("user_id", p.user_id).order("created_at", { ascending: false }),
      supabase.from("worship_attendance").select("id, event_type, worship_date, status").eq("user_id", p.user_id).eq("status", "aprovado").order("worship_date"),
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
      supabase.from("courses").select("id, title, order_num").order("order_num"),
      supabase.from("lesson_content").select("lesson_id, questions"),
      supabase.from("devotional_content").select("id, lesson_id, title, day_number, bible_reference, questions"),
      supabase.from("events").select("id, title, event_date, type").order("event_date", { ascending: false }),
    ]);

    const loadError = lessonRespsError
      ?? devProgressError
      ?? attDataError
      ?? worshipDataError
      ?? lessonsDataError
      ?? coursesDataError
      ?? lessonContentError
      ?? devContentError
      ?? eventsDataError;

    if (loadError) {
      setLessonCompletions([]);
      setDevotionalCompletions([]);
      setAttendanceRecords([]);
      setWorshipRecords([]);
      setLoading(false);
      toast({
        title: "Erro ao carregar participante",
        description: loadError.message,
        variant: "destructive",
      });
      return;
    }

    // Build lesson completions
    const courseMap = new Map((coursesData ?? []).map(c => [c.id, c.title]));
    const lessonContentMap = new Map((lessonContentData ?? []).map(lc => [lc.lesson_id, lc.questions as string[]]));
    const respsByLesson = new Map<string, Map<string, { response: string; created_at: string; awarded_points: number | null }>>();
    (lessonResps ?? []).forEach(r => {
      if (!respsByLesson.has(r.lesson_id)) respsByLesson.set(r.lesson_id, new Map());
      respsByLesson.get(r.lesson_id)!.set(r.question_key, {
        response: r.response,
        created_at: r.created_at,
        awarded_points: typeof r.awarded_points === "number" ? r.awarded_points : null,
      });
    });

    const lCompletions: RealLessonCompletion[] = [];
    (lessonsData ?? []).forEach(lesson => {
      const respMap = respsByLesson.get(lesson.id);
      if (!respMap || respMap.size === 0) return;
      const questions = lessonContentMap.get(lesson.id) ?? [];
      const responses = questions.map((q, i) => ({
        question: q,
        response: respMap.get(`q${i}`)?.response ?? respMap.get(`question_${i}`)?.response ?? respMap.get(String(i))?.response ?? "",
      }));
      // Also add any responses not matching questions
      respMap.forEach((val, key) => {
        if (!responses.some(r => r.response === val.response && r.response !== "")) {
          if (val.response) responses.push({ question: key, response: val.response });
        }
      });
      const firstResp = Array.from(respMap.values())[0];
      const awardedPoints = Array.from(respMap.values()).find((value) => typeof value.awarded_points === "number")?.awarded_points ?? 20;
      lCompletions.push({
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        course_title: courseMap.get(lesson.course_id) ?? "",
        responses: responses.filter(r => r.response),
        completed_at: firstResp?.created_at ?? null,
        awarded_points: awardedPoints,
      });
    });
    setLessonCompletions(lCompletions);

    // Build devotional completions
    const devContentMap = new Map((devContentData ?? []).map(d => [d.id, d]));
    const lessonTitleMap = new Map((lessonsData ?? []).map(l => [l.id, l.title]));
    const dCompletions: RealDevotionalCompletion[] = [];
    (devProgress ?? []).forEach(dp => {
      const content = devContentMap.get(dp.devotional_id);
      if (!content) return;
      const completedDate = new Date(dp.completed_at);
      const dow = completedDate.getDay();
      dCompletions.push({
        devotional_id: dp.devotional_id,
        title: content.title || `Dia ${content.day_number}`,
        day_number: content.day_number,
        lesson_title: content.lesson_id ? (lessonTitleMap.get(content.lesson_id) ?? "") : "",
        bible_reference: content.bible_reference,
        questions: content.questions ?? [],
        completed_at: dp.completed_at,
        is_weekend: dow === 0 || dow === 6,
        awarded_points: typeof dp.awarded_points === "number" ? dp.awarded_points : (dow === 0 || dow === 6 ? 2 : 5),
      });
    });
    setDevotionalCompletions(dCompletions);

    // Build attendance records
    const eventMap = new Map((eventsData ?? []).map(e => [e.id, e]));
    const aRecords: RealAttendanceRecord[] = [];
    (attData ?? []).forEach(a => {
      const event = eventMap.get(a.event_id);
      aRecords.push({
        event_id: a.event_id,
        event_title: event?.title ?? "Evento",
        event_date: event?.event_date ?? a.created_at,
        event_type: event?.type ?? "encontro",
        status: a.status,
      });
    });
    setAttendanceRecords(aRecords);

    // Worship
    setWorshipRecords((worshipData ?? []) as RealWorshipRecord[]);

    setLoading(false);
  }

  async function fetchExtendedProfile() {
    const [{ data: profileData, error: profileError }, { data: turmasData, error: turmasError }] = await Promise.all([
      supabase.from("profiles").select("address, father_name, mother_name, father_phone, mother_phone, turma_id").eq("user_id", p.user_id).maybeSingle(),
      supabase.from("turmas").select("id, name, area").eq("is_active", true).order("name"),
    ]);
    if (profileError || turmasError) {
      toast({
        title: "Erro ao carregar dados complementares",
        description: profileError?.message ?? turmasError?.message,
        variant: "destructive",
      });
    }
    setExtProfile(profileData ?? {});
    setTurmas(turmasData ?? []);
  }

  function startEditing() {
    setEditForm({
      full_name: p.full_name, phone: p.phone, birth_date: p.birth_date,
      address: extProfile.address ?? "", father_name: extProfile.father_name ?? "",
      mother_name: extProfile.mother_name ?? "", father_phone: extProfile.father_phone ?? "",
      mother_phone: extProfile.mother_phone ?? "", confirmation_year: p.confirmation_year,
      turma_id: extProfile.turma_id ?? null,
    });
    setEditing(true);
  }

  async function saveEdits() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name?.trim() || p.full_name,
      phone: editForm.phone?.trim() || p.phone,
      birth_date: editForm.birth_date || p.birth_date,
      address: editForm.address?.trim() ?? "",
      father_name: editForm.father_name?.trim() ?? "",
      mother_name: editForm.mother_name?.trim() ?? "",
      father_phone: editForm.father_phone?.trim() ?? "",
      mother_phone: editForm.mother_phone?.trim() ?? "",
      confirmation_year: editForm.confirmation_year ?? null,
      turma_id: editForm.turma_id ?? null,
      enrollment_status: editForm.turma_id ? "approved" : "pending",
    } as any).eq("user_id", p.user_id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados atualizados!" });
      setLocalOverrides(prev => ({
        ...prev,
        full_name: editForm.full_name?.trim() || p.full_name,
        phone: editForm.phone?.trim() || p.phone,
        birth_date: editForm.birth_date || p.birth_date,
        confirmation_year: editForm.confirmation_year ?? null,
      }));
      setExtProfile(prev => ({
        ...prev, address: editForm.address?.trim(), father_name: editForm.father_name?.trim(),
        mother_name: editForm.mother_name?.trim(), father_phone: editForm.father_phone?.trim(),
        mother_phone: editForm.mother_phone?.trim(), turma_id: editForm.turma_id,
      }));
      setEditing(false);
    }
    setSaving(false);
  }

  // ── Delete handlers ──
  async function logRemoval(activityType: string, activityId: string, activityTitle: string, pointsRemoved: number) {
    if (!user) return;
    const { error } = await supabase.from("activity_removal_log" as any).insert({
      removed_by: user.id,
      target_user_id: p.user_id,
      activity_type: activityType,
      activity_id: activityId,
      activity_title: activityTitle,
      points_removed: pointsRemoved,
    } as any);
    if (error) throw error;
  }

  async function handleDeleteLesson(lessonId: string) {
    setDeletingType("estudo");
    setDeletingId(lessonId);
    const lesson = lessonCompletions.find(l => l.lesson_id === lessonId);
    const pointsRemoved = lesson?.awarded_points ?? 20;
    const { error } = await supabase.from("lesson_responses").delete().eq("user_id", p.user_id).eq("lesson_id", lessonId);
    if (error) {
      toast({ title: "Erro ao remover estudo", description: error.message, variant: "destructive" });
      setDeletingType(null);
      setDeletingId(null);
      return;
    }
    try {
      await logRemoval("estudo", lessonId, lesson?.lesson_title ?? "", pointsRemoved);
    } catch (logError: any) {
      toast({ title: "Estudo removido com alerta", description: `As respostas foram removidas, mas o log falhou: ${logError.message}`, variant: "destructive" });
    }
    setLessonCompletions(prev => prev.filter(l => l.lesson_id !== lessonId));
    toast({ title: "Estudo removido", description: "Respostas e pontuacao foram removidas. Registro salvo no log." });
    setDeletingType(null);
    setDeletingId(null);
    setConfirmDeleteKey(null);
    setViewingLesson(null);
  }

  async function handleDeleteDevotional(devotionalId: string) {
    setDeletingType("devocional");
    setDeletingId(devotionalId);
    const dev = devotionalCompletions.find(d => d.devotional_id === devotionalId);
    const pts = dev?.awarded_points ?? (dev?.is_weekend ? 2 : 5);
    const { error } = await supabase.from("devotional_progress").delete().eq("user_id", p.user_id).eq("devotional_id", devotionalId);
    if (error) {
      toast({ title: "Erro ao remover devocional", description: error.message, variant: "destructive" });
      setDeletingType(null);
      setDeletingId(null);
      return;
    }
    try {
      await logRemoval("devocional", devotionalId, dev?.title ?? "", pts);
    } catch (logError: any) {
      toast({ title: "Devocional removido com alerta", description: `A conclusao foi removida, mas o log falhou: ${logError.message}`, variant: "destructive" });
    }
    setDevotionalCompletions(prev => prev.filter(d => d.devotional_id !== devotionalId));
    toast({ title: "Devocional removido", description: "Conclusao e pontuacao foram removidas. Registro salvo no log." });
    setDeletingType(null);
    setDeletingId(null);
    setConfirmDeleteKey(null);
    setViewingDevotional(null);
  }

  async function handleDeleteAttendance(eventId: string) {
    setDeletingType("presenca");
    setDeletingId(eventId);
    const att = attendanceRecords.find(a => a.event_id === eventId);
    const { error } = await supabase.from("attendance").delete().eq("user_id", p.user_id).eq("event_id", eventId);
    if (error) {
      toast({ title: "Erro ao remover presenca", description: error.message, variant: "destructive" });
      setDeletingType(null);
      setDeletingId(null);
      return;
    }
    try {
      await logRemoval("presenca", eventId, att?.event_title ?? "", 10);
    } catch (logError: any) {
      toast({ title: "Presenca removida com alerta", description: `O registro foi removido, mas o log falhou: ${logError.message}`, variant: "destructive" });
    }
    setAttendanceRecords(prev => prev.filter(a => a.event_id !== eventId));
    toast({ title: "Presenca removida", description: "Registro de presenca foi removido. Registro salvo no log." });
    setDeletingType(null);
    setDeletingId(null);
    setConfirmDeleteKey(null);
  }

  // ── Points calculation (real data) ──
  const lessonPts = lessonCompletions.reduce((sum, lesson) => sum + lesson.awarded_points, 0);
  const devPts = devotionalCompletions.reduce((sum, devotional) => sum + devotional.awarded_points, 0);
  const attendancePts = attendanceRecords.filter(a => a.status === "presente").length * 10;
  const worshipPts = worshipRecords.length * 5;
  const totalPts = lessonPts + devPts + attendancePts + worshipPts;

  const totalRealActivities = lessonCompletions.length + devotionalCompletions.length + attendanceRecords.filter(a => a.status === "presente").length + worshipRecords.length;

  const age = calcAge(p.birth_date);

  // ── Viewing lesson detail ──
  if (viewingLesson) {
    return (
      <div>
        <button onClick={() => { setViewingLesson(null); }} className="flex items-center gap-2 text-muted-foreground font-inter text-sm mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar as atividades
        </button>

        <div className="bg-card rounded-2xl border border-border p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-montserrat font-bold text-foreground text-sm">{viewingLesson.lesson_title}</h3>
              <p className="font-inter text-[10px] text-muted-foreground">
                Estudo de licao - {viewingLesson.course_title} - +20 pts
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-green/10 text-brand-green">Concluida</span>
          </div>

          {viewingLesson.completed_at && (
            <div className="bg-brand-green/5 rounded-xl p-3 border border-brand-green/20 mb-3">
              <p className="font-inter text-xs text-brand-green">
                Respondido em {new Date(viewingLesson.completed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}

          {viewingLesson.responses.length > 0 ? (
            <div className="space-y-3">
              <p className="font-montserrat font-bold text-foreground text-xs">Respostas do aluno:</p>
              {viewingLesson.responses.map((r, i) => (
                <div key={i} className="bg-muted/30 rounded-xl p-3 border border-border space-y-1.5">
                  <p className="font-inter text-xs text-muted-foreground font-medium">{r.question}</p>
                  <p className="font-inter text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.response}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="font-inter text-sm text-muted-foreground">Nenhuma resposta encontrada para esta licao.</p>
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          {confirmDeleteKey === `lesson-${viewingLesson.lesson_id}` ? (
            <div className="space-y-3">
              <p className="font-inter text-sm text-destructive font-medium">Tem certeza que deseja remover este estudo?</p>
              <p className="font-inter text-xs text-muted-foreground">Isso ira remover as respostas e -20pts de <strong>{p.full_name}</strong>.</p>
              <div className="flex gap-2">
                <button onClick={() => handleDeleteLesson(viewingLesson.lesson_id)}
                  disabled={deletingId === viewingLesson.lesson_id}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-inter text-sm font-medium disabled:opacity-50">
                  {deletingId === viewingLesson.lesson_id ? "Removendo..." : "Confirmar remocao"}
                </button>
                <button onClick={() => setConfirmDeleteKey(null)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteKey(`lesson-${viewingLesson.lesson_id}`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive font-inter text-sm font-medium hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" /> Remover estudo e pontuacao
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Viewing devotional detail ──
  if (viewingDevotional) {
    return (
      <div>
        <button onClick={() => setViewingDevotional(null)} className="flex items-center gap-2 text-muted-foreground font-inter text-sm mb-4 hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar as atividades
        </button>

        <div className="bg-card rounded-2xl border border-border p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-green/10 text-brand-green">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-montserrat font-bold text-foreground text-sm">{viewingDevotional.title}</h3>
              <p className="font-inter text-[10px] text-muted-foreground">
                Devocional - {viewingDevotional.lesson_title} - +{viewingDevotional.is_weekend ? 2 : 5} pts
                {viewingDevotional.is_weekend && <span className="text-accent-foreground ml-1">(fim de semana)</span>}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-green/10 text-brand-green">Concluido</span>
          </div>

          <div className="space-y-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="font-inter text-xs text-muted-foreground mb-1">Referencia biblica</p>
              <p className="font-inter text-sm text-foreground">{viewingDevotional.bible_reference || "Nao informada"}</p>
            </div>
            <div className="bg-brand-green/5 rounded-xl p-3 border border-brand-green/20">
              <p className="font-inter text-xs text-brand-green">
                Concluido em {new Date(viewingDevotional.completed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {viewingDevotional.is_weekend && " (recuperacao de fim de semana)"}
              </p>
            </div>
            {viewingDevotional.questions.length > 0 && (
              <div className="space-y-2">
                <p className="font-montserrat font-bold text-foreground text-xs">Perguntas do devocional:</p>
                {viewingDevotional.questions.filter(q => q.trim()).map((q, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="font-inter text-xs text-muted-foreground mb-1">Pergunta {i + 1}:</p>
                    <p className="font-inter text-sm text-foreground">{q}</p>
                    <p className="font-inter text-[10px] text-muted-foreground mt-1 italic">Respostas de devocionais nao sao salvas no banco</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
          {confirmDeleteKey === `dev-${viewingDevotional.devotional_id}` ? (
            <div className="space-y-3">
              <p className="font-inter text-sm text-destructive font-medium">Tem certeza que deseja remover este devocional?</p>
              <p className="font-inter text-xs text-muted-foreground">Isso ira remover a conclusao e -{viewingDevotional.is_weekend ? 2 : 5}pts de <strong>{p.full_name}</strong>.</p>
              <div className="flex gap-2">
                <button onClick={() => handleDeleteDevotional(viewingDevotional.devotional_id)}
                  disabled={deletingId === viewingDevotional.devotional_id}
                  className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground font-inter text-sm font-medium disabled:opacity-50">
                  {deletingId === viewingDevotional.devotional_id ? "Removendo..." : "Confirmar remocao"}
                </button>
                <button onClick={() => setConfirmDeleteKey(null)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteKey(`dev-${viewingDevotional.devotional_id}`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive font-inter text-sm font-medium hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" /> Remover devocional e pontuação
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando dados reais...</p>
      </div>
    );
  }

  // ── Filtered items for the list ──
  type ListItem = {
    key: string;
    type: "estudo" | "devocional" | "presenca" | "culto";
    title: string;
    subtitle: string;
    pts: number;
    date: string | null;
    onClick: () => void;
    onDelete: () => void;
    isWeekend?: boolean;
  };

  const items: ListItem[] = [];

  // Lessons studied
  lessonCompletions.forEach(l => {
    items.push({
      key: `lesson-${l.lesson_id}`,
      type: "estudo",
      title: l.lesson_title,
      subtitle: l.course_title,
      pts: 20,
      date: l.completed_at,
      onClick: () => setViewingLesson(l),
      onDelete: () => { setConfirmDeleteKey(`lesson-${l.lesson_id}`); },
    });
  });

  // Devotionals completed
  devotionalCompletions.forEach(d => {
    items.push({
      key: `dev-${d.devotional_id}`,
      type: "devocional",
      title: d.title,
      subtitle: d.lesson_title ? `${d.lesson_title} · Dia ${d.day_number}` : `Dia ${d.day_number}`,
      pts: d.is_weekend ? 2 : 5,
      date: d.completed_at,
      onClick: () => setViewingDevotional(d),
      onDelete: () => { setConfirmDeleteKey(`dev-${d.devotional_id}`); },
      isWeekend: d.is_weekend,
    });
  });

  // Attendance
  attendanceRecords.filter(a => a.status === "presente").forEach(a => {
    items.push({
      key: `att-${a.event_id}`,
      type: "presenca",
      title: a.event_title,
      subtitle: new Date(a.event_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
      pts: 10,
      date: a.event_date,
      onClick: () => {},
      onDelete: () => { setConfirmDeleteKey(`att-${a.event_id}`); },
    });
  });

  // Worship
  worshipRecords.forEach(w => {
    const label = w.event_type === "jemiac" ? "JEMIAC" : w.event_type === "retiro" ? "Retiro" : "Culto";
    items.push({
      key: `worship-${w.id}`,
      type: "culto",
      title: label,
      subtitle: new Date(w.worship_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
      pts: 5,
      date: w.worship_date,
      onClick: () => {},
      onDelete: () => {},
    });
  });

  const filteredItems = typeFilter === "todos" ? items : items.filter(i => i.type === typeFilter);

  const typeIcon = (type: string) => {
    if (type === "devocional") return <BookOpen className="w-3.5 h-3.5" />;
    if (type === "estudo") return <GraduationCap className="w-3.5 h-3.5" />;
    if (type === "presenca") return <CalendarDays className="w-3.5 h-3.5" />;
    if (type === "culto") return <Church className="w-3.5 h-3.5" />;
    return <Zap className="w-3.5 h-3.5" />;
  };

  const typeColor = (type: string) => {
    if (type === "devocional") return "text-brand-green bg-brand-green/10";
    if (type === "estudo") return "text-secondary bg-secondary/10";
    if (type === "presenca") return "text-primary bg-primary/10";
    if (type === "culto") return "text-accent-foreground bg-accent/20";
    return "text-muted-foreground bg-muted";
  };

  const typeLabel = (type: string) => {
    if (type === "devocional") return "devocional";
    if (type === "estudo") return "estudo";
    if (type === "presenca") return "presenca";
    if (type === "culto") return "culto";
    return type;
  };

  // Status based on real data
  const totalPossibleLessons = activities.filter(a => a.type === "formacao").length || 1;
  const realPct = Math.min(100, Math.round(
    ((lessonCompletions.length / Math.max(totalPossibleLessons, 1)) * 50) +
    ((devotionalCompletions.length / Math.max(1, 1)) * 20) +
    ((attendanceRecords.filter(a => a.status === "presente").length / Math.max(1, 1)) * 30)
  ));
  const status = totalRealActivities === 0
    ? { label: "Nao iniciou", color: "text-muted-foreground", bg: "bg-muted" }
    : totalRealActivities < 5
    ? { label: "Iniciando", color: "text-destructive", bg: "bg-destructive/10" }
    : totalRealActivities < 15
    ? { label: "Em andamento", color: "text-accent-foreground", bg: "bg-accent/30" }
    : { label: "Avancado", color: "text-brand-green", bg: "bg-brand-green/10" };

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground font-inter text-sm mb-4 hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar aos participantes
      </button>

      {/* Profile card */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={p.full_name}
              className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowAvatarZoom(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="font-montserrat font-black text-primary text-2xl">{p.full_name.charAt(0).toUpperCase()}</span>
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
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>
          )}
          <div className="flex-1">
            <h2 className="font-montserrat font-black text-foreground text-lg">{p.full_name}</h2>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-inter font-medium ${status.bg} ${status.color}`}>{status.label}</span>
          </div>
          {!editing && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={startEditing} title="Editar dados">
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome completo</label>
              <Input value={editForm.full_name ?? ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Telefone</label>
                <Input value={editForm.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Data nasc.</label>
                <Input type="date" value={editForm.birth_date ?? ""} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Endereco</label>
              <Input value={editForm.address ?? ""} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Ano confirmacao</label>
                <Input type="number" min={1} max={3} value={editForm.confirmation_year ?? ""} onChange={e => setEditForm(f => ({ ...f, confirmation_year: e.target.value ? Number(e.target.value) : null }))} className="text-sm" placeholder="1 ou 2" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Turma</label>
                <select value={editForm.turma_id ?? ""} onChange={e => setEditForm(f => ({ ...f, turma_id: e.target.value || null }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Sem turma</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.name}{t.area ? ` (${t.area})` : ""}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome do pai</label>
                <Input value={editForm.father_name ?? ""} onChange={e => setEditForm(f => ({ ...f, father_name: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Tel. pai</label>
                <Input value={editForm.father_phone ?? ""} onChange={e => setEditForm(f => ({ ...f, father_phone: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome da mae</label>
                <Input value={editForm.mother_name ?? ""} onChange={e => setEditForm(f => ({ ...f, mother_name: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Tel. mae</label>
                <Input value={editForm.mother_phone ?? ""} onChange={e => setEditForm(f => ({ ...f, mother_phone: e.target.value }))} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setEditing(false)} disabled={saving}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={saveEdits} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground font-inter">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{p.community} · {p.area}</span>
              </div>
              {p.phone && (
                <div className="flex items-center gap-2 text-muted-foreground font-inter">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <a href={`tel:${p.phone}`} className="text-primary hover:underline">{p.phone}</a>
                </div>
              )}
              {age !== null && (
                <div className="flex items-center gap-2 text-muted-foreground font-inter">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{age} anos</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground font-inter">
                <GraduationCap className="w-4 h-4 flex-shrink-0" />
                <span>{p.confirmation_year ? `${p.confirmation_year}º Ano` : <span className="text-destructive">Ano nao definido</span>}</span>
              </div>
              <div className="flex items-center gap-2 text-accent font-montserrat font-bold">
                <Star className="w-4 h-4 flex-shrink-0" />
                <span>{totalPts} pontos</span>
              </div>
              {extProfile.address && (
                <div className="flex items-center gap-2 text-muted-foreground font-inter col-span-2">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{extProfile.address}</span>
                </div>
              )}
            </div>

            {/* Parents info */}
            {(extProfile.father_name || extProfile.mother_name) && (
              <div className="border-t border-border pt-3 mt-3 space-y-1">
                {extProfile.father_name && (
                  <div className="text-xs font-inter text-muted-foreground">
                    <span className="font-semibold">Pai:</span> {extProfile.father_name}
                    {extProfile.father_phone && (
                      <a href={`tel:${extProfile.father_phone}`} className="ml-1.5 text-primary hover:underline">{extProfile.father_phone}</a>
                    )}
                  </div>
                )}
                {extProfile.mother_name && (
                  <div className="text-xs font-inter text-muted-foreground">
                    <span className="font-semibold">Mae:</span> {extProfile.mother_name}
                    {extProfile.mother_phone && (
                      <a href={`tel:${extProfile.mother_phone}`} className="ml-1.5 text-primary hover:underline">{extProfile.mother_phone}</a>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mini stats by real data */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Devocionais", icon: "📖", done: devotionalCompletions.length },
          { label: "Estudos", icon: "🎓", done: lessonCompletions.length },
          { label: "Presencas", icon: "📅", done: attendanceRecords.filter(a => a.status === "presente").length },
          { label: "Cultos", icon: "⛪", done: worshipRecords.length },
        ].map(({ label, icon, done }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{icon}</span>
              <span className="font-inter text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="font-montserrat font-black text-foreground text-lg leading-none">{done}</p>
          </div>
        ))}
      </div>

      {/* Pontuacao detalhada */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4">
        <p className="font-montserrat font-bold text-foreground text-sm mb-2">📊 Detalhamento de pontos</p>
        <div className="space-y-1.5">
          <div className="flex justify-between font-inter text-xs">
            <span className="text-muted-foreground">Estudos ({lessonCompletions.length} concluidos)</span>
            <span className="text-brand-green font-bold">+{lessonPts}</span>
          </div>
          <div className="flex justify-between font-inter text-xs">
            <span className="text-muted-foreground">Devocionais ({devotionalCompletions.length} concluidos)</span>
            <span className="text-brand-green font-bold">+{devPts}</span>
          </div>
          <div className="flex justify-between font-inter text-xs">
            <span className="text-muted-foreground">Presencas ({attendanceRecords.filter(a => a.status === "presente").length} confirmadas)</span>
            <span className="text-brand-green font-bold">+{attendancePts}</span>
          </div>
          <div className="flex justify-between font-inter text-xs">
            <span className="text-muted-foreground">Cultos ({worshipRecords.length} × 5pts)</span>
            <span className="text-brand-green font-bold">+{worshipPts}</span>
          </div>
          <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
            <span className="font-montserrat font-bold text-foreground text-sm">Total verificado</span>
            <span className="font-montserrat font-black text-brand-green text-sm">+{totalPts} pts</span>
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="font-montserrat font-bold text-foreground text-sm">Atividades verificadas</p>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-inter border border-border rounded-lg px-2 py-1 bg-background text-foreground focus:outline-none">
            {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <p className="font-inter text-[10px] text-muted-foreground mb-3">
          Somente atividades com dados reais registrados · Clique para ver respostas
        </p>

        {filteredItems.length === 0 ? (
          <div className="text-center py-8">
            <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="font-inter text-sm text-muted-foreground">Nenhuma atividade verificada encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div key={item.key} className="relative">
                <div
                  onClick={item.onClick}
                  className={`flex items-center gap-3 rounded-xl p-2.5 transition-all ${
                    item.type === "estudo" || item.type === "devocional" ? "cursor-pointer hover:bg-muted/50" : ""
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-green/10">
                    <CheckCircle className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-xs text-foreground truncate">{item.title}</p>
                    <p className="font-inter text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 ${typeColor(item.type)}`}>
                    {typeIcon(item.type)} {typeLabel(item.type)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-inter font-bold ${item.isWeekend ? "text-accent-foreground" : "text-accent"}`}>
                      +{item.pts}pts{item.isWeekend ? "⚠️" : ""}
                    </span>
                    {(item.type === "estudo" || item.type === "devocional") && (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Inline delete confirmation */}
                {confirmDeleteKey === item.key && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 mt-1 space-y-2">
                    <p className="font-inter text-xs text-destructive">⚠️ Remover esta atividade de {p.full_name}?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (item.type === "estudo") handleDeleteLesson(item.key.replace("lesson-", ""));
                          else if (item.type === "devocional") handleDeleteDevotional(item.key.replace("dev-", ""));
                          else if (item.type === "presenca") handleDeleteAttendance(item.key.replace("att-", ""));
                        }}
                        disabled={!!deletingId}
                        className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground font-inter text-xs font-medium disabled:opacity-50"
                      >
                        {deletingId ? "Removendo..." : "🗑️ Confirmar"}
                      </button>
                      <button onClick={() => setConfirmDeleteKey(null)} className="px-3 py-2 rounded-lg bg-muted text-foreground font-inter text-xs">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit log button */}
      <div className="mt-4">
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-muted-foreground font-inter text-xs font-medium hover:bg-muted/50 transition-colors"
        >
          <History className="w-4 h-4" />
          {showAuditLog ? "Ocultar" : "Ver"} histórico de remoções
        </button>

        {showAuditLog && <AuditLogSection targetUserId={p.user_id} userName={p.full_name} />}
      </div>
    </div>
  );
}

// ─── Main ParticipantsTab ────────────────────────────────
type Props = {
  participants: Participant[];
  activities: Activity[];
  communities: string[];
};

type StatusFilter = "todos" | "iniciando" | "andamento" | "avancado";

export default function ParticipantsTab({ participants, activities, communities }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [communityFilter, setCommunityFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [yearFilter, setYearFilter] = useState<string>("todos");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState<Participant | null>(null);
  const [isDeletingParticipant, setIsDeletingParticipant] = useState(false);
  const [deletedParticipantIds, setDeletedParticipantIds] = useState<Set<string>>(new Set());

  // Course unlock management
  const myArea = profile?.area ?? "";
  const [courses, setCourses] = useState<{ id: string; title: string; order_num: number }[]>([]);
  const [unlockedCourseIds, setUnlockedCourseIds] = useState<Set<string>>(new Set());
  const [unlockLoading, setUnlockLoading] = useState<string | null>(null);

  const [statusReasons, setStatusReasons] = useState<Record<string, StatusReason[]>>({});

  // Fetch course unlocks
  useEffect(() => {
    async function fetchCourseUnlocks() {
      const [{ data: coursesData }, { data: unlocksData }] = await Promise.all([
        supabase.from("courses").select("id, title, order_num").order("order_num"),
        supabase.from("course_unlocks").select("course_id, area").eq("area", myArea),
      ]);
      setCourses(coursesData ?? []);
      setUnlockedCourseIds(new Set((unlocksData ?? []).map((u: any) => u.course_id)));
    }
    if (myArea) fetchCourseUnlocks();
  }, [myArea]);

  async function toggleCourseUnlock(courseId: string) {
    setUnlockLoading(courseId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUnlockLoading(null); return; }
    if (unlockedCourseIds.has(courseId)) {
      const { error } = await supabase.from("course_unlocks").delete().eq("course_id", courseId).eq("area", myArea);
      if (error) {
        toast({ title: "Erro ao bloquear curso", description: error.message, variant: "destructive" });
      } else {
        setUnlockedCourseIds(prev => { const n = new Set(prev); n.delete(courseId); return n; });
      }
    } else {
      const { error } = await supabase.from("course_unlocks").insert({ course_id: courseId, area: myArea, unlocked_by: user.id } as any);
      if (error) {
        toast({ title: "Erro ao liberar curso", description: error.message, variant: "destructive" });
      } else {
        setUnlockedCourseIds(prev => new Set(prev).add(courseId));
      }
    }
    setUnlockLoading(null);
  }

  async function deleteParticipant() {
    if (!deletingParticipant) return;
    setIsDeletingParticipant(true);
    try {
      const res = await supabase.rpc("delete_user_from_discipleship" as any, {
        _target_user_id: deletingParticipant.user_id,
      });

      if (res.error || res.data?.error) {
        toast({
          title: "Erro ao deletar usuario",
          description: res.data?.error || res.error?.message,
          variant: "destructive",
        });
        return;
      }

      setDeletedParticipantIds(prev => new Set(prev).add(deletingParticipant.user_id));
      if (selectedParticipant?.user_id === deletingParticipant.user_id) setSelectedParticipant(null);
      toast({
        title: "Usuario deletado",
        description: `${deletingParticipant.full_name} foi removido do banco de dados.`,
      });
      setDeletingParticipant(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletingParticipant(false);
    }
  }

  // Fetch objective status reasons from DB
  useEffect(() => {
    async function fetchReasons() {
      const userIds = participants.map(p => p.user_id);
      if (userIds.length === 0) return;

      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const [{ data: devData }, { data: attData }, { data: planData }, { data: assessData }] = await Promise.all([
        supabase.from("devotional_progress").select("user_id, completed_at").in("user_id", userIds),
        supabase.from("attendance").select("user_id, status, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
        supabase.from("discipleship_plans").select("user_id, health_status, is_priority").in("user_id", userIds),
        supabase.from("spiritual_assessments").select("user_id, needs_pastor, prayer_score, presence_score, month, year")
          .in("user_id", userIds).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()),
      ]);

      // Last devotional per user
      const lastDev: Record<string, Date> = {};
      (devData ?? []).forEach(d => {
        const dt = new Date(d.completed_at);
        if (!lastDev[d.user_id] || dt > lastDev[d.user_id]) lastDev[d.user_id] = dt;
      });

      // Consecutive absences per user
      const userAtt: Record<string, string[]> = {};
      (attData ?? []).forEach(a => {
        if (!userAtt[a.user_id]) userAtt[a.user_id] = [];
        userAtt[a.user_id].push(a.status);
      });

      const planMap: Record<string, { health_status: string; is_priority: boolean }> = {};
      (planData ?? []).forEach(p => { planMap[p.user_id] = { health_status: p.health_status, is_priority: p.is_priority ?? false }; });

      const assessMap: Record<string, any> = {};
      (assessData ?? []).forEach(a => { assessMap[a.user_id] = a; });

      const reasons: Record<string, StatusReason[]> = {};

      participants.forEach(p => {
        const r: StatusReason[] = [];

        // Consecutive absences
        const statuses = userAtt[p.user_id] ?? [];
        let consecutive = 0;
        for (const s of statuses) {
          const normalizedStatus = normalizeAttendanceStatus(s);
          if (normalizedStatus === "presente") break;
          if (normalizedStatus === "faltou") {
            consecutive++;
            continue;
          }
          continue;
        }
        if (consecutive >= 3) r.push({ icon: "📅", label: `${consecutive} faltas seguidas`, severity: "high" });
        else if (consecutive === 2) r.push({ icon: "📅", label: "2 faltas seguidas", severity: "medium" });

        // Devotional inactivity
        const last = lastDev[p.user_id];
        if (!last) {
          r.push({ icon: "📖", label: "Nunca fez devocional", severity: "high" });
        } else if (last < fourteenDaysAgo) {
          const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          r.push({ icon: "📖", label: `Sem devocional ha ${days} dias`, severity: "high" });
        } else if (last < tenDaysAgo) {
          const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          r.push({ icon: "📖", label: `Sem devocional ha ${days} dias`, severity: "medium" });
        }

        // Needs pastor
        if (assessMap[p.user_id]?.needs_pastor) {
          r.push({ icon: "🙏", label: "Pediu ajuda pastoral", severity: "high" });
        }

        // Health status
        const plan = planMap[p.user_id];
        if (plan?.health_status === "critico") {
          r.push({ icon: "🚨", label: "Status critico", severity: "high" });
        } else if (plan?.is_priority) {
          r.push({ icon: "⚠️", label: "Prioridade pastoral", severity: "medium" });
        }

        // Low activity progress
        if (activities.length > 0 && p.completed_count === 0) {
          r.push({ icon: "😴", label: "Nenhuma atividade concluída", severity: "medium" });
        }

        if (r.length > 0) reasons[p.user_id] = r;
      });

      setStatusReasons(reasons);
    }
    fetchReasons();
  }, [participants, activities]);

  if (selectedParticipant) {
    return <ParticipantSheet participant={selectedParticipant} activities={activities} onBack={() => setSelectedParticipant(null)} />;
  }

  const visibleParticipants = participants.filter((p) => !deletedParticipantIds.has(p.user_id));

  const filtered = visibleParticipants.filter((p) => {
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase()) && !p.community.toLowerCase().includes(search.toLowerCase())) return false;
    if (communityFilter !== "todas" && p.community !== communityFilter) return false;
    if (yearFilter !== "todos" && p.confirmation_year !== Number(yearFilter)) return false;
    const pct = activities.length > 0 ? (p.completed_count / activities.length) * 100 : 0;
    if (statusFilter === "iniciando" && (pct === 0 || pct >= 34)) return false;
    if (statusFilter === "andamento" && (pct < 34 || pct >= 70)) return false;
    if (statusFilter === "avancado" && pct < 70) return false;
    return true;
  }).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR", { sensitivity: "base" }));

  // ── Group summary metrics ──
  const visibleParticipantIds = new Set(visibleParticipants.map(p => p.user_id));
  const totalDevotionals = visibleParticipants.reduce((s, p) => s + (p.completed_devotional_count ?? 0), 0);
  const totalLessons = visibleParticipants.reduce((s, p) => s + (p.completed_lesson_count ?? 0), 0);
  const totalPresences = visibleParticipants.reduce((s, p) => s + (p.completed_event_count ?? 0), 0);
  const alertCount = Object.keys(statusReasons).filter(id => visibleParticipantIds.has(id) && statusReasons[id]?.some(r => r.severity === "high")).length;
  const attentionCount = Object.keys(statusReasons).filter(id => visibleParticipantIds.has(id) && !statusReasons[id]?.some(r => r.severity === "high") && statusReasons[id]?.length > 0).length;
  const healthyCount = visibleParticipants.length - alertCount - attentionCount;

  return (
    <div className="space-y-4">

      {/* Group health summary */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Resumo da Turma</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-montserrat font-black text-foreground text-2xl">{visibleParticipants.length}</span>
            <span className="font-inter text-xs text-muted-foreground">discípulos</span>
          </div>
        </div>

        {/* Health distribution */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-brand-green/8 border border-brand-green/20 rounded-xl p-2.5 text-center">
            <p className="font-montserrat font-black text-brand-green text-xl leading-none">{healthyCount}</p>
            <p className="text-[10px] font-inter text-muted-foreground mt-0.5">saudáveis</p>
          </div>
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-2.5 text-center">
            <p className="font-montserrat font-black text-amber-600 dark:text-amber-400 text-xl leading-none">{attentionCount}</p>
            <p className="text-[10px] font-inter text-muted-foreground mt-0.5">atenção</p>
          </div>
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-2.5 text-center">
            <p className="font-montserrat font-black text-destructive text-xl leading-none">{alertCount}</p>
            <p className="text-[10px] font-inter text-muted-foreground mt-0.5">alertas</p>
          </div>
        </div>

        {/* Activity totals */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: "📖", label: "Devocionais", value: totalDevotionals },
            { icon: "🎓", label: "Estudos", value: totalLessons },
            { icon: "📅", label: "Presenças", value: totalPresences },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
              <p className="text-sm">{icon}</p>
              <p className="font-montserrat font-black text-foreground text-base leading-none">{value}</p>
              <p className="text-[10px] font-inter text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Course Unlock Management */}
      {courses.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-4 h-4 text-secondary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Liberação de Cursos</p>
          </div>
          <p className="font-inter text-xs text-muted-foreground mb-3">
            Libere os cursos que sua turma poderá acessar.
          </p>
          <div className="space-y-2">
            {courses.map(c => {
              const isUnlocked = unlockedCourseIds.has(c.id);
              const loading = unlockLoading === c.id;
              return (
                <div key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  isUnlocked ? "border-brand-green/30 bg-brand-green/5" : "border-border bg-muted/30"
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isUnlocked ? "bg-brand-green/15" : "bg-muted"
                    }`}>
                      {isUnlocked ? <Unlock className="w-4 h-4 text-brand-green" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-montserrat font-bold text-foreground text-sm">Curso {c.order_num} — {c.title}</p>
                      <p className="font-inter text-[10px] text-muted-foreground">
                        {isUnlocked ? "✅ Liberado para a turma" : "🔒 Bloqueado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCourseUnlock(c.id)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg font-inter text-xs font-semibold transition-colors flex-shrink-0 ${
                      isUnlocked ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                    } disabled:opacity-40`}
                  >
                    {loading ? "..." : isUnlocked ? "Bloquear" : "Liberar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou comunidade..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select value={communityFilter} onChange={(e) => setCommunityFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-secondary transition-all appearance-none">
              <option value="todas">Todas comunidades</option>
              {communities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="relative">
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-secondary transition-all appearance-none">
              <option value="todos">Status</option>
              <option value="iniciando">Iniciando</option>
              <option value="andamento">Em andamento</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
          <div className="relative">
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-secondary transition-all appearance-none">
              <option value="todos">Todos anos</option>
              <option value="1">1º Ano</option>
              <option value="2">2º Ano</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground font-inter text-xs">
            {filtered.length} participante{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </span>
          {(communityFilter !== "todas" || statusFilter !== "todos" || yearFilter !== "todos" || search) && (
            <button onClick={() => { setCommunityFilter("todas"); setStatusFilter("todos"); setYearFilter("todos"); setSearch(""); }}
              className="ml-auto text-secondary font-inter text-xs font-medium">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum participante encontrado</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Tente ajustar os filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const status = getStatusInfo(p.completed_count, activities.length);
            const totalPts = p.faith_points ?? activities.filter(a => p.completed_activity_ids.includes(a.id)).reduce((s, a) => s + a.points, 0);
            const age = calcAge(p.birth_date);
            const reasons = statusReasons[p.user_id] ?? [];
            const hasHighAlert = reasons.some(r => r.severity === "high");
            const hasAlert = reasons.length > 0;
            const borderAccent = hasHighAlert
              ? "border-l-4 border-l-destructive"
              : hasAlert
              ? "border-l-4 border-l-amber-400"
              : "";
            return (
              <div
                key={p.user_id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedParticipant(p)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedParticipant(p);
                  }
                }}
                className={`w-full text-left bg-card rounded-2xl border border-border shadow-sm overflow-hidden hover:border-primary/30 transition-colors ${borderAccent}`}
              >
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.full_name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-border" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="font-montserrat font-black text-primary text-lg">{p.full_name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-montserrat font-bold text-card-foreground text-sm truncate">{p.full_name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-muted-foreground font-inter text-xs">{p.community}</span>
                          {age !== null && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground font-inter text-xs">{age} anos</span></>}
                          {p.confirmation_year ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-inter font-medium bg-primary/10 text-primary">{p.confirmation_year}º ano</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-inter font-medium bg-destructive/10 text-destructive">Ano ?</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-inter font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeletingParticipant(p);
                        }}
                        className="w-8 h-8 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center transition-colors"
                        title={`Deletar ${p.full_name}`}
                        aria-label={`Deletar ${p.full_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Alert reasons */}
                  {reasons.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {reasons.map((reason, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-medium ${
                            reason.severity === "high"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {reason.icon} {reason.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick stats bar */}
                <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex items-center gap-4">
                  <span className="text-[11px] font-inter text-muted-foreground">📖 <strong className="text-foreground">{p.completed_devotional_count ?? 0}</strong></span>
                  <span className="text-[11px] font-inter text-muted-foreground">🎓 <strong className="text-foreground">{p.completed_lesson_count ?? 0}</strong></span>
                  <span className="text-[11px] font-inter text-muted-foreground">📅 <strong className="text-foreground">{p.completed_event_count ?? 0}</strong></span>
                  <span className="ml-auto font-montserrat font-black text-primary text-xs">⭐ {totalPts} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deletingParticipant} onOpenChange={(open) => { if (!open) setDeletingParticipant(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat font-bold">Deletar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="font-inter text-sm">
              Tem certeza que deseja deletar <span className="font-bold text-foreground">{deletingParticipant?.full_name}</span>?
              Esta acao e irreversivel e removera o perfil, permissoes e login deste usuario do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-montserrat font-bold" disabled={isDeletingParticipant}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteParticipant}
              disabled={isDeletingParticipant}
              className="rounded-xl font-montserrat font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingParticipant ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
