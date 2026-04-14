import { useState, useEffect, useCallback } from "react";
import { AREAS } from "@/config/areas";
import { EVENT_TYPES as EVENT_TYPES_LIST, getEventEmoji, getEventColor, getEventLabel } from "@/config/eventTypes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { useCustomEventTypes } from "@/hooks/useCustomEventTypes";
import { CalendarDays, MapPin, Users, BookOpen, ChevronDown, ChevronUp, Plus, Pencil, Trash2, Save, X, Clock, Timer, ExternalLink, CalendarIcon, Check, LayoutList, CalendarRange, Download, ChevronLeft, ChevronRight, Sparkles, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { differenceInDays, differenceInHours, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, isWithinInterval, format } from "date-fns";
import WorshipConfirmation from "./WorshipConfirmation";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import CalendarView from "./CalendarView";
import emptyAgendaImg from "@/assets/empty-agenda.png";

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  area: string | null;
  community: string | null;
  type: string;
  linked_lesson_id: string | null;
};

type LessonContentInfo = { lesson_id: string; summary: string; bible_texts: string[]; prayer_prompt: string };
type AttendanceRecord = { event_id: string; status: string };
type LessonInfo = { id: string; title: string; order_num: number; course_title: string; course_order: number };

// Static fallback map for rendering (includes pastoral type)
const STATIC_EVENT_TYPES: Record<string, { label: string; color: string; emoji: string }> = {
  ...Object.fromEntries(EVENT_TYPES_LIST.map(t => [t.value, { label: t.label, color: t.color, emoji: t.emoji }])),
  conversa: { label: "Conversa Pastoral", color: "bg-secondary/10 text-secondary", emoji: "💬" },
};

const EMOJI_OPTIONS = ["📅","⛪","✝️","🏕️","📖","🎉","💬","🙏","🎶","🌿","🤝","⭐","🔔","🎯","🏠","🌟"];

interface EventFormData {
  title: string;
  description: string;
  event_date: string;
  location: string;
  area: string;
  community: string;
  type: string;
  linked_lesson_id: string;
}

type LessonOption = {
  id: string;
  title: string;
  order_num: number;
  course_title: string;
  course_order: number;
};

const EMPTY_FORM: EventFormData = { title: "", description: "", event_date: "", location: "", area: "", community: "", type: "encontro", linked_lesson_id: "" };

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

function DateTimePickerField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : null;
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(parsed && !isNaN(parsed.getTime()) ? parsed : undefined);
  const [hour, setHour] = useState(parsed && !isNaN(parsed.getTime()) ? String(parsed.getHours()).padStart(2, "0") : "19");
  const [minute, setMinute] = useState(parsed && !isNaN(parsed.getTime()) ? String(parsed.getMinutes()).padStart(2, "0") : "00");

  useEffect(() => {
    const p = value ? new Date(value) : null;
    if (p && !isNaN(p.getTime())) {
      setSelectedDate(p);
      setHour(String(p.getHours()).padStart(2, "0"));
      setMinute(String(p.getMinutes()).padStart(2, "0"));
    }
  }, [value]);

  function handleConfirm() {
    if (!selectedDate) {
      toast.error("Selecione uma data");
      return;
    }
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}T${hour}:${minute}`);
    setOpen(false);
  }

  const displayText = selectedDate
    ? `${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} ${hour}:${minute}`
    : "";

  return (
    <div>
      <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Data e hora *</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal text-sm",
              !displayText && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayText || "Selecione data e hora"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className={cn("p-0 pointer-events-auto")}
            />
            <div className="flex items-center gap-2 px-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <select
                value={hour}
                onChange={e => setHour(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="font-bold text-muted-foreground">:</span>
              <select
                value={minute}
                onChange={e => setMinute(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <Button size="sm" className="w-full gap-1.5" onClick={handleConfirm}>
              <Check className="w-3.5 h-3.5" /> Confirmar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function UserAgendaTab() {
  const { profile, role } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const canManage = role === "admin" || role === "lider";
  const currentArea = effectiveArea || profile?.area || "";

  // Custom event types (merged static + DB)
  const { allTypes, customTypes, getLabel, getEmoji, getColor, refetch: refetchTypes } = useCustomEventTypes(currentArea);

  const [events, setEvents] = useState<Event[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [lessonInfoMap, setLessonInfoMap] = useState<Map<string, LessonInfo>>(new Map());
  const [lessonContentMap, setLessonContentMap] = useState<Map<string, LessonContentInfo>>(new Map());
  const [lessonOptions, setLessonOptions] = useState<LessonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("agenda");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "week">("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Event form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showCascadeDialog, setShowCascadeDialog] = useState(false);
  const [cascadePending, setCascadePending] = useState<{ eventId: string; oldLessonId: string | null; newLessonId: string } | null>(null);

  // Create custom type modal state
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({ label: "", emoji: "📅", gives_points: false, points: 10 });
  const [savingType, setSavingType] = useState(false);

  // Pending attendance approval (leaders only)
  type PendingAttendance = {
    id: string; event_id: string; user_id: string; status: string;
    justification: string | null; created_at: string;
    full_name?: string; community?: string; event_title?: string; event_date?: string;
  };
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<PendingAttendance[]>([]);
  const [savingApproval, setSavingApproval] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: eventsData }, attResult, { data: coursesData }, { data: lessonsData }, { data: lessonContentData }] = await Promise.all([
        supabase.from("events").select("*").order("event_date"),
        user
          ? supabase.from("attendance").select("event_id, status").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        supabase.from("courses").select("id, title, order_num").order("order_num"),
        supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
        supabase.from("lesson_content").select("lesson_id, summary, bible_texts, prayer_prompt"),
      ]);
      const { data: attendanceData } = attResult;
      const all = (eventsData ?? []) as Event[];
      const isManager = role === "admin" || role === "lider";
      const filtered = all.filter(e => {
        // Personal events: only show to target user
        if ((e as any).target_user_id && (e as any).target_user_id !== user?.id) return false;
        // Filter all events by area
        if (e.area && e.area !== currentArea) return false;
        // Community filter: skip for confirmatorio (area-wide) and for managers
        const isConfirmatorio = e.type === "confirmatorio";
        if (e.community && !isManager && !isConfirmatorio && e.community !== profile?.community) return false;
        return true;
      });
      setEvents(filtered);
      setAttendanceRecords((attendanceData ?? []) as AttendanceRecord[]);

      const courses = coursesData ?? [];
      const lessons = lessonsData ?? [];
      const infoMap = new Map<string, LessonInfo>();
      const opts: LessonOption[] = [];
      courses.forEach(c => {
        lessons.filter(l => l.course_id === c.id).forEach(l => {
          infoMap.set(l.id, { id: l.id, title: l.title, order_num: l.order_num, course_title: c.title, course_order: c.order_num });
          opts.push({ id: l.id, title: l.title, order_num: l.order_num, course_title: c.title, course_order: c.order_num });
        });
      });
      setLessonInfoMap(infoMap);
      setLessonOptions(opts);

      const contentMap = new Map<string, LessonContentInfo>();
      (lessonContentData ?? []).forEach((lc: any) => {
        contentMap.set(lc.lesson_id, lc);
      });
      setLessonContentMap(contentMap);
      setLoading(false);
    }
    if (profile) fetch();
  }, [profile, currentArea]);

  // Fetch pending attendance whenever events list changes (leaders only)
  useEffect(() => {
    if (canManage && events.length > 0) fetchPendingAttendance();
  }, [events, canManage]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('user-agenda-events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          async function refetch() {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const { data: eventsData } = await supabase.from("events").select("*").order("event_date");
            const all = (eventsData ?? []) as Event[];
            const isManager = role === "admin" || role === "lider";
            const filtered = all.filter(e => {
              if ((e as any).target_user_id && (e as any).target_user_id !== currentUser?.id) return false;
              if (e.area && e.area !== currentArea) return false;
              const isConfirmatorio = e.type === "confirmatorio";
              if (e.community && !isManager && !isConfirmatorio && e.community !== profile?.community) return false;
              return true;
            });
            setEvents(filtered);
          }
          if (profile) refetch();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, currentArea]);

  const now = new Date();

  const FILTER_GROUPS = [
    { key: "encontros", label: "📅 Encontros", types: ["encontro", "confirmatorio"] },
    { key: "cultos", label: "⛪ Cultos", types: ["culto", "jemiac"] },
    { key: "especiais", label: "🎉 Especiais", types: ["retiro", "evento", "conversa"] },
  ];

  function toggleFilter(key: string) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allowedTypes = activeFilters.size === 0
    ? null
    : new Set(FILTER_GROUPS.filter(g => activeFilters.has(g.key)).flatMap(g => g.types));

  const filteredEvents = allowedTypes
    ? events.filter(e => allowedTypes.has(e.type))
    : events;

  const upcoming = filteredEvents.filter(e => new Date(e.event_date) >= now);
  const past = filteredEvents.filter(e => new Date(e.event_date) < now);

  async function handleCheckIn(eventId: string, status: "pendente_presente" | "pendente_falta", justification?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { status };
    if (justification) payload.justification = justification;
    const existing = attendanceRecords.find(a => a.event_id === eventId);
    let error = null;
    if (existing) {
      const result = await supabase
        .from("attendance")
        .update(payload)
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      error = result.error;
    } else {
      const result = await supabase
        .from("attendance")
        .insert({ event_id: eventId, user_id: user.id, ...payload });
      error = result.error;
    }
    if (error) {
      toast.error("Não foi possível enviar sua solicitação.");
      console.error(error);
      return;
    }
    setAttendanceRecords(prev => {
      const filtered = prev.filter(a => a.event_id !== eventId);
      return [...filtered, { event_id: eventId, status }];
    });
    toast.success(status === "pendente_presente" ? "Presença enviada para aprovação!" : "Justificativa enviada para aprovação!");
  }

  function openCreateForm() {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, area: currentArea });
    setShowForm(true);
  }

  function openEditForm(event: Event) {
    setEditingEvent(event);
    const dateObj = event.event_date ? new Date(event.event_date) : null;
    const dateLocal = dateObj
      ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}T${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`
      : "";
    setForm({
      title: event.title,
      description: event.description ?? "",
      event_date: dateLocal,
      location: event.location ?? "",
      area: event.area ?? "",
      community: event.community ?? "",
      type: event.type,
      linked_lesson_id: event.linked_lesson_id ?? "",
    });
    setShowForm(true);
  }

  async function handleSaveEvent() {
    if (!form.title.trim() || !form.event_date) {
      toast.error("Preencha título e data do evento");
      return;
    }
    setSaving(true);
    const normalizedEventDate = form.event_date ? new Date(form.event_date) : null;
    if (!normalizedEventDate || Number.isNaN(normalizedEventDate.getTime())) {
      toast.error("Data do evento inválida.");
      setSaving(false);
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: normalizedEventDate.toISOString(),
      location: form.location.trim() || null,
      area: form.area || null,
      community: form.community || null,
      type: form.type,
      linked_lesson_id: form.linked_lesson_id || null,
    };

    if (editingEvent) {
      const oldLessonId = editingEvent.linked_lesson_id ?? null;
      const newLessonId = payload.linked_lesson_id;

      // Check cascade for lesson change
      if (oldLessonId !== newLessonId && newLessonId) {
        const subsequentWithLessons = events.filter(
          e => e.id !== editingEvent.id && new Date(e.event_date).getTime() > new Date(editingEvent.event_date).getTime() && e.linked_lesson_id
        );
        if (subsequentWithLessons.length > 0) {
          // Save other fields first (without lesson change), then handle cascade
          const { error: prepareCascadeError } = await supabase
            .from("events")
            .update({ ...payload, linked_lesson_id: oldLessonId })
            .eq("id", editingEvent.id);
          if (prepareCascadeError) {
            toast.error("Erro ao preparar atualizacao em cascata");
            console.error(prepareCascadeError);
            setSaving(false);
            return;
          }
          setCascadePending({ eventId: editingEvent.id, oldLessonId, newLessonId });
          setShowCascadeDialog(true);
          setShowForm(false);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase.from("events").update(payload).eq("id", editingEvent.id);
      if (error) {
        toast.error("Erro ao atualizar evento");
        console.error(error);
      } else {
        toast.success("Evento atualizado!");
        setShowForm(false);
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("events").insert({ ...payload, created_by: user?.id ?? null } as any);
      if (error) {
        toast.error("Erro ao criar evento");
        console.error(error);
      } else {
        toast.success("Evento criado!");
        setShowForm(false);
      }
    }
    setSaving(false);
  }

  async function executeCascade(doCascade: boolean) {
    if (!cascadePending) return;
    const { eventId, oldLessonId, newLessonId } = cascadePending;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const { error: updateError } = await supabase
      .from("events")
      .update({ linked_lesson_id: newLessonId })
      .eq("id", eventId);
    if (updateError) {
      toast.error("Erro ao atualizar a licao do evento");
      console.error(updateError);
      setShowCascadeDialog(false);
      setCascadePending(null);
      return;
    }

    if (doCascade) {
      const subsequent = events
        .filter(e => e.id !== eventId && new Date(e.event_date).getTime() > new Date(event.event_date).getTime() && e.linked_lesson_id)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

      if (subsequent.length > 0) {
        const newLesson = lessonOptions.find(l => l.id === newLessonId);
        if (newLesson) {
          const allLessonsOrdered = [...lessonOptions].sort((a, b) => {
            if (a.course_order !== b.course_order) return a.course_order - b.course_order;
            return a.order_num - b.order_num;
          });

          const newIdx = allLessonsOrdered.findIndex(l => l.id === newLessonId);
          if (newIdx >= 0) {
            let updated = 0;
            let overflow = 0;
            for (let i = 0; i < subsequent.length; i++) {
              const nextLessonIdx = newIdx + 1 + i;
              if (nextLessonIdx < allLessonsOrdered.length) {
                const { error: cascadeError } = await supabase.from("events")
                  .update({ linked_lesson_id: allLessonsOrdered[nextLessonIdx].id })
                  .eq("id", subsequent[i].id);
                if (cascadeError) {
                  toast.error("Erro ao aplicar cascata de licoes");
                  console.error(cascadeError);
                  setShowCascadeDialog(false);
                  setCascadePending(null);
                  return;
                }
                updated++;
              } else {
                overflow++;
              }
            }
            if (overflow > 0) {
              toast.warning(`${updated + 1} eventos atualizados. ${overflow} evento(s) não tinham lições suficientes para vincular.`);
            } else {
              toast.success(`Lições atualizadas em ${updated + 1} eventos!`);
            }
          }
        }
      }
    } else {
      toast.success("Lição atualizada (sem cascata)!");
    }

    setShowCascadeDialog(false);
    setCascadePending(null);
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      toast.error("Erro ao excluir evento");
    } else {
      toast.success("Evento excluído!");
      setEvents(prev => prev.filter(e => e.id !== eventId));
    }
  }

  async function fetchPendingAttendance() {
    if (!canManage) return;
    // Filter by events in this area
    const areaEventIds = events.filter(e => !e.area || e.area === currentArea).map(e => e.id);
    if (areaEventIds.length === 0) { setPendingAttendance([]); return; }
    const { data, error } = await supabase
      .from("attendance")
      .select("id, event_id, user_id, status, justification, created_at")
      .in("event_id", areaEventIds)
      .in("status", ["pendente_presente", "pendente_falta"])
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar as solicitações pendentes.");
      console.error(error);
      return;
    }
    if (!data || data.length === 0) { setPendingAttendance([]); return; }
    const userIds = [...new Set(data.map(a => a.user_id))];
    const eventIds = [...new Set(data.map(a => a.event_id))];
    const [{ data: profilesData }, { data: eventsData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, community").in("user_id", userIds),
      supabase.from("events").select("id, title, event_date").in("id", eventIds),
    ]);
    const profileMap = new Map((profilesData ?? []).map((p: any) => [p.user_id, p]));
    const evMap = new Map((eventsData ?? []).map((e: any) => [e.id, e]));
    setPendingAttendance(data.map(a => ({
      ...a,
      full_name: profileMap.get(a.user_id)?.full_name ?? "Desconhecido",
      community: profileMap.get(a.user_id)?.community ?? "",
      event_title: evMap.get(a.event_id)?.title ?? "Evento",
      event_date: evMap.get(a.event_id)?.event_date ?? a.created_at,
    })));
  }

  async function handleAttendanceApproval(id: string, action: "presente" | "justificou" | "rejeitado") {
    setSavingApproval(id);
    let error = null;
    if (action === "rejeitado") {
      const result = await supabase.from("attendance").delete().eq("id", id);
      error = result.error;
    } else {
      const result = await supabase.from("attendance").update({ status: action }).eq("id", id);
      error = result.error;
    }
    if (error) {
      toast.error("Não foi possível atualizar a solicitação.");
      console.error(error);
      setSavingApproval(null);
      return;
    }
    setPendingAttendance(prev => prev.filter(a => a.id !== id));
    toast.success(action === "presente" ? "Presença aprovada ✅" : action === "justificou" ? "Falta justificada ✓" : "Solicitação rejeitada");
    setSavingApproval(null);
  }

  async function handleCreateType() {
    if (!newTypeForm.label.trim()) { toast.error("Digite um nome para o tipo"); return; }
    setSavingType(true);
    const slug = newTypeForm.label.trim().toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("custom_event_types").insert({
      value: slug,
      label: newTypeForm.label.trim(),
      emoji: newTypeForm.emoji,
      gives_points: newTypeForm.gives_points,
      points: newTypeForm.gives_points ? newTypeForm.points : 0,
      area: currentArea || null,
      created_by: user?.id ?? null,
    } as any);
    if (error) { toast.error("Erro ao criar tipo"); console.error(error); }
    else {
      toast.success(`Tipo "${newTypeForm.label}" criado!`);
      await refetchTypes();
      setForm(f => ({ ...f, type: slug }));
      setShowCreateTypeModal(false);
      setNewTypeForm({ label: "", emoji: "📅", gives_points: false, points: 10 });
    }
    setSavingType(false);
  }

  const pastEvents = filteredEvents
    .filter(e => new Date(e.event_date) < now)
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());

  return (
    <div className="px-5 pt-5 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-montserrat font-black text-foreground text-xl">📅 Agenda</h2>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-muted rounded-xl p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title="Lista"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === "week" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title="Semana"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === "calendar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              title="Mês"
            >
              <CalendarRange className="w-3.5 h-3.5" />
            </button>
          </div>
          {canManage && pendingAttendance.length > 0 && (
            <button
              onClick={() => { setShowPendingModal(true); }}
              className="relative h-8 px-2.5 rounded-xl text-xs gap-1.5 border border-accent/40 text-accent-foreground bg-accent/10 hover:bg-accent/20 transition-colors flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Presenças</span>
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1">
                {pendingAttendance.length}
              </span>
            </button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-xs gap-1.5 border-primary/40 text-primary" onClick={openCreateForm}>
              <Plus className="w-3.5 h-3.5" /> Novo Evento
            </Button>
          )}
          {currentArea && (
            <span className="text-xs font-inter text-muted-foreground bg-muted rounded-full px-3 py-1">
              {currentArea}
            </span>
          )}
        </div>
      </div>

      {/* ── CONFIRMAÇÃO DE PRESENÇA EM EVENTOS ──── */}
      {/* Pass all area events (not filtered by type) so the modal always shows every event */}
      <WorshipConfirmation
        events={events}
        attendanceRecords={attendanceRecords}
        onCheckIn={handleCheckIn}
      />

      {/* ── FILTROS DE TIPO ──── */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_GROUPS.map(g => {
          const isActive = activeFilters.has(g.key);
          return (
            <button
              key={g.key}
              onClick={() => toggleFilter(g.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-montserrat font-bold transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {g.label}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            className="px-3 py-1.5 rounded-full text-[11px] font-montserrat font-bold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
          >
            ✕ Limpar
          </button>
        )}
      </div>
      {/* ── CALENDAR VIEW ──── */}
      {viewMode === "calendar" && !loading && (
        <CalendarView events={filteredEvents} />
      )}

      {/* ── WEEKLY VIEW ──── */}
      {viewMode === "week" && !loading && (() => {
        const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 0, locale: ptBR });
        const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 0, locale: ptBR });
        const weekEvents = filteredEvents.filter(e => {
          const d = new Date(e.event_date);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        }).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          return d;
        });
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <p className="font-montserrat font-bold text-foreground text-sm">
                {format(weekStart, "d MMM", { locale: ptBR })} — {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
              </p>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-[10px] font-inter font-semibold text-primary hover:underline mx-auto block">
                Voltar para esta semana
              </button>
            )}
            <div className="space-y-1">
              {days.map((day, idx) => {
                const dayEvents = weekEvents.filter(e => isSameDay(new Date(e.event_date), day));
                const isToday = isSameDay(day, now);
                return (
                  <div key={idx} className={`rounded-xl border ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"} p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-montserrat font-bold text-xs ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {format(day, "EEE", { locale: ptBR }).toUpperCase()}
                      </span>
                      <span className={`font-montserrat font-black text-sm ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      {isToday && <span className="text-[9px] font-inter font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">HOJE</span>}
                    </div>
                    {dayEvents.length === 0 ? (
                      <p className="text-muted-foreground font-inter text-[10px] ml-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayEvents.map(evt => {
                          const typeInfo = STATIC_EVENT_TYPES[evt.type] ?? { emoji: getEmoji(evt.type), label: getLabel(evt.type), color: getColor(evt.type) };
                          const time = format(new Date(evt.event_date), "HH:mm");
                          return (
                            <div key={evt.id} className="flex items-center gap-2 ml-1">
                              <span className="text-sm">{typeInfo.emoji}</span>
                              <span className="font-inter text-xs text-foreground font-medium">{time}</span>
                              <span className="font-inter text-xs text-foreground truncate">{evt.title}</span>
                              {evt.location && <span className="text-muted-foreground text-[10px] font-inter truncate hidden sm:inline">📍 {evt.location}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── LIST VIEW ──── */}
      {viewMode === "list" && loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-muted rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : viewMode === "list" && upcoming.length === 0 && past.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
          <img src={emptyAgendaImg} alt="Agenda vazia" className="w-28 h-28 mx-auto mb-3 opacity-80" />
          <p className="font-montserrat font-bold text-foreground text-base mb-1">Nenhum evento agendado</p>
          <p className="text-muted-foreground text-sm font-inter">
            Os próximos encontros e eventos aparecerão aqui. Fique atento! 🙏
          </p>
        </div>
      ) : viewMode === "list" ? (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="font-montserrat font-bold text-foreground text-sm">📌 Próximos eventos</p>
              {upcoming.map(event => {
                const linkedLesson = event.linked_lesson_id ? lessonInfoMap.get(event.linked_lesson_id) : undefined;
                const lessonContent = linkedLesson ? lessonContentMap.get(linkedLesson.id) : undefined;
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    linkedLesson={linkedLesson}
                    lessonContent={lessonContent}
                    attendanceRecords={attendanceRecords}
                    onNavigateToLesson={setActiveTab}
                    canManage={canManage}
                    onEdit={openEditForm}
                    onDelete={handleDeleteEvent}
                    typeEmoji={getEmoji(event.type)}
                    typeLabel={getLabel(event.type)}
                    typeColor={getColor(event.type)}
                  />
                );
              })}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <p className="font-montserrat font-bold text-muted-foreground text-sm">Eventos anteriores</p>
              {past.slice(0, 3).map(event => {
                const linkedLesson = event.linked_lesson_id ? lessonInfoMap.get(event.linked_lesson_id) : undefined;
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    past
                    linkedLesson={linkedLesson}
                    attendanceRecords={attendanceRecords}
                    canManage={canManage}
                    onEdit={openEditForm}
                    onDelete={handleDeleteEvent}
                    typeEmoji={getEmoji(event.type)}
                    typeLabel={getLabel(event.type)}
                    typeColor={getColor(event.type)}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {/* ── HISTÓRICO DE PRESENÇA ────────────────── */}
      {viewMode === "list" && pastEvents.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2.5 border-b border-border bg-muted/30">
            <CalendarDays className="w-4 h-4 text-secondary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Histórico de Presença</p>
          </div>
          <div className="p-4 space-y-2">
            {pastEvents.slice(0, 8).map((evt) => {
              const record = attendanceRecords.find(a => a.event_id === evt.id);
              const status = record?.status;
              const statusCfg: Record<string, { icon: string; label: string; cls: string }> = {
                presente: { icon: "🟢", label: "Presente", cls: "text-brand-green bg-brand-green/10" },
                faltou: { icon: "🔴", label: "Faltou", cls: "text-destructive bg-destructive/10" },
                justificou: { icon: "🟡", label: "Justificou", cls: "text-accent-foreground bg-accent/20" },
                pendente_presente: { icon: "⏳", label: "Aguardando aprovação", cls: "text-accent-foreground bg-accent/20" },
                pendente_falta: { icon: "⏳", label: "Justificativa pendente", cls: "text-accent-foreground bg-accent/20" },
              };
              const cfg = statusCfg[status ?? ""] ?? { icon: "⚪", label: "Sem registro", cls: "text-muted-foreground bg-muted" };

              const date = new Date(evt.event_date);
              const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

              return (
                <div key={evt.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-muted/30">
                  <span className="text-base">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm text-foreground truncate">{evt.title}</p>
                    <p className="font-inter text-[10px] text-muted-foreground">{dateStr}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}

            {(() => {
              const total = pastEvents.filter(e => attendanceRecords.some(a => a.event_id === e.id)).length;
              const present = attendanceRecords.filter(a => a.status === "presente").length;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;
              return total > 0 ? (
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="font-inter text-xs text-muted-foreground">Taxa de presença</span>
                  <span className={`font-montserrat font-bold text-sm ${rate >= 70 ? "text-brand-green" : rate >= 40 ? "text-accent-foreground" : "text-destructive"}`}>
                    {rate}%
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* ── DIÁLOGO DE CASCATA ──────────────── */}
      {showCascadeDialog && cascadePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => executeCascade(false)}>
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
      )}

      {/* ── MODAL DE APROVAÇÃO DE PRESENÇAS ────────── */}
      <Dialog open={showPendingModal} onOpenChange={(open) => { if (!open) setShowPendingModal(false); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Aprovação de Presenças
              {pendingAttendance.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-inter font-bold bg-primary/10 text-primary">
                  {pendingAttendance.length} pendente{pendingAttendance.length !== 1 ? "s" : ""}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {pendingAttendance.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-brand-green mx-auto mb-2 opacity-60" />
                <p className="font-inter text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
              </div>
            ) : (
              pendingAttendance.map(a => {
                const isSaving = savingApproval === a.id;
                const isPresence = a.status === "pendente_presente";
                const eventDate = a.event_date ? new Date(a.event_date) : null;
                return (
                  <div key={a.id} className="bg-muted/30 rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPresence ? "bg-brand-green/10" : "bg-accent/20"}`}>
                        {isPresence
                          ? <CheckCircle2 className="w-5 h-5 text-brand-green" />
                          : <Clock className="w-5 h-5 text-accent-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter font-semibold text-sm text-foreground">{a.full_name}</p>
                        {a.community && <p className="font-inter text-[10px] text-muted-foreground">{a.community}</p>}
                        <p className="font-inter text-xs text-foreground mt-0.5">📅 {a.event_title}</p>
                        {eventDate && (
                          <p className="font-inter text-[10px] text-muted-foreground">
                            {format(eventDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-inter font-semibold ${isPresence ? "bg-brand-green/10 text-brand-green" : "bg-accent/20 text-accent-foreground"}`}>
                          {isPresence ? "Solicitando presença" : "Solicitando justificativa"}
                        </span>
                      </div>
                    </div>
                    {a.justification && (
                      <div className="px-3 py-2 rounded-xl bg-muted text-xs font-inter text-muted-foreground italic">
                        "{a.justification}"
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAttendanceApproval(a.id, isPresence ? "presente" : "justificou")}
                        disabled={!!isSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-green/10 hover:bg-brand-green/20 text-brand-green font-inter text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isSaving ? "Salvando..." : "Aprovar"}
                      </button>
                      <button
                        onClick={() => handleAttendanceApproval(a.id, "rejeitado")}
                        disabled={!!isSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-inter text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rejeitar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DE CRIAR TIPO DE EVENTO ────────── */}
      <Dialog open={showCreateTypeModal} onOpenChange={(open) => { if (!open) setShowCreateTypeModal(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Novo Tipo de Evento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome do tipo *</label>
              <Input
                value={newTypeForm.label}
                onChange={e => setNewTypeForm(f => ({ ...f, label: e.target.value }))}
                className="text-sm"
                placeholder="Ex: Retiro Jovens"
              />
            </div>
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Emoji</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {EMOJI_OPTIONS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewTypeForm(f => ({ ...f, emoji: em }))}
                    className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors ${newTypeForm.emoji === em ? "bg-primary/20 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
              <Input
                value={newTypeForm.emoji}
                onChange={e => setNewTypeForm(f => ({ ...f, emoji: e.target.value }))}
                className="text-sm w-20"
                maxLength={2}
                placeholder="✏️"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
              <input
                type="checkbox"
                id="gives_points_user"
                checked={newTypeForm.gives_points}
                onChange={e => setNewTypeForm(f => ({ ...f, gives_points: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="gives_points_user" className="text-sm font-inter text-foreground cursor-pointer flex-1">
                Dá pontuação
              </label>
              {newTypeForm.gives_points && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-inter text-muted-foreground">Pts:</span>
                  <Input
                    type="number"
                    value={newTypeForm.points}
                    onChange={e => setNewTypeForm(f => ({ ...f, points: Number(e.target.value) }))}
                    className="text-sm w-16 h-7 px-2"
                    min={1}
                  />
                </div>
              )}
            </div>
            {currentArea && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-inter">
                <Users className="w-3.5 h-3.5" />
                <span>Será criado para a área <strong>{currentArea}</strong></span>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowCreateTypeModal(false)} disabled={savingType}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleCreateType} disabled={savingType}>
                <Sparkles className="w-3.5 h-3.5" /> {savingType ? "Criando..." : "Criar Tipo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DE CRIAR/EDITAR EVENTO ────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground">
              {editingEvent ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Título *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="text-sm" placeholder="Ex: Encontro da Turma" />
            </div>
            <DateTimePickerField
              value={form.event_date}
              onChange={(val) => setForm(f => ({ ...f, event_date: val }))}
            />
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Tipo</label>
              <div className="flex gap-2 items-center">
                <select
                  value={form.type}
                  onChange={e => {
                    if (e.target.value === "__create__") { setShowCreateTypeModal(true); }
                    else { setForm(f => ({ ...f, type: e.target.value })); }
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {allTypes.map(o => (
                    <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                  ))}
                  <option value="__create__">➕ Criar novo tipo...</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowCreateTypeModal(true)}
                  className="p-2 rounded-md border border-input bg-background hover:bg-accent/20 transition-colors text-muted-foreground"
                  title="Criar novo tipo de evento"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Local</label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="text-sm" placeholder="Ex: Igreja Central" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Área</label>
                <select
                  value={form.area}
                  onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Todas</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Comunidade</label>
                <Input value={form.community} onChange={e => setForm(f => ({ ...f, community: e.target.value }))} className="text-sm" placeholder="Opcional" />
              </div>
            </div>
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">📖 Vincular a um estudo</label>
              <select
                value={form.linked_lesson_id}
                onChange={e => setForm(f => ({ ...f, linked_lesson_id: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sem vínculo</option>
                {lessonOptions.map(l => (
                  <option key={l.id} value={l.id}>
                    Curso {l.course_order} — Lição {l.order_num}: {l.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Descrição</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm resize-none" rows={3} placeholder="Detalhes do evento..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setShowForm(false)} disabled={saving}>
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
              <Button size="sm" className="flex-1 gap-1.5" onClick={handleSaveEvent} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({ event, past = false, linkedLesson, lessonContent, attendanceRecords = [], onNavigateToLesson, canManage, onEdit, onDelete, typeEmoji, typeLabel, typeColor }: {
  event: Event; past?: boolean; linkedLesson?: LessonInfo; lessonContent?: LessonContentInfo;
  attendanceRecords?: AttendanceRecord[];
  onNavigateToLesson?: (tab: string) => void;
  canManage?: boolean; onEdit?: (event: Event) => void; onDelete?: (eventId: string) => void;
  typeEmoji?: string; typeLabel?: string; typeColor?: string;
}) {
  const [showPrep, setShowPrep] = useState(false);
  const fallback = STATIC_EVENT_TYPES[event.type] ?? STATIC_EVENT_TYPES.evento;
  const typeInfo = { emoji: typeEmoji ?? fallback.emoji, label: typeLabel ?? fallback.label, color: typeColor ?? fallback.color };
  const dateObj = new Date(event.event_date);
  
  const now = new Date();
  const diffHours = (now.getTime() - dateObj.getTime()) / 3600000;
  // Show buttons for events up to 7 days before and 48 hours after
  const isCheckInWindow = diffHours >= -168 && diffHours <= 48;
  const existingRecord = attendanceRecords.find(a => a.event_id === event.id);

  const handleLessonClick = () => {
    if (onNavigateToLesson) {
      window.dispatchEvent(new CustomEvent("navigate-to-lesson", { detail: { lessonId: linkedLesson?.id } }));
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pendente_presente":
        return { icon: "⏳", label: "Presença aguardando aprovação", cls: "bg-accent/20 text-accent-foreground" };
      case "pendente_falta":
        return { icon: "⏳", label: "Justificativa aguardando aprovação", cls: "bg-accent/20 text-accent-foreground" };
      case "presente":
        return { icon: "📍", label: "Presença confirmada ✓", cls: "bg-brand-green/10 text-brand-green" };
      case "justificou":
        return { icon: "🟡", label: "Falta justificada", cls: "bg-accent/20 text-accent-foreground" };
      case "faltou":
        return { icon: "❌", label: "Ausência registrada", cls: "bg-destructive/10 text-destructive" };
      default:
        return { icon: "⚪", label: status, cls: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className={`bg-card rounded-2xl border border-border p-4 shadow-sm ${past ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-lg leading-none">{typeInfo.emoji}</span>
          <span className="font-montserrat font-black text-primary text-xs leading-none mt-0.5">
            {format(dateObj, "d", { locale: ptBR })}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-montserrat font-bold text-foreground text-sm">{event.title}</h3>
            {canManage && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit?.(event)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete?.(event.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-muted-foreground font-inter text-xs mt-0.5">
            {format(dateObj, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-inter font-medium ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-inter">
                <MapPin className="w-3 h-3" />{event.location}
              </span>
            )}
            {event.area && (
              <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-inter">
                <Users className="w-3 h-3" />{event.area}
              </span>
            )}
          </div>
          {/* Calendar links: Google + Apple (.ics) */}
          {!past && (() => {
            const start = new Date(event.event_date);
            const end = new Date(start.getTime() + 90 * 60000);
            const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
            const params = new URLSearchParams({
              action: "TEMPLATE",
              text: event.title,
              dates: `${fmt(start)}/${fmt(end)}`,
              details: event.description || "",
              location: event.location || "",
            });
            const googleUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;

            const handleDownloadIcs = () => {
              const pad = (n: number) => String(n).padStart(2, "0");
              const fmtIcs = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
              const ics = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Caminho//App//PT",
                "BEGIN:VEVENT",
                `DTSTART:${fmtIcs(start)}`,
                `DTEND:${fmtIcs(end)}`,
                `SUMMARY:${event.title}`,
                `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
                `LOCATION:${event.location || ""}`,
                `UID:${event.id}@caminho.app`,
                "END:VEVENT",
                "END:VCALENDAR",
              ].join("\r\n");
              const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Arquivo .ics baixado!");
            };

            return (
              <div className="mt-2 flex gap-2 flex-wrap">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="font-inter text-[10px] font-semibold">Google Agenda</span>
                </a>
                <button
                  onClick={handleDownloadIcs}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors text-secondary"
                >
                  <Download className="w-3 h-3" />
                  <span className="font-inter text-[10px] font-semibold">Apple Calendar (.ics)</span>
                </button>
              </div>
            );
          })()}
          {linkedLesson && (
            <>
              <button
                onClick={handleLessonClick}
                className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 transition-colors w-full text-left"
              >
                <BookOpen className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                <p className="font-inter text-[10px] text-secondary font-medium truncate">
                  📖 Ligado ao Curso {linkedLesson.course_order} — Lição {linkedLesson.order_num}: {linkedLesson.title}
                </p>
              </button>
              {/* Countdown to study window */}
              {!past && (() => {
                const daysLeft = differenceInDays(dateObj, now);
                const hoursLeft = differenceInHours(dateObj, now);
                if (hoursLeft <= 0) return null;
                
                const isUrgent = daysLeft <= 1;
                const isClose = daysLeft <= 3;
                
                const bgColor = isUrgent
                  ? "bg-destructive/10 border-destructive/30"
                  : isClose
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-primary/10 border-primary/30";
                
                const textColor = isUrgent
                  ? "text-destructive"
                  : isClose
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-primary";
                
                const numColor = isUrgent
                  ? "text-destructive"
                  : isClose
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-primary";

                const label = daysLeft === 0
                  ? `${hoursLeft}h restantes`
                  : daysLeft === 1
                  ? "1 dia restante"
                  : `${daysLeft} dias restantes`;

                const description = daysLeft === 0
                  ? "O estudo abre hoje!"
                  : daysLeft <= 2
                  ? "Prepare-se para o estudo!"
                  : "até a abertura do estudo vinculado";

                return (
                  <div className={`mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${bgColor} animate-in fade-in duration-300`}>
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full ${isUrgent ? "bg-destructive/20" : isClose ? "bg-amber-500/20" : "bg-primary/20"}`}>
                      <Timer className={`w-3.5 h-3.5 ${textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-montserrat font-bold text-xs ${numColor}`}>
                        ⏳ {label}
                      </p>
                      <p className="font-inter text-[10px] text-muted-foreground">
                        {description}
                      </p>
                    </div>
                    {daysLeft <= 3 && (
                      <span className={`text-lg ${isUrgent ? "animate-pulse" : ""}`}>
                        {isUrgent ? "🔥" : "📚"}
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          )}
          {/* Preparation section */}
          {!past && linkedLesson && lessonContent && (lessonContent.summary || lessonContent.prayer_prompt || (lessonContent.bible_texts && lessonContent.bible_texts.length > 0)) && (
            <div className="mt-2">
              <button
                onClick={() => setShowPrep(p => !p)}
                className="flex items-center gap-1.5 text-primary font-inter text-[11px] font-semibold hover:underline"
              >
                {showPrep ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                📖 Preparação para o encontro
              </button>
              {showPrep && (
                <div className="mt-2 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200 p-3 rounded-xl bg-muted/40 border border-border">
                  {lessonContent.bible_texts && lessonContent.bible_texts.length > 0 && lessonContent.bible_texts[0] !== "" && (
                    <div>
                      <p className="font-inter text-[10px] font-bold text-foreground mb-1">📖 Conteúdo a estudar</p>
                      {lessonContent.bible_texts.map((t, i) => (
                        <p key={i} className="font-inter text-[11px] text-muted-foreground leading-relaxed">• {t}</p>
                      ))}
                    </div>
                  )}
                  {lessonContent.summary && (
                    <div>
                      <p className="font-inter text-[10px] font-bold text-foreground mb-1">📝 Resumo</p>
                      <p className="font-inter text-[11px] text-muted-foreground leading-relaxed">{lessonContent.summary}</p>
                    </div>
                  )}
                  {lessonContent.prayer_prompt && (
                    <div>
                      <p className="font-inter text-[10px] font-bold text-foreground mb-1">🙏 Preparação espiritual</p>
                      <p className="font-inter text-[11px] text-muted-foreground leading-relaxed">{lessonContent.prayer_prompt}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {event.description && (
            <p className="text-muted-foreground font-inter text-xs mt-1.5 leading-relaxed">{event.description}</p>
          )}

          {/* Attendance status badge (read-only — check-in is done via the "Confirmar Presença" section) */}
          {isCheckInWindow && existingRecord && (
            <div className="mt-2.5">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${getStatusDisplay(existingRecord.status).cls}`}>
                <span className="text-sm">{getStatusDisplay(existingRecord.status).icon}</span>
                <p className="font-inter text-xs font-semibold">
                  {getStatusDisplay(existingRecord.status).label}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
