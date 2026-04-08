import { useState, useEffect } from "react";
import { AREAS, ALL_COMMUNITIES } from "@/config/areas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { useCustomEventTypes } from "@/hooks/useCustomEventTypes";
import { CalendarDays, Plus, X, MapPin, Users, BookOpen, Pencil, Check, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  turma_id: string | null;
  created_by: string | null;
};

type LessonOption = {
  id: string;
  title: string;
  order_num: number;
  course_title: string;
  course_order: number;
  course_id: string;
};

const EMPTY_FORM = {
  title: "", description: "", event_date: "", location: "", type: "encontro", area: "", community: "", linked_lesson_id: "",
  scope: "area" as "area" | "turma", turmaId: "",
};

const EMOJI_OPTIONS = ["📅", "⛪", "✝️", "🏕️", "📖", "🎉", "💬", "🙏", "🎶", "🌿", "🤝", "⭐", "🔔", "🎯", "🏠", "🌟"];

type Props = {
  /** When true, restricts the leader to create events only for their area or turma */
  leaderMode?: boolean;
};

export default function AgendaTab({ leaderMode = false }: Props) {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const { allTypes, customTypes, getLabel, getEmoji, getColor, refetch: refetchTypes } = useCustomEventTypes(currentArea);

  const [events, setEvents] = useState<Event[]>([]);
  const [areaFilter, setAreaFilter] = useState<string>(currentArea);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingFullEventId, setEditingFullEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editLessonId, setEditLessonId] = useState<string>("");
  const [showCascadeDialog, setShowCascadeDialog] = useState(false);
  const [cascadePending, setCascadePending] = useState<{ eventId: string; oldLessonId: string | null; newLessonId: string } | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Create custom event type modal state
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    label: "",
    emoji: "📅",
    gives_points: false,
    points: 10,
  });
  const [savingType, setSavingType] = useState(false);

  useEffect(() => { fetchEvents(); fetchLessons(); }, []);

  async function fetchEvents() {
    setLoading(true);
    const { data, error } = await supabase.from("events").select("*").order("event_date");
    if (error) {
      toast.error("Erro ao carregar eventos", { description: error.message });
    }
    setEvents((data ?? []) as Event[]);
    setLoading(false);
  }

  async function fetchLessons() {
    const [{ data: coursesData, error: coursesError }, { data: lessonsData, error: lessonsError }] = await Promise.all([
      supabase.from("courses").select("id, title, order_num").order("order_num"),
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
    ]);
    if (coursesError || lessonsError) {
      toast.error("Erro ao carregar estudos", { description: coursesError?.message ?? lessonsError?.message });
    }
    const courses = coursesData ?? [];
    const lessonsList = lessonsData ?? [];
    const options: LessonOption[] = [];
    courses.forEach(c => {
      lessonsList.filter(l => l.course_id === c.id).forEach(l => {
        options.push({ id: l.id, title: l.title, order_num: l.order_num, course_title: c.title, course_order: c.order_num, course_id: c.id });
      });
    });
    setLessons(options);
  }

  function openNewForm() {
    setEditingFullEventId(null);
    const defaultScope = leaderMode && profile?.turma_id ? "turma" : "area";
    setForm({
      ...EMPTY_FORM,
      area: currentArea,
      scope: defaultScope,
      turmaId: leaderMode && profile?.turma_id ? profile.turma_id : "",
    });
    setShowForm(true);
  }

  function openEditForm(event: Event) {
    setEditingFullEventId(event.id);
    const dateForInput = event.event_date ? format(new Date(event.event_date), "yyyy-MM-dd'T'HH:mm") : "";
    setForm({
      title: event.title,
      description: event.description ?? "",
      event_date: dateForInput,
      location: event.location ?? "",
      type: event.type,
      area: event.area ?? currentArea,
      community: event.community ?? "",
      linked_lesson_id: event.linked_lesson_id ?? "",
      scope: event.turma_id ? "turma" : "area",
      turmaId: event.turma_id ?? "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title || !form.event_date) return;
    setSaving(true);
    const normalizedEventDate = form.event_date ? new Date(form.event_date) : null;
    if (!normalizedEventDate || Number.isNaN(normalizedEventDate.getTime())) {
      toast.error("Data do evento invalida.");
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: normalizedEventDate.toISOString(),
      location: form.location || null,
      type: form.type,
      area: leaderMode
        ? (form.scope === "area" ? currentArea || null : null)
        : (form.area || null),
      community: leaderMode ? null : (form.community || null),
      linked_lesson_id: leaderMode ? null : (form.linked_lesson_id || null),
      turma_id: leaderMode
        ? (form.scope === "turma" ? form.turmaId || null : null)
        : null,
    };

    if (editingFullEventId) {
      const oldEvent = events.find(e => e.id === editingFullEventId);
      const oldLessonId = oldEvent?.linked_lesson_id ?? null;
      const newLessonId = payload.linked_lesson_id;

      if (oldLessonId !== newLessonId && newLessonId && oldEvent) {
        const subsequentWithLessons = events.filter(
          e =>
            e.id !== editingFullEventId &&
            new Date(e.event_date).getTime() > new Date(oldEvent.event_date).getTime() &&
            e.linked_lesson_id
        );
        if (subsequentWithLessons.length > 0) {
          await supabase.from("events").update({ ...payload, linked_lesson_id: oldLessonId }).eq("id", editingFullEventId);
          setCascadePending({ eventId: editingFullEventId, oldLessonId, newLessonId });
          setShowCascadeDialog(true);
          setShowForm(false);
          setEditingFullEventId(null);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase.from("events").update(payload).eq("id", editingFullEventId);
      if (error) {
        toast.error("Erro ao atualizar evento", { description: error.message });
        setSaving(false);
        return;
      }
      toast.success("Evento atualizado!");
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        toast.error("Erro ao identificar o lider", { description: userError.message });
        setSaving(false);
        return;
      }
      const { error } = await supabase.from("events").insert({ ...payload, created_by: user?.id });
      if (error) {
        toast.error("Erro ao criar evento", { description: error.message });
        setSaving(false);
        return;
      }
      toast.success("Evento criado!");
    }

    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    setEditingFullEventId(null);
    setSaving(false);
    fetchEvents();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir evento", { description: error.message });
      return;
    }
    fetchEvents();
  }

  function startEditLesson(event: Event) {
    setEditingEventId(event.id);
    setEditLessonId(event.linked_lesson_id ?? "");
  }

  async function saveEditLesson(eventId: string) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const oldLessonId = event.linked_lesson_id;
    const newLessonId = editLessonId || null;

    if (oldLessonId !== newLessonId && newLessonId) {
      const subsequentWithLessons = events.filter(
        e =>
          e.id !== eventId &&
          new Date(e.event_date).getTime() > new Date(event.event_date).getTime() &&
          e.linked_lesson_id
      );
      if (subsequentWithLessons.length > 0) {
        setCascadePending({ eventId, oldLessonId, newLessonId });
        setShowCascadeDialog(true);
        return;
      }
    }

    const { error } = await supabase.from("events").update({ linked_lesson_id: newLessonId }).eq("id", eventId);
    if (error) {
      toast.error("Erro ao atualizar licao", { description: error.message });
      return;
    }
    setEditingEventId(null);
    toast.success("Licao atualizada!");
    fetchEvents();
  }

  async function executeCascade(doCascade: boolean) {
    if (!cascadePending) return;
    const { eventId, oldLessonId, newLessonId } = cascadePending;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const { error: baseUpdateError } = await supabase.from("events").update({ linked_lesson_id: newLessonId }).eq("id", eventId);
    if (baseUpdateError) {
      toast.error("Erro ao atualizar licao", { description: baseUpdateError.message });
      setShowCascadeDialog(false);
      setCascadePending(null);
      return;
    }

    if (doCascade) {
      const subsequent = events
        .filter(e => e.id !== eventId && new Date(e.event_date).getTime() > new Date(event.event_date).getTime() && e.linked_lesson_id)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

      if (subsequent.length > 0) {
        const newLesson = lessons.find(l => l.id === newLessonId);
        if (newLesson) {
          const allLessonsOrdered = [...lessons].sort((a, b) => {
            if (a.course_order !== b.course_order) return a.course_order - b.course_order;
            return a.order_num - b.order_num;
          });

          const newIdx = allLessonsOrdered.findIndex(l => l.id === newLessonId);
          if (newIdx >= 0) {
            for (let i = 0; i < subsequent.length; i++) {
              const nextLessonIdx = newIdx + 1 + i;
              if (nextLessonIdx < allLessonsOrdered.length) {
                const { error } = await supabase.from("events")
                  .update({ linked_lesson_id: allLessonsOrdered[nextLessonIdx].id })
                  .eq("id", subsequent[i].id);
                if (error) {
                  toast.error("Erro ao aplicar cascata", { description: error.message });
                  setShowCascadeDialog(false);
                  setCascadePending(null);
                  return;
                }
              }
            }
            toast.success(`Licoes atualizadas em ${subsequent.length + 1} eventos!`);
          }
        }
      }
    } else {
      toast.success("Licao atualizada (sem cascata)!");
    }

    setShowCascadeDialog(false);
    setCascadePending(null);
    setEditingEventId(null);
    setEditingFullEventId(null);
    fetchEvents();
  }

  async function handleCreateType() {
    if (!newTypeForm.label.trim()) return;
    setSavingType(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Generate a unique slug value
    const slug = `custom_${newTypeForm.label.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}_${Date.now()}`;

    const { data, error } = await supabase
      .from("custom_event_types")
      .insert({
        value: slug,
        label: newTypeForm.label.trim(),
        emoji: newTypeForm.emoji,
        gives_points: newTypeForm.gives_points,
        points: newTypeForm.gives_points ? newTypeForm.points : 0,
        area: currentArea || null,
        created_by: user?.id,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar tipo de evento", { description: error.message });
    } else {
      toast.success(`Tipo "${newTypeForm.label}" criado!`);
      await refetchTypes();
      // Auto-select the new type in the form
      setForm(f => ({ ...f, type: (data as any).value }));
      setShowCreateTypeModal(false);
      setNewTypeForm({ label: "", emoji: "📅", gives_points: false, points: 10 });
    }
    setSavingType(false);
  }

  async function handleDeleteCustomType(id: string, value: string) {
    if (!confirm("Excluir este tipo de evento? Eventos existentes com este tipo nao serao afetados.")) return;
    const { error } = await supabase.from("custom_event_types").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir tipo", { description: error.message });
      return;
    }
    // If the form currently uses this type, reset to "encontro"
    if (form.type === value) setForm(f => ({ ...f, type: "encontro" }));
    await refetchTypes();
    toast.success("Tipo removido");
  }

  const getLessonLabel = (lessonId: string | null) => {
    if (!lessonId) return null;
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return null;
    return `Curso ${lesson.course_order} - Licao ${lesson.order_num}: ${lesson.title}`;
  };

  const filteredEvents = leaderMode
    ? events.filter(e =>
        (e.area === currentArea) ||
        (e.turma_id && e.turma_id === profile?.turma_id)
      )
    : areaFilter === "all"
      ? events
      : events.filter(e => !e.area || e.area === areaFilter);

  const isEditing = !!editingFullEventId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-montserrat font-bold text-foreground text-base">Eventos e Encontros</p>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo evento
        </button>
      </div>

      {/* Area filter — hidden in leaderMode */}
      {!leaderMode && (
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...AREAS].map(val => (
            <button
              key={val}
              onClick={() => setAreaFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-colors ${
                areaFilter === val
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {val === "all" ? "Todas" : val}
            </button>
          ))}
        </div>
      )}

      {/* ── Create custom event type modal ── */}
      {showCreateTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in px-4"
          onClick={() => setShowCreateTypeModal(false)}>
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between"
              style={{ background: "var(--gradient-hero)" }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
                <p className="font-montserrat font-bold text-primary-foreground text-sm">Novo Tipo de Evento</p>
              </div>
              <button onClick={() => setShowCreateTypeModal(false)}
                className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <X className="w-4 h-4 text-primary-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Label */}
              <div>
                <label className="font-inter text-xs font-semibold text-muted-foreground mb-1.5 block">Nome do tipo *</label>
                <input
                  type="text"
                  value={newTypeForm.label}
                  onChange={e => setNewTypeForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ex: Visita pastoral, reuniao de lideres..."
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Emoji picker */}
              <div>
                <label className="font-inter text-xs font-semibold text-muted-foreground mb-1.5 block">Icone</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(em => (
                    <button key={em}
                      onClick={() => setNewTypeForm(f => ({ ...f, emoji: em }))}
                      className={`w-9 h-9 rounded-xl text-lg transition-all ${
                        newTypeForm.emoji === em
                          ? "bg-primary/20 ring-2 ring-primary scale-110"
                          : "bg-muted hover:bg-muted/80"
                      }`}>
                      {em}
                    </button>
                  ))}
                  {/* Custom emoji input */}
                  <input
                    type="text"
                    value={EMOJI_OPTIONS.includes(newTypeForm.emoji) ? "" : newTypeForm.emoji}
                    onChange={e => e.target.value && setNewTypeForm(f => ({ ...f, emoji: e.target.value.slice(-2) }))}
                    placeholder="ou cole"
                    className="flex-1 min-w-[70px] px-2 py-1 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary text-center"
                  />
                </div>
              </div>

              {/* Points toggle */}
              <div className="bg-muted/30 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-inter text-sm font-semibold text-foreground">Da pontuacao?</p>
                    <p className="font-inter text-[10px] text-muted-foreground mt-0.5">
                      Participar deste evento somara pontos de fe
                    </p>
                  </div>
                  <button
                    onClick={() => setNewTypeForm(f => ({ ...f, gives_points: !f.gives_points }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newTypeForm.gives_points ? "bg-brand-green" : "bg-muted-foreground/30"
                    }`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      newTypeForm.gives_points ? "left-6" : "left-1"
                    }`} />
                  </button>
                </div>

                {newTypeForm.gives_points && (
                  <div className="flex items-center gap-3">
                    <label className="font-inter text-xs text-muted-foreground whitespace-nowrap">Pontos por presenca:</label>
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => setNewTypeForm(f => ({ ...f, points: Math.max(1, f.points - 1) }))}
                        className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-foreground">
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={newTypeForm.points}
                        onChange={e => setNewTypeForm(f => ({ ...f, points: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="flex-1 px-2 py-1.5 rounded-xl border border-border bg-background text-foreground font-montserrat font-bold text-base text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={() => setNewTypeForm(f => ({ ...f, points: Math.min(100, f.points + 1) }))}
                        className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-foreground">
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Area info */}
              {currentArea && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <p className="font-inter text-xs text-primary">
                    Este tipo ficara visivel apenas para <strong>{currentArea}</strong>
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateType}
                  disabled={savingType || !newTypeForm.label.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-hero)" }}>
                  {savingType ? "Criando..." : "Criar tipo"}
                </button>
                <button
                  onClick={() => setShowCreateTypeModal(false)}
                  className="px-4 py-3 rounded-xl bg-muted text-foreground font-inter text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cascade confirmation dialog */}
      {showCascadeDialog && cascadePending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => { setShowCascadeDialog(false); setCascadePending(null); }}>
          <div className="w-full max-w-sm bg-card rounded-2xl p-5 mx-4 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <span className="text-3xl">📅</span>
              <h3 className="font-montserrat font-bold text-foreground text-base mt-2">Prorrogar estudos?</h3>
              <p className="text-muted-foreground font-inter text-xs mt-2 leading-relaxed">
                Voce mudou a licao deste encontro. Deseja que as proximas datas sejam atualizadas automaticamente com as licoes seguintes?
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => executeCascade(false)} className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm font-medium">
                So este evento
              </button>
              <button onClick={() => executeCascade(true)} className="flex-1 py-2.5 rounded-xl text-primary-foreground font-inter text-sm font-medium" style={{ background: "var(--gradient-hero)" }}>
                Prorrogar todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form (create or edit) */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {isEditing ? "Editar evento" : "Novo evento"}
          </p>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titulo do evento *"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descricao (opcional)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Local (opcional)"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Scope selector */}
          {leaderMode ? (
            <div className="space-y-1">
              <label className="font-inter text-xs font-medium text-muted-foreground">Visível para</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ...(profile?.turma_id ? [{ value: "turma" as const, label: "Minha Turma", icon: "🎓" }] : []),
                  { value: "area" as const, label: currentArea || "Minha Área", icon: "📍" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, scope: opt.value }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-medium transition-colors ${
                      form.scope === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-inter text-xs font-medium text-muted-foreground">Area</label>
                <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                  <option value="">Todas as areas</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-inter text-xs font-medium text-muted-foreground">Comunidade</label>
                <select value={form.community} onChange={e => setForm(f => ({ ...f, community: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                  <option value="">Todas</option>
                  {ALL_COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Type selector */}
          <div className="space-y-1">
            <label className="font-inter text-xs font-medium text-muted-foreground">Tipo de evento</label>
            <div className="flex gap-2">
              <select
                value={form.type}
                onChange={e => {
                  if (e.target.value === "__create_new__") {
                    setShowCreateTypeModal(true);
                  } else {
                    setForm(f => ({ ...f, type: e.target.value, linked_lesson_id: "" }));
                  }
                }}
                className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                {allTypes.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </option>
                ))}
                <option value="__create_new__">Criar novo tipo...</option>
              </select>
              <button
                onClick={() => setShowCreateTypeModal(true)}
                title="Criar novo tipo de evento"
                className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </button>
            </div>

            {/* Show point info for custom types */}
            {(() => {
              const custom = customTypes.find(t => t.value === form.type);
              if (!custom) return null;
              return (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/5 border border-brand-green/20">
                  <span className="text-xs">Pts</span>
                  <p className="font-inter text-[10px] text-brand-green font-medium">
                    {custom.gives_points
                      ? `Tipo personalizado - ${custom.points} pts por presenca`
                      : "Tipo personalizado - sem pontuacao"}
                  </p>
                </div>
              );
            })()}
          </div>

          {!leaderMode && (
            <div className="space-y-1">
              <label className="font-inter text-xs font-medium text-muted-foreground">Vincular a um estudo (opcional)</label>
              <select
                value={form.linked_lesson_id}
                onChange={e => setForm(f => ({ ...f, linked_lesson_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Sem vinculo</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id}>
                    Curso {l.course_order} - Licao {l.order_num}: {l.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.title || !form.event_date}
              className="flex-1 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}>
              {saving ? "Salvando..." : isEditing ? "Salvar alteracoes" : "Salvar evento"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingFullEventId(null); }} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
              Cancelar
            </button>
          </div>

          {/* Manage custom types */}
          {customTypes.filter(t => !t.area || t.area === currentArea).length > 0 && (
            <div className="pt-2 border-t border-border space-y-2">
              <p className="font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tipos personalizados desta area</p>
              {customTypes.filter(t => !t.area || t.area === currentArea).map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30">
                  <span className="font-inter text-xs text-foreground">{t.emoji} {t.label}{t.gives_points ? ` - ${t.points} pts` : ""}</span>
                  <button
                    onClick={() => handleDeleteCustomType(t.id, t.value)}
                    className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-inter text-sm">Carregando...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum evento encontrado</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Nenhum evento para o filtro selecionado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => {
            const dateObj = new Date(event.event_date);
            const lessonLabel = getLessonLabel(event.linked_lesson_id);
            const isEditingLesson = editingEventId === event.id;
            return (
              <div key={event.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg leading-none">{getEmoji(event.type)}</span>
                    <span className="font-montserrat font-black text-primary text-xs">{format(dateObj, "d", { locale: ptBR })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-montserrat font-bold text-foreground text-sm">{event.title}</h3>
                    <p className="text-muted-foreground font-inter text-xs mt-0.5">
                      {format(dateObj, "EEEE, d 'de' MMMM 'as' HH:mm", { locale: ptBR })}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-inter font-medium ${getColor(event.type)}`}>
                        {getLabel(event.type)}
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
                      {/* Points badge for custom types */}
                      {(() => {
                        const ct = customTypes.find(t => t.value === event.type);
                        if (!ct || !ct.gives_points) return null;
                        return (
                          <span className="flex items-center gap-0.5 text-brand-green text-[10px] font-inter font-semibold">
                            {ct.points} pts
                          </span>
                        );
                      })()}
                    </div>

                    {/* Linked lesson display / edit */}
                    {isEditingLesson ? (
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={editLessonId}
                          onChange={e => setEditLessonId(e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-[10px] focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                        >
                          <option value="">Sem vinculo</option>
                          {lessons.map(l => (
                            <option key={l.id} value={l.id}>
                              C{l.course_order} - L{l.order_num}: {l.title}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => saveEditLesson(event.id)} className="w-7 h-7 rounded-lg bg-brand-green/15 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-brand-green" />
                        </button>
                        <button onClick={() => setEditingEventId(null)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ) : lessonLabel ? (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/10">
                          <BookOpen className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                          <p className="font-inter text-[10px] text-secondary font-medium truncate">
                            {lessonLabel}
                          </p>
                        </div>
                        <button onClick={() => startEditLesson(event)} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEditLesson(event)} className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <BookOpen className="w-3 h-3 text-muted-foreground" />
                        <span className="font-inter text-[10px] text-muted-foreground">+ Vincular licao</span>
                      </button>
                    )}

                    {event.description && <p className="text-muted-foreground font-inter text-xs mt-1.5">{event.description}</p>}
                  </div>
                  {(!leaderMode || event.created_by === profile?.user_id) && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => openEditForm(event)} className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
