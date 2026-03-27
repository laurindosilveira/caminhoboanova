import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CalendarDays, Users, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Star, BookOpen, FileText, Save, Church, Plus, MapPin, X as XIcon,
  Heart, GraduationCap, MessageSquare, ClipboardList, ArrowUpCircle, RefreshCw, Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

type Event = {
  id: string; title: string; event_date: string; type: string;
  location: string | null; community: string | null; area: string | null;
  description: string | null; linked_lesson_id: string | null;
};
type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  confirmation_year?: number | null;
};
type Activity = {
  id: string; title: string; type: string; order_num: number; points: number; subtitle: string | null;
};
type AttendanceStatus = "presente" | "faltou" | "justificou";
type Evaluation = {
  participation_score: number | null;
  understanding_score: number | null;
  engagement_score: number | null;
  notes: string;
};

const STATUS_CFG: Record<AttendanceStatus, { label: string; icon: React.ReactNode; btn: string; active: string }> = {
  presente: {
    label: "Presente",
    icon: <CheckCircle2 className="w-4 h-4" />,
    btn: "border-brand-green text-brand-green hover:bg-brand-green/10",
    active: "bg-brand-green text-white border-brand-green",
  },
  faltou: {
    label: "Faltou",
    icon: <XCircle className="w-4 h-4" />,
    btn: "border-destructive text-destructive hover:bg-destructive/10",
    active: "bg-destructive text-white border-destructive",
  },
  justificou: {
    label: "Justificou",
    icon: <Clock className="w-4 h-4" />,
    btn: "border-accent text-accent-foreground hover:bg-accent/20",
    active: "bg-accent text-accent-foreground border-accent",
  },
};

const TYPE_EMOJI: Record<string, string> = {
  encontro: "📅", culto: "⛪", jemiac: "✝️", retiro: "🏕️", confirmatorio: "📖", evento: "🎉",
};
const AGENDA_EVENT_TYPES = [
  { value: "encontro", label: "Encontro" },
  { value: "culto", label: "Culto" },
  { value: "jemiac", label: "JEMIAC" },
  { value: "retiro", label: "Retiro" },
  { value: "confirmatorio", label: "Ens. Confirmatório" },
  { value: "evento", label: "Evento" },
];
const SCORE_LABELS = ["", "Fraco", "Regular", "Bom", "Muito bom", "Excelente"];

type WorshipRequest = {
  id: string; user_id: string; worship_date: string; worship_time: string;
  preacher_name: string; status: string; event_type: string; created_at: string;
  full_name?: string; community?: string;
};

type AttendanceProps = {
  participants: Participant[];
  activities: Activity[];
  communities?: string[];
  initialParticipant?: Participant | null;
  onClearInitial?: () => void;
  adminArea?: string | null;
};

export default function AttendanceTab({ participants, activities, communities, initialParticipant, onClearInitial, adminArea }: AttendanceProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  const [savingAtt, setSavingAtt] = useState<string | null>(null);

  // Meetings-specific state
  const [evaluations, setEvaluations] = useState<Record<string, Record<string, Evaluation>>>({});
  const [prepReport, setPrepReport] = useState<Record<string, string[]>>({});
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [savingEval, setSavingEval] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);

  // Worship attendance requests
  const [worshipRequests, setWorshipRequests] = useState<WorshipRequest[]>([]);
  const [savingWorship, setSavingWorship] = useState<string | null>(null);

  // Pending event attendance requests
  type PendingAttendance = { id: string; event_id: string; user_id: string; status: string; justification: string | null; created_at: string; full_name?: string; community?: string; event_title?: string; event_date?: string };
  const [pendingAttendance, setPendingAttendance] = useState<PendingAttendance[]>([]);
  const [savingAttendanceApproval, setSavingAttendanceApproval] = useState<string | null>(null);

  // Year promotion state
  const [promotionRequests, setPromotionRequests] = useState<{ id: string; user_id: string; from_year: number; to_year: number; status: string; requested_at: string; full_name?: string; community?: string }[]>([]);
  const [generatingPromotions, setGeneratingPromotions] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingJourney, setResettingJourney] = useState(false);

  // Event creation/editing
  const [showEventForm, setShowEventForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({
    title: "", description: "", event_date: "", location: "", type: "encontro", area: adminArea ?? "", community: "", linked_lesson_id: "",
  });
  const [reportEventId, setReportEventId] = useState<string | null>(null);
  const [showCascadeDialog, setShowCascadeDialog] = useState(false);
  const [cascadePending, setCascadePending] = useState<{ eventId: string; oldLessonId: string | null; newLessonId: string; payload: any } | null>(null);

  // Lesson options for linking to confirmatorio events
  type LessonOption = { id: string; title: string; order_num: number; course_title: string; course_order: number };
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);

  useEffect(() => { fetchEvents(); fetchWorshipRequests(); fetchLessonOptions(); fetchPromotionRequests(); fetchPendingAttendance(); }, []);

  async function fetchLessonOptions() {
    const [{ data: coursesData }, { data: lessonsData }] = await Promise.all([
      supabase.from("courses").select("id, title, order_num").order("order_num"),
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
    ]);
    const courses = coursesData ?? [];
    const lessonsList = lessonsData ?? [];
    const options: LessonOption[] = [];
    courses.forEach(c => {
      lessonsList.filter(l => l.course_id === c.id).forEach(l => {
        options.push({ id: l.id, title: l.title, order_num: l.order_num, course_title: c.title, course_order: c.order_num });
      });
    });
    setLessonOptions(options);
  }

  async function fetchEvents() {
    setLoading(true);
    let query = supabase
      .from("events")
      .select("id, title, event_date, type, location, community, area, description, linked_lesson_id")
      .order("event_date", { ascending: true })
      .limit(50);
    // Filter by admin area (non-super admins only see their area + events without area)
    if (adminArea) {
      query = query.or(`area.is.null,area.eq.${adminArea}`);
    }
    const { data } = await query;
    setEvents(data ?? []);
    setLoading(false);
  }

  async function fetchWorshipRequests() {
    const participantIds = participants.map(p => p.user_id);
    if (participantIds.length === 0) return;
    const { data } = await supabase
      .from("worship_attendance")
      .select("*")
      .in("user_id", participantIds)
      .order("created_at", { ascending: false })
      .limit(50);
    const enriched = (data ?? []).map(w => {
      const p = participants.find(p => p.user_id === w.user_id);
      return { ...w, full_name: p?.full_name ?? "Desconhecido", community: p?.community ?? "" };
    });
    setWorshipRequests(enriched);
  }

  async function handleWorshipAction(id: string, action: "aprovado" | "rejeitado") {
    setSavingWorship(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("worship_attendance").update({
      status: action,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: action === "aprovado" ? "Presença aprovada ✅" : "Presença rejeitada" });
      setWorshipRequests(prev => prev.map(w => w.id === id ? { ...w, status: action } : w));
    }
    setSavingWorship(null);
  }

  async function fetchPendingAttendance() {
    const participantIds = participants.map(p => p.user_id);
    if (participantIds.length === 0) return;
    const { data } = await supabase
      .from("attendance")
      .select("id, event_id, user_id, status, justification, created_at")
      .in("user_id", participantIds)
      .in("status", ["pendente_presente", "pendente_falta"])
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setPendingAttendance([]); return; }
    const eventIds = [...new Set(data.map(a => a.event_id))];
    const { data: eventsData } = await supabase.from("events").select("id, title, event_date").in("id", eventIds);
    const eventsMap = new Map((eventsData ?? []).map(e => [e.id, e]));
    const enriched = data.map(a => {
      const p = participants.find(p => p.user_id === a.user_id);
      const ev = eventsMap.get(a.event_id);
      return { ...a, full_name: p?.full_name ?? "Desconhecido", community: p?.community ?? "", event_title: ev?.title ?? "Evento", event_date: ev?.event_date ?? a.created_at };
    });
    setPendingAttendance(enriched);
  }

  async function handleAttendanceApproval(id: string, action: "presente" | "justificou" | "rejeitado") {
    setSavingAttendanceApproval(id);
    if (action === "rejeitado") {
      await supabase.from("attendance").delete().eq("id", id);
      setPendingAttendance(prev => prev.filter(a => a.id !== id));
    } else {
      await supabase.from("attendance").update({ status: action }).eq("id", id);
      setPendingAttendance(prev => prev.filter(a => a.id !== id));
    }
    toast({ title: action === "presente" ? "Presença aprovada ✅" : action === "justificou" ? "Falta justificada ✓" : "Solicitação rejeitada" });
    setSavingAttendanceApproval(null);
  }

  async function loadEventData(eventId: string, eventDate: string, isEncontro: boolean) {
    const eventParticipants = getParticipantsForEvent(events.find(e => e.id === eventId)!);
    const userIds = eventParticipants.map(p => p.user_id);

    // Always load attendance
    const { data: attData } = await supabase.from("attendance").select("user_id, status").eq("event_id", eventId);

    const attMap: Record<string, AttendanceStatus> = {};
    (attData ?? []).forEach((r: any) => { attMap[r.user_id] = r.status as AttendanceStatus; });
    setAttendance(prev => ({ ...prev, [eventId]: attMap }));

    // For encontros, also load evaluations + progress
    if (isEncontro && userIds.length > 0) {
      const [{ data: evalData }, { data: progressData }] = await Promise.all([
        supabase.from("meeting_evaluations").select("*").eq("event_id", eventId),
        supabase.from("user_progress").select("user_id, activity_id, completed_at").in("user_id", userIds),
      ]);

      const evalMap: Record<string, Evaluation> = {};
      (evalData ?? []).forEach((e: any) => {
        evalMap[e.user_id] = {
          participation_score: e.participation_score,
          understanding_score: e.understanding_score,
          engagement_score: e.engagement_score,
          notes: e.notes ?? "",
        };
      });
      setEvaluations(prev => ({ ...prev, [eventId]: evalMap }));

      const eventDateObj = new Date(eventDate);
      const prepMap: Record<string, string[]> = {};
      (progressData ?? []).forEach((pr: any) => {
        if (new Date(pr.completed_at) <= eventDateObj) {
          if (!prepMap[pr.user_id]) prepMap[pr.user_id] = [];
          prepMap[pr.user_id].push(pr.activity_id);
        }
      });
      setPrepReport(prepMap);
    }
  }
  async function handleSaveEvent() {
    if (!eventForm.title || !eventForm.event_date) return;
    setSavingEvent(true);
    const payload = {
      title: eventForm.title,
      description: eventForm.description || null,
      event_date: eventForm.event_date,
      location: eventForm.location || null,
      type: eventForm.type,
      area: adminArea || eventForm.area || null,
      community: eventForm.community || null,
      linked_lesson_id: eventForm.linked_lesson_id || null,
    };

    if (editingEventId) {
      const oldEvent = events.find(e => e.id === editingEventId);
      const oldLessonId = oldEvent?.linked_lesson_id ?? null;
      const newLessonId = payload.linked_lesson_id;

      console.log("[CASCADE CHECK]", { editingEventId, oldLessonId, newLessonId, changed: oldLessonId !== newLessonId });

      // Check if lesson changed and cascade is needed
      if (oldLessonId !== newLessonId && newLessonId && oldEvent) {
        // Fetch fresh events from DB to ensure accurate cascade check
        const { data: freshEvents } = await supabase
          .from("events")
          .select("id, title, event_date, type, location, community, area, description, linked_lesson_id")
          .order("event_date", { ascending: true });

        const allEvents = freshEvents ?? events;
        const subsequentWithLessons = allEvents.filter(
          e => e.id !== editingEventId && e.event_date > oldEvent.event_date && e.linked_lesson_id
        );
        console.log("[CASCADE CHECK] subsequent events with lessons:", subsequentWithLessons.length);

        if (subsequentWithLessons.length > 0) {
          // Update local events state with fresh data for cascade execution
          setEvents(allEvents);
          setCascadePending({ eventId: editingEventId, oldLessonId, newLessonId, payload });
          setShowCascadeDialog(true);
          setShowEventForm(false);
          setSavingEvent(false);
          return;
        }
      }

      await supabase.from("events").update(payload).eq("id", editingEventId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("events").insert({ ...payload, created_by: user?.id });
    }
    setEventForm({ title: "", description: "", event_date: "", location: "", type: "encontro", area: adminArea ?? "", community: "", linked_lesson_id: "" });
    setShowEventForm(false);
    setEditingEventId(null);
    setSavingEvent(false);
    fetchEvents();
  }

  async function executeCascade(doCascade: boolean) {
    if (!cascadePending) return;
    const { eventId, newLessonId, payload } = cascadePending;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    // Update the edited event with all fields
    await supabase.from("events").update(payload).eq("id", eventId);

    if (doCascade) {
      const subsequent = events
        .filter(e => e.id !== eventId && e.event_date > event.event_date && e.linked_lesson_id)
        .sort((a, b) => a.event_date.localeCompare(b.event_date));

      if (subsequent.length > 0) {
        const allLessonsOrdered = [...lessonOptions].sort((a, b) => {
          if (a.course_order !== b.course_order) return a.course_order - b.course_order;
          return a.order_num - b.order_num;
        });

        const newIdx = allLessonsOrdered.findIndex(l => l.id === newLessonId);
        if (newIdx >= 0) {
          for (let i = 0; i < subsequent.length; i++) {
            const nextLessonIdx = newIdx + 1 + i;
            if (nextLessonIdx < allLessonsOrdered.length) {
              await supabase.from("events")
                .update({ linked_lesson_id: allLessonsOrdered[nextLessonIdx].id })
                .eq("id", subsequent[i].id);
            }
          }
          toast({ title: `Lições atualizadas em ${subsequent.length + 1} eventos!` });
        }
      }
    } else {
      toast({ title: "Evento atualizado (sem cascata)!" });
    }

    setShowCascadeDialog(false);
    setCascadePending(null);
    setEditingEventId(null);
    fetchEvents();
  }

  function openEditEvent(event: Event) {
    const dateForInput = event.event_date ? format(new Date(event.event_date), "yyyy-MM-dd'T'HH:mm") : "";
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      description: event.description ?? "",
      event_date: dateForInput,
      location: event.location ?? "",
      type: event.type,
      area: event.area ?? adminArea ?? "",
      community: event.community ?? "",
      linked_lesson_id: event.linked_lesson_id ?? "",
    });
    setShowEventForm(true);
  }

  async function handleDeleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    fetchEvents();
  }

  async function toggleEvent(eventId: string) {
    if (expandedEvent === eventId) {
      setExpandedEvent(null);
      setSelectedParticipant(null);
      return;
    }
    setExpandedEvent(eventId);
    setSelectedParticipant(null);
    const event = events.find(e => e.id === eventId);
    if (event) await loadEventData(eventId, event.event_date, event.type === "encontro");
  }

  async function markAttendance(eventId: string, userId: string, status: AttendanceStatus) {
    setSavingAtt(`${eventId}-${userId}`);
    const current = attendance[eventId]?.[userId];
    if (current === status) {
      await supabase.from("attendance").delete().eq("event_id", eventId).eq("user_id", userId);
      setAttendance(prev => {
        const updated = { ...prev[eventId] };
        delete updated[userId];
        return { ...prev, [eventId]: updated };
      });
    } else {
      await supabase.from("attendance").upsert({
        event_id: eventId, user_id: userId, status,
      }, { onConflict: "event_id,user_id" });
      setAttendance(prev => ({
        ...prev,
        [eventId]: { ...(prev[eventId] ?? {}), [userId]: status },
      }));
    }
    setSavingAtt(null);
  }

  function updateLocalEval(eventId: string, userId: string, field: keyof Evaluation, value: any) {
    setEvaluations(prev => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] ?? {}),
        [userId]: {
          ...(prev[eventId]?.[userId] ?? { participation_score: null, understanding_score: null, engagement_score: null, notes: "" }),
          [field]: value,
        },
      },
    }));
  }

  async function saveEvaluation(eventId: string, userId: string) {
    setSavingEval(true);
    const ev = evaluations[eventId]?.[userId];
    if (!ev) { setSavingEval(false); return; }
    const { error } = await supabase.from("meeting_evaluations").upsert({
      event_id: eventId, user_id: userId, admin_id: profile?.user_id ?? "",
      participation_score: ev.participation_score,
      understanding_score: ev.understanding_score,
      engagement_score: ev.engagement_score,
      notes: ev.notes,
    }, { onConflict: "event_id,user_id" });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Avaliação salva ✅" });
    }
    setSavingEval(false);
  }

  function getParticipantsForEvent(event: Event) {
    return participants.filter(p => {
      if (event.community && p.community !== event.community) return false;
      if (filterYear && p.confirmation_year !== filterYear) return false;
      return true;
    });
  }

  function getAttendanceSummary(eventId: string, eventParticipants: Participant[]) {
    const map = attendance[eventId] ?? {};
    const total = eventParticipants.length;
    const present = Object.values(map).filter(s => s === "presente").length;
    const absent = Object.values(map).filter(s => s === "faltou").length;
    const justified = Object.values(map).filter(s => s === "justificou").length;
    const unmarked = total - present - absent - justified;
    return { total, present, absent, justified, unmarked };
  }

  function ScoreSelector({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-inter font-medium text-muted-foreground">{label}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onChange(n)}
              title={SCORE_LABELS[n]}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                value === n
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-primary/20"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {value && <p className="text-[10px] text-primary font-inter">{SCORE_LABELS[value]}</p>}
      </div>
    );
  }

  function renderCascadeDialog() {
    if (!showCascadeDialog || !cascadePending) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => { setShowCascadeDialog(false); setCascadePending(null); }}>
        <div className="w-full max-w-sm bg-card rounded-2xl p-5 mx-4 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="text-center">
            <span className="text-3xl">📅</span>
            <h3 className="font-montserrat font-bold text-foreground text-base mt-2">Prorrogar estudos?</h3>
            <p className="text-muted-foreground font-inter text-xs mt-2 leading-relaxed">
              Você mudou a lição deste encontro. Deseja que as próximas datas sejam atualizadas automaticamente com as lições seguintes?
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => executeCascade(false)}
              className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm font-medium"
            >
              Só este evento
            </button>
            <button
              onClick={() => executeCascade(true)}
              className="flex-1 py-2.5 rounded-xl text-primary-foreground font-inter text-sm font-medium"
              style={{ background: "var(--gradient-hero)" }}
            >
              Prorrogar todos
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderEventForm() {
    const formContent = (
      <div className="space-y-3">
        <p className="font-montserrat font-bold text-foreground text-sm">{editingEventId ? "✏️ Editar evento" : "Novo evento"}</p>
        <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Título do evento *"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <input value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Descrição (opcional)"
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <div className="grid grid-cols-2 gap-2">
          <input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))}
            placeholder="Local (opcional)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={eventForm.type} onChange={e => setEventForm(f => ({ ...f, type: e.target.value, linked_lesson_id: "" }))}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
          {AGENDA_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {eventForm.type === "confirmatorio" && (
          <div className="space-y-1">
            <label className="font-inter text-xs font-medium text-muted-foreground">📖 Vincular a um estudo (opcional)</label>
            <select
              value={eventForm.linked_lesson_id}
              onChange={e => setEventForm(f => ({ ...f, linked_lesson_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">Sem vínculo</option>
              {lessonOptions.map(l => (
                <option key={l.id} value={l.id}>
                  Curso {l.course_order} — Lição {l.order_num}: {l.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleSaveEvent} disabled={savingEvent || !eventForm.title || !eventForm.event_date}
            className="flex-1 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
            style={{ background: "var(--gradient-hero)" }}>
            {savingEvent ? "Salvando..." : editingEventId ? "Salvar alterações" : "Salvar evento"}
          </button>
          <button onClick={() => { setShowEventForm(false); setEditingEventId(null); }} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
            Cancelar
          </button>
        </div>
      </div>
    );

    // If editing, render as floating modal
    if (editingEventId) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => { setShowEventForm(false); setEditingEventId(null); }}>
          <div className="w-full max-w-md bg-card rounded-2xl border border-border p-5 mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {formContent}
          </div>
        </div>
      );
    }

    // New event: inline form
    return (
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        {formContent}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {renderCascadeDialog()}
        {[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-20 animate-pulse" />)}
      </div>
    );
  }

  if (events.length === 0 && worshipRequests.length === 0) {
    return (
      <div className="space-y-4">
        {renderCascadeDialog()}
        <div className="flex items-center justify-between">
          <p className="font-montserrat font-bold text-foreground text-base">Encontros & Presença</p>
          <button onClick={() => { setEditingEventId(null); setEventForm({ title: "", description: "", event_date: "", location: "", type: "encontro", area: adminArea ?? "", community: "", linked_lesson_id: "" }); setShowEventForm(!showEventForm); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}>
            <Plus className="w-3.5 h-3.5" /> Novo evento
          </button>
        </div>
        {showEventForm && renderEventForm()}
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum evento encontrado</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Clique em "Novo evento" para adicionar.</p>
        </div>
      </div>
    );
  }

  const EVENT_TYPES_FILTER = [
    { value: null, label: "Todos" },
    { value: "encontro", label: "📅 Encontros" },
    { value: "culto", label: "⛪ Cultos" },
    { value: "jemiac", label: "✝️ JEMIAC" },
    { value: "retiro", label: "🏕️ Retiros" },
    { value: "confirmatorio", label: "📖 Ens. Confirmatório" },
    { value: "evento", label: "🎉 Eventos" },
  ];

  // Filter events by admin area and selected type
  const areaFilteredEvents = adminArea && adminArea !== "todas"
    ? events.filter(e => !e.area || e.area === adminArea)
    : events;
  const filteredEvents = filterType ? areaFilteredEvents.filter(e => e.type === filterType) : areaFilteredEvents;

  return (
    <div className="space-y-4">
      {renderCascadeDialog()}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-montserrat font-black text-foreground text-lg">Encontros</h2>
            <p className="text-muted-foreground text-xs font-inter">Eventos, presença e avaliação</p>
          </div>
        </div>
        <button onClick={() => { setEditingEventId(null); setEventForm({ title: "", description: "", event_date: "", location: "", type: "encontro", area: adminArea ?? "", community: "", linked_lesson_id: "" }); setShowEventForm(!showEventForm); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground"
          style={{ background: "var(--gradient-hero)" }}>
          <Plus className="w-3.5 h-3.5" /> Novo evento
        </button>
      </div>

      {showEventForm && renderEventForm()}

      {/* Type filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {EVENT_TYPES_FILTER.map(t => (
          <button
            key={t.label}
            onClick={() => setFilterType(t.value)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-all ${
              filterType === t.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-primary/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Year filter */}
      <div className="flex gap-1.5">
        {[
          { value: null, label: "Todas as turmas" },
          { value: 1, label: "1º Ano" },
          { value: 2, label: "2º Ano" },
        ].map(y => (
          <button
            key={y.label}
            onClick={() => setFilterYear(y.value)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-all ${
              filterYear === y.value
                ? "bg-accent text-accent-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-accent/10"
            }`}
          >
            🎓 {y.label}
          </button>
        ))}
      </div>

      {/* Pending event attendance requests */}
      {pendingAttendance.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">
              Solicitações de Presença em Eventos
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-inter font-bold bg-primary/10 text-primary">
                {pendingAttendance.length} pendente{pendingAttendance.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
          {pendingAttendance.map(a => {
            const isSaving = savingAttendanceApproval === a.id;
            const isPresence = a.status === "pendente_presente";
            return (
              <div key={a.id} className="bg-card rounded-2xl border border-primary/20 p-4 shadow-sm space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPresence ? "bg-brand-green/10" : "bg-accent/20"}`}>
                    <span className="text-lg">{isPresence ? "✅" : "📝"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-sm">{a.full_name}</p>
                    <p className="text-muted-foreground font-inter text-xs">{a.community}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-inter font-medium ${isPresence ? "bg-brand-green/10 text-brand-green" : "bg-accent/20 text-accent-foreground"}`}>
                    {isPresence ? "Confirma presença" : "Justifica falta"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-inter text-muted-foreground">
                  <span>📅 {a.event_title}</span>
                  <span>🕐 {new Date(a.event_date!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </div>
                {a.justification && (
                  <p className="text-muted-foreground font-inter text-xs italic bg-muted/50 rounded-lg px-3 py-2">
                    💬 {a.justification}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAttendanceApproval(a.id, isPresence ? "presente" : "justificou")}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-green/10 text-brand-green font-inter text-xs font-medium border border-brand-green/30 hover:bg-brand-green/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => handleAttendanceApproval(a.id, "rejeitado")}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive font-inter text-xs font-medium border border-destructive/30 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event attendance requests - filtered by event type */}
      {(() => {
        const TYPE_EMOJI_LOCAL: Record<string, string> = {
          encontro: "📅", culto: "⛪", jemiac: "✝️", retiro: "🏕️", confirmatorio: "📖", evento: "🎉",
        };
        const TYPE_LABEL: Record<string, string> = {
          encontro: "Encontros", culto: "Cultos", jemiac: "JEMIAC", retiro: "Retiros", confirmatorio: "Ens. Confirmatório", evento: "Eventos",
        };
        const filtered = filterType
          ? worshipRequests.filter(w => w.event_type === filterType)
          : worshipRequests;
        if (filtered.length === 0) return null;

        const pendingItems = filtered.filter(w => w.status === "pendente");
        const archivedItems = filtered.filter(w => w.status !== "pendente");

        const renderWorshipCard = (w: WorshipRequest, isPending: boolean) => {
          const isSaving = savingWorship === w.id;
          const emoji = TYPE_EMOJI_LOCAL[w.event_type] ?? "📅";
          const typeLabel = TYPE_LABEL[w.event_type] ?? w.event_type;
          return (
            <div key={w.id} className={`bg-card rounded-2xl border ${isPending ? "border-accent/50" : "border-border"} p-4 shadow-sm space-y-2`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-foreground text-sm">{w.full_name}</p>
                  <p className="text-muted-foreground font-inter text-xs">{w.community}</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-inter font-medium bg-muted text-muted-foreground">
                  {typeLabel}
                </span>
                {!isPending && (
                  <span className={`text-xs font-inter font-medium px-2 py-0.5 rounded-full ${
                    w.status === "aprovado" ? "bg-brand-green/10 text-brand-green" : "bg-destructive/10 text-destructive"
                  }`}>
                    {w.status === "aprovado" ? "✅ Aprovado" : "❌ Rejeitado"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs font-inter text-muted-foreground">
                <span>📅 {new Date(w.worship_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span>🕐 {w.worship_time}</span>
                <span>🎤 {w.preacher_name}</span>
              </div>
              {isPending && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleWorshipAction(w.id, "aprovado")}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-green/10 text-brand-green font-inter text-xs font-medium border border-brand-green/30 hover:bg-brand-green/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => handleWorshipAction(w.id, "rejeitado")}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive font-inter text-xs font-medium border border-destructive/30 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {/* Pending requests */}
            {pendingItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Church className="w-4 h-4 text-primary" />
                  <p className="font-montserrat font-bold text-foreground text-sm">
                    Confirmações de Presença
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-inter font-bold bg-accent/20 text-accent-foreground">
                      {pendingItems.length} pendente{pendingItems.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
                {pendingItems.map(w => renderWorshipCard(w, true))}
              </div>
            )}

            {/* Archived (approved/rejected) - only in "Todos" filter */}
            {!filterType && archivedItems.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer list-none py-2">
                  <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="font-montserrat font-bold text-muted-foreground text-sm flex-1">
                    Arquivo de Confirmações
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-inter font-medium bg-muted text-muted-foreground">
                      {archivedItems.length}
                    </span>
                  </p>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <div className="space-y-2 mt-2">
                  {archivedItems.map(w => renderWorshipCard(w, false))}
                </div>
              </details>
            )}
          </>
        );
      })()}

      <div className="space-y-3">
        {filteredEvents.map(event => {
          const isExpanded = expandedEvent === event.id;
          const isEncontro = event.type === "encontro";
          const eventParticipants = getParticipantsForEvent(event);
          const summary = isExpanded ? getAttendanceSummary(event.id, eventParticipants) : null;
          const dateObj = new Date(event.event_date);
          const evalMap = evaluations[event.id] ?? {};
          const evaluatedCount = isEncontro ? Object.keys(evalMap).filter(uid => evalMap[uid]?.participation_score).length : 0;

          return (
            <div key={event.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {/* Event header */}
              <button
                onClick={() => toggleEvent(event.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-lg leading-none">{TYPE_EMOJI[event.type] ?? "📅"}</span>
                  <span className="font-montserrat font-black text-primary text-xs">
                    {format(dateObj, "d", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-montserrat font-bold text-foreground text-sm">{event.title}</p>
                    {isEncontro && (
                      <span className="text-[10px] font-inter font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">Encontro</span>
                    )}
                  </div>
                  <p className="text-muted-foreground font-inter text-xs">
                    {format(dateObj, "d 'de' MMMM yyyy", { locale: ptBR })}
                    {event.community && ` · ${event.community}`}
                  </p>
                  {isExpanded && summary && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs font-inter text-brand-green font-medium">
                        <CheckCircle2 className="w-3 h-3" />{summary.present}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-inter text-destructive font-medium">
                        <XCircle className="w-3 h-3" />{summary.absent}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-inter text-accent-foreground font-medium">
                        <Clock className="w-3 h-3" />{summary.justified}
                      </span>
                      {summary.unmarked > 0 && (
                        <span className="text-xs font-inter text-muted-foreground">{summary.unmarked} sem registro</span>
                      )}
                      {isEncontro && evaluatedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-inter text-primary font-medium ml-1">
                          <Star className="w-3 h-3" />{evaluatedCount} avaliados
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isExpanded && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReportEventId(event.id); }}
                      className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      title="Relatório do Encontro"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-primary" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditEvent(event); }}
                    className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    title="Editar evento"
                  >
                    <Pencil className="w-3.5 h-3.5 text-primary" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                    className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                    title="Excluir evento"
                  >
                    <XIcon className="w-3.5 h-3.5 text-destructive" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Participants list */}
              {isExpanded && (
                <div className="border-t border-border">
                  {eventParticipants.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm font-inter py-6">
                      Nenhum participante nesta comunidade.
                    </p>
                  ) : (
                    <div>
                      {eventParticipants.map((p, i) => {
                        const current = attendance[event.id]?.[p.user_id];
                        const isLast = i === eventParticipants.length - 1;
                        const isSavingThis = savingAtt === `${event.id}-${p.user_id}`;
                        const initials = p.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
                        const isSelected = isEncontro && selectedParticipant === p.user_id;
                        const ev = isEncontro ? (evalMap[p.user_id] ?? { participation_score: null, understanding_score: null, engagement_score: null, notes: "" }) : null;
                        const hasEval = isEncontro && !!ev?.participation_score;
                        const userPrep = isEncontro ? (prepReport[p.user_id] ?? []) : [];

                        return (
                          <div key={p.user_id} className={`${!isLast ? "border-b border-border" : ""}`}>
                            <div className={`flex items-center gap-3 px-4 py-3 ${isSavingThis ? "opacity-60" : ""}`}>
                              {/* Avatar */}
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  hasEval ? "bg-primary" : "bg-muted"
                                } ${isEncontro ? "cursor-pointer" : ""}`}
                                onClick={() => isEncontro && setSelectedParticipant(isSelected ? null : p.user_id)}
                              >
                                <span className={`text-xs font-montserrat font-black ${hasEval ? "text-primary-foreground" : "text-muted-foreground"}`}>
                                  {initials}
                                </span>
                              </div>

                              {/* Name + info */}
                              <div
                                className={`flex-1 min-w-0 ${isEncontro ? "cursor-pointer" : ""}`}
                                onClick={() => isEncontro && setSelectedParticipant(isSelected ? null : p.user_id)}
                              >
                                <p className="font-montserrat font-bold text-foreground text-sm truncate">{p.full_name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs font-inter">{p.community}</span>
                                  {isEncontro && hasEval && (
                                    <Star className="w-3 h-3 text-primary fill-primary" />
                                  )}
                                  {isEncontro && (
                                    <span className="text-xs font-inter text-muted-foreground">
                                      {userPrep.length}/{activities.length}
                                      <BookOpen className="w-3 h-3 inline ml-0.5 -mt-0.5" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Attendance buttons */}
                              <div className="flex gap-1.5 flex-shrink-0">
                                {(["presente", "faltou", "justificou"] as AttendanceStatus[]).map(status => {
                                  const cfg = STATUS_CFG[status];
                                  const isActive = current === status;
                                  return (
                                    <button
                                      key={status}
                                      onClick={() => markAttendance(event.id, p.user_id, status)}
                                      disabled={isSavingThis}
                                      title={cfg.label}
                                      className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                                        isActive ? cfg.active : `border-border bg-card ${cfg.btn}`
                                      }`}
                                    >
                                      {cfg.icon}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Encontro: expanded evaluation + prep report */}
                            {isEncontro && isSelected && ev && (
                              <div className="px-4 pb-4 space-y-4 bg-muted/10">
                                {/* Preparation Report */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <p className="font-montserrat font-bold text-foreground text-sm">Relatório de Preparação</p>
                                  </div>
                                  <div className="bg-card rounded-xl border border-border p-3 space-y-1.5">
                                    <p className="text-xs font-inter text-muted-foreground mb-2">
                                      Atividades concluídas antes do encontro ({userPrep.length}/{activities.length}):
                                    </p>
                                    {activities.map(act => {
                                      const done = userPrep.includes(act.id);
                                      return (
                                        <div key={act.id} className="flex items-center gap-2">
                                          {done ? (
                                            <CheckCircle2 className="w-4 h-4 text-brand-green flex-shrink-0" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-destructive/50 flex-shrink-0" />
                                          )}
                                          <span className={`text-xs font-inter ${done ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                            {act.title}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Evaluation form */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-primary" />
                                    <p className="font-montserrat font-bold text-foreground text-sm">Avaliação do Encontro</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3">
                                    <ScoreSelector
                                      label="Participação"
                                      value={ev.participation_score}
                                      onChange={v => updateLocalEval(event.id, p.user_id, "participation_score", v)}
                                    />
                                    <ScoreSelector
                                      label="Compreensão"
                                      value={ev.understanding_score}
                                      onChange={v => updateLocalEval(event.id, p.user_id, "understanding_score", v)}
                                    />
                                    <ScoreSelector
                                      label="Engajamento"
                                      value={ev.engagement_score}
                                      onChange={v => updateLocalEval(event.id, p.user_id, "engagement_score", v)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs font-inter font-medium text-muted-foreground">Observações</p>
                                    <Textarea
                                      value={ev.notes}
                                      onChange={e => updateLocalEval(event.id, p.user_id, "notes", e.target.value)}
                                      placeholder="Anotações sobre o participante neste encontro..."
                                      className="text-sm min-h-[60px]"
                                    />
                                  </div>
                                  <button
                                    onClick={() => saveEvaluation(event.id, p.user_id)}
                                    disabled={savingEval}
                                    className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-montserrat font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 w-full justify-center"
                                  >
                                    <Save className="w-4 h-4" />
                                    {savingEval ? "Salvando..." : "Salvar Avaliação"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Meeting Report Modal */}
      {reportEventId && (() => {
        const event = events.find(e => e.id === reportEventId);
        if (!event) return null;
        const eventParticipants = getParticipantsForEvent(event);
        const attMap = attendance[reportEventId] ?? {};
        const evalMap = evaluations[reportEventId] ?? {};
        const dateObj = new Date(event.event_date);

        const presentes = eventParticipants.filter(p => attMap[p.user_id] === "presente");
        const faltaram = eventParticipants.filter(p => attMap[p.user_id] === "faltou");
        const justificaram = eventParticipants.filter(p => attMap[p.user_id] === "justificou");
        const semRegistro = eventParticipants.filter(p => !attMap[p.user_id]);

        const sections = [
          { title: "✅ Presentes", list: presentes, color: "text-brand-green", bg: "bg-brand-green/10" },
          { title: "❌ Faltaram", list: faltaram, color: "text-destructive", bg: "bg-destructive/10" },
          { title: "⏰ Justificaram", list: justificaram, color: "text-accent-foreground", bg: "bg-accent/10" },
          { title: "❓ Sem registro", list: semRegistro, color: "text-muted-foreground", bg: "bg-muted" },
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setReportEventId(null)}>
            <div
              className="bg-background w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-montserrat font-black text-foreground text-sm">Relatório do Encontro</p>
                    <p className="text-muted-foreground font-inter text-xs">
                      {event.title} · {format(dateObj, "d 'de' MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setReportEventId(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <XIcon className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Summary cards */}
              <div className="px-5 py-4 grid grid-cols-4 gap-2">
                <div className="bg-brand-green/10 rounded-xl p-3 text-center">
                  <p className="font-montserrat font-black text-brand-green text-lg">{presentes.length}</p>
                  <p className="text-[10px] font-inter text-brand-green">Presentes</p>
                </div>
                <div className="bg-destructive/10 rounded-xl p-3 text-center">
                  <p className="font-montserrat font-black text-destructive text-lg">{faltaram.length}</p>
                  <p className="text-[10px] font-inter text-destructive">Faltaram</p>
                </div>
                <div className="bg-accent/10 rounded-xl p-3 text-center">
                  <p className="font-montserrat font-black text-accent-foreground text-lg">{justificaram.length}</p>
                  <p className="text-[10px] font-inter text-accent-foreground">Justificaram</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-center">
                  <p className="font-montserrat font-black text-muted-foreground text-lg">{semRegistro.length}</p>
                  <p className="text-[10px] font-inter text-muted-foreground">Sem registro</p>
                </div>
              </div>

              {/* Sections */}
              <div className="px-5 pb-6 space-y-4">
                {sections.map(sec => {
                  if (sec.list.length === 0) return null;
                  return (
                    <div key={sec.title}>
                      <p className={`font-montserrat font-bold text-sm mb-2 ${sec.color}`}>{sec.title} ({sec.list.length})</p>
                      <div className="space-y-1.5">
                        {sec.list.map(p => {
                          const ev = evalMap[p.user_id];
                          const hasNotes = ev?.notes && ev.notes.trim().length > 0;
                          return (
                            <div key={p.user_id} className={`${sec.bg} rounded-xl px-3 py-2.5`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-inter font-medium text-foreground text-sm">{p.full_name}</p>
                                  <p className="text-muted-foreground font-inter text-xs">{p.community}</p>
                                </div>
                                {ev?.participation_score && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-primary fill-primary" />
                                    <span className="text-xs font-montserrat font-bold text-primary">
                                      {Math.round(((ev.participation_score ?? 0) + (ev.understanding_score ?? 0) + (ev.engagement_score ?? 0)) / 3 * 10) / 10}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {hasNotes && (
                                <p className="text-xs font-inter text-muted-foreground mt-1 italic">📝 {ev!.notes}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── PROMOÇÃO DE ANO ─── */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-foreground text-sm">Promoção de Ano</h3>
              <p className="text-muted-foreground text-[10px] font-inter">Promover alunos do 1º para o 2º ano</p>
            </div>
          </div>
          <button
            onClick={handleGeneratePromotions}
            disabled={generatingPromotions}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-hero)" }}
          >
            {generatingPromotions ? "Gerando..." : "Gerar promoções"}
          </button>
        </div>

        {promotionRequests.length === 0 ? (
          <div className="text-center py-6 bg-muted/30 rounded-2xl">
            <p className="text-muted-foreground font-inter text-xs">Nenhuma promoção pendente.</p>
            <p className="text-muted-foreground font-inter text-[10px] mt-1">Clique em "Gerar promoções" para verificar alunos do 1º ano elegíveis.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {promotionRequests.map(req => (
              <div key={req.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold">{req.from_year}→{req.to_year}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-foreground text-xs truncate">{req.full_name ?? "—"}</p>
                  <p className="text-muted-foreground text-[10px] font-inter">{req.community ?? ""} · {new Date(req.requested_at).toLocaleDateString("pt-BR")}</p>
                </div>
                {req.status === "pendente" ? (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handlePromotionAction(req.id, req.user_id, "aprovado")}
                      className="px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold bg-brand-green/10 text-brand-green border border-brand-green/30 hover:bg-brand-green/20"
                    >
                      ✅ Aprovar
                    </button>
                    <button
                      onClick={() => handlePromotionAction(req.id, req.user_id, "rejeitado")}
                      className="px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                    >
                      ❌ Rejeitar
                    </button>
                  </div>
                ) : (
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-inter font-semibold ${
                    req.status === "aprovado" ? "bg-brand-green/10 text-brand-green" : "bg-destructive/10 text-destructive"
                  }`}>
                    {req.status === "aprovado" ? "✅ Aprovado" : "❌ Rejeitado"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── REINICIAR JORNADA ─── */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-foreground text-sm">Reiniciar Jornada</h3>
              <p className="text-muted-foreground text-[10px] font-inter">Zerar progresso de toda a turma</p>
            </div>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-inter font-medium border-2 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reiniciar
          </button>
        </div>
        {showResetConfirm && (
          <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl p-4 space-y-3">
            <p className="text-destructive font-inter text-xs font-medium">
              ⚠️ Ação irreversível! Todo o progresso de {participants.length} aluno(s) será apagado:
            </p>
            <ul className="text-muted-foreground font-inter text-xs space-y-1 pl-2">
              <li>• Atividades, lições e devocionais</li>
              <li>• Conquistas e pontos da fé</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl text-xs font-montserrat font-bold bg-muted text-muted-foreground border border-border">
                Cancelar
              </button>
              <button
                onClick={handleResetJourney}
                disabled={resettingJourney}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {resettingJourney ? "Reiniciando..." : "Confirmar reinício"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  async function fetchPromotionRequests() {
    const { data } = await supabase
      .from("year_promotion_requests")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(50);
    const enriched = (data ?? []).map((r: any) => {
      const p = participants.find(p => p.user_id === r.user_id);
      return { ...r, full_name: p?.full_name, community: p?.community };
    });
    setPromotionRequests(enriched);
  }

  async function handleGeneratePromotions() {
    setGeneratingPromotions(true);
    const currentYear = new Date().getFullYear();
    const isEndOfYear = new Date().getMonth() >= 10; // November or December
    
    // Find all 1st year participants in this turma
    const firstYearParticipants = participants.filter(p => (p as any).confirmation_year === 1);
    
    if (firstYearParticipants.length === 0) {
      toast({ title: "Nenhum aluno elegível", description: "Não há alunos do 1º ano nesta turma." });
      setGeneratingPromotions(false);
      return;
    }

    if (!isEndOfYear) {
      toast({ title: "Fora do período", description: "As promoções são geradas no final do ano (novembro/dezembro). Deseja continuar mesmo assim?" });
    }

    // Check for existing pending requests
    const existingUserIds = promotionRequests.filter(r => r.status === "pendente").map(r => r.user_id);
    const newParticipants = firstYearParticipants.filter(p => !existingUserIds.includes(p.user_id));

    if (newParticipants.length === 0) {
      toast({ title: "Já existem promoções pendentes", description: "Todos os alunos do 1º ano já têm solicitações pendentes." });
      setGeneratingPromotions(false);
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    const inserts = newParticipants.map(p => ({
      user_id: p.user_id,
      from_year: 1,
      to_year: 2,
      turma_id: (p as any).turma_id ?? null,
      status: "pendente",
    }));

    const { error } = await supabase.from("year_promotion_requests").insert(inserts as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `📋 ${newParticipants.length} promoção(ões) gerada(s)`, description: "Revise e aprove cada uma." });
      await fetchPromotionRequests();
    }
    setGeneratingPromotions(false);
  }

  async function handlePromotionAction(requestId: string, userId: string, action: "aprovado" | "rejeitado") {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("year_promotion_requests").update({
      status: action,
      reviewed_by: user.user?.id,
      reviewed_at: new Date().toISOString(),
    } as any).eq("id", requestId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    if (action === "aprovado") {
      // Update the user's confirmation_year to 2
      await supabase.from("profiles").update({ confirmation_year: 2 } as any).eq("user_id", userId);
      toast({ title: "✅ Promoção aprovada", description: "Aluno promovido para o 2º ano." });
    } else {
      toast({ title: "Promoção rejeitada" });
    }

    setPromotionRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: action } : r)
    );
  }

  async function handleResetJourney() {
    setResettingJourney(true);
    const userIds = participants.map(p => p.user_id);
    
    if (userIds.length === 0) {
      toast({ title: "Nenhum membro", description: "Esta turma não possui membros.", variant: "destructive" });
      setResettingJourney(false);
      setShowResetConfirm(false);
      return;
    }

    await Promise.all([
      supabase.from("user_progress").delete().in("user_id", userIds),
      supabase.from("lesson_responses").delete().in("user_id", userIds),
      supabase.from("devotional_progress").delete().in("user_id", userIds),
      supabase.from("achievement_unlocks").delete().in("user_id", userIds),
      supabase.from("attendance").delete().in("user_id", userIds),
      supabase.from("worship_attendance").delete().in("user_id", userIds),
    ]);

    toast({ 
      title: "🔄 Jornada reiniciada!", 
      description: `Progresso de ${userIds.length} aluno(s) foi zerado com sucesso.` 
    });
    
    setResettingJourney(false);
    setShowResetConfirm(false);
  }
}