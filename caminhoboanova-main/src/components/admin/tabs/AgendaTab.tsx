import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { CalendarDays, Plus, X, MapPin, Users, BookOpen, Pencil, Check } from "lucide-react";
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
};

type LessonOption = {
  id: string;
  title: string;
  order_num: number;
  course_title: string;
  course_order: number;
  course_id: string;
};

const EVENT_TYPES = [
  { value: "encontro", label: "Encontro", color: "bg-primary/10 text-primary" },
  { value: "culto", label: "Culto", color: "bg-brand-green/10 text-brand-green" },
  { value: "jemiac", label: "JEMIAC", color: "bg-secondary/10 text-secondary" },
  { value: "retiro", label: "Retiro", color: "bg-secondary/10 text-secondary" },
  { value: "confirmatorio", label: "Ens. Confirmatório", color: "bg-primary/10 text-primary" },
  { value: "evento", label: "Evento", color: "bg-accent/20 text-accent-foreground" },
];

const TYPE_EMOJI: Record<string, string> = {
  encontro: "📅", culto: "⛪", jemiac: "✝️", retiro: "🏕️", confirmatorio: "📖", evento: "🎉",
};

const EMPTY_FORM = {
  title: "", description: "", event_date: "", location: "", type: "encontro", area: "", community: "", linked_lesson_id: "",
};

export default function AgendaTab() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
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

  useEffect(() => { fetchEvents(); fetchLessons(); }, []);

  async function fetchEvents() {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date");
    setEvents((data ?? []) as Event[]);
    setLoading(false);
  }

  async function fetchLessons() {
    const [{ data: coursesData }, { data: lessonsData }] = await Promise.all([
      supabase.from("courses").select("id, title, order_num").order("order_num"),
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
    ]);
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
    setForm({ ...EMPTY_FORM, area: currentArea });
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
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title || !form.event_date) return;
    setSaving(true);

    // Append Brazil timezone offset so Supabase stores the correct local time
    const eventDateWithTz = form.event_date ? form.event_date + ":00-03:00" : form.event_date;

    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: eventDateWithTz,
      location: form.location || null,
      type: form.type,
      area: form.area || null,
      community: form.community || null,
      linked_lesson_id: form.linked_lesson_id || null,
    };

    if (editingFullEventId) {
      // Editing existing event
      const oldEvent = events.find(e => e.id === editingFullEventId);
      const oldLessonId = oldEvent?.linked_lesson_id ?? null;
      const newLessonId = payload.linked_lesson_id;

      // Check cascade for lesson change
      if (oldLessonId !== newLessonId && newLessonId && oldEvent) {
        const subsequentWithLessons = events.filter(
          e => e.id !== editingFullEventId && e.event_date > oldEvent.event_date && e.linked_lesson_id
        );
        if (subsequentWithLessons.length > 0) {
          // Save other fields first, then handle cascade
          await supabase.from("events").update({ ...payload, linked_lesson_id: oldLessonId }).eq("id", editingFullEventId);
          setCascadePending({ eventId: editingFullEventId, oldLessonId, newLessonId });
          setShowCascadeDialog(true);
          setShowForm(false);
          setEditingFullEventId(null);
          setSaving(false);
          return;
        }
      }

      await supabase.from("events").update(payload).eq("id", editingFullEventId);
      toast.success("Evento atualizado!");
    } else {
      // Creating new event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("events").insert({ ...payload, created_by: user?.id });
      toast.success("Evento criado!");
    }

    setForm({ ...EMPTY_FORM });
    setShowForm(false);
    setEditingFullEventId(null);
    setSaving(false);
    fetchEvents();
  }

  async function handleDelete(id: string) {
    await supabase.from("events").delete().eq("id", id);
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
        e => e.id !== eventId && e.event_date > event.event_date && e.linked_lesson_id
      );
      if (subsequentWithLessons.length > 0) {
        setCascadePending({ eventId, oldLessonId, newLessonId });
        setShowCascadeDialog(true);
        return;
      }
    }

    await supabase.from("events").update({ linked_lesson_id: newLessonId }).eq("id", eventId);
    setEditingEventId(null);
    toast.success("Lição atualizada!");
    fetchEvents();
  }

  async function executeCascade(doCascade: boolean) {
    if (!cascadePending) return;
    const { eventId, oldLessonId, newLessonId } = cascadePending;
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    await supabase.from("events").update({ linked_lesson_id: newLessonId }).eq("id", eventId);

    if (doCascade) {
      const subsequent = events
        .filter(e => e.id !== eventId && e.event_date > event.event_date && e.linked_lesson_id)
        .sort((a, b) => a.event_date.localeCompare(b.event_date));

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
                await supabase.from("events")
                  .update({ linked_lesson_id: allLessonsOrdered[nextLessonIdx].id })
                  .eq("id", subsequent[i].id);
              }
            }
            toast.success(`Lições atualizadas em ${subsequent.length + 1} eventos!`);
          }
        }
      }
    } else {
      toast.success("Lição atualizada (sem cascata)!");
    }

    setShowCascadeDialog(false);
    setCascadePending(null);
    setEditingEventId(null);
    setEditingFullEventId(null);
    fetchEvents();
  }

  const getLessonLabel = (lessonId: string | null) => {
    if (!lessonId) return null;
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return null;
    return `Curso ${lesson.course_order} — Lição ${lesson.order_num}: ${lesson.title}`;
  };

  const filteredEvents = areaFilter === "all"
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

      {/* Area filter */}
      <div className="flex gap-1.5">
        {["all", "Área 1", "Área 2"].map(val => (
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

      {/* Cascade confirmation dialog */}
      {showCascadeDialog && cascadePending && (
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
      )}

      {/* Form (create or edit) */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {isEditing ? "✏️ Editar evento" : "Novo evento"}
          </p>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Título do evento *"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrição (opcional)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="grid grid-cols-2 gap-2">
            <input type="datetime-local" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Local (opcional)"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Area selector */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="font-inter text-xs font-medium text-muted-foreground">📍 Área</label>
              <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                <option value="">Todas as áreas</option>
                <option value="Área 1">Área 1</option>
                <option value="Área 2">Área 2</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-inter text-xs font-medium text-muted-foreground">⛪ Comunidade</label>
              <select value={form.community} onChange={e => setForm(f => ({ ...f, community: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                <option value="">Todas</option>
                <option value="Martim Lutero">Martim Lutero</option>
                <option value="Bom Pastor">Bom Pastor</option>
                <option value="Rincão Fundo">Rincão Fundo</option>
                <option value="Rincão Frente">Rincão Frente</option>
                <option value="Linha Brasil">Linha Brasil</option>
                <option value="Iriá Pira 1">Iriá Pira 1</option>
                <option value="Iriá Pira 2">Iriá Pira 2</option>
              </select>
            </div>
          </div>

          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, linked_lesson_id: "" }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <div className="space-y-1">
            <label className="font-inter text-xs font-medium text-muted-foreground">📖 Vincular a um estudo (opcional)</label>
            <select
              value={form.linked_lesson_id}
              onChange={e => setForm(f => ({ ...f, linked_lesson_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">Sem vínculo</option>
              {lessons.map(l => (
                <option key={l.id} value={l.id}>
                  Curso {l.course_order} — Lição {l.order_num}: {l.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.title || !form.event_date}
              className="flex-1 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Salvar evento"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingFullEventId(null); }} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
              Cancelar
            </button>
          </div>
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
            const typeInfo = EVENT_TYPES.find(t => t.value === event.type);
            const dateObj = new Date(event.event_date);
            const lessonLabel = getLessonLabel(event.linked_lesson_id);
            const isEditingLesson = editingEventId === event.id;
            return (
              <div key={event.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg leading-none">{TYPE_EMOJI[event.type] ?? "📅"}</span>
                    <span className="font-montserrat font-black text-primary text-xs">{format(dateObj, "d", { locale: ptBR })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-montserrat font-bold text-foreground text-sm">{event.title}</h3>
                    <p className="text-muted-foreground font-inter text-xs mt-0.5">
                      {format(dateObj, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {typeInfo && <span className={`px-2 py-0.5 rounded-md text-[10px] font-inter font-medium ${typeInfo.color}`}>{typeInfo.label}</span>}
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

                    {/* Linked lesson display / edit */}
                    {isEditingLesson ? (
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={editLessonId}
                          onChange={e => setEditLessonId(e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-[10px] focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                        >
                          <option value="">Sem vínculo</option>
                          {lessons.map(l => (
                            <option key={l.id} value={l.id}>
                              C{l.course_order} — L{l.order_num}: {l.title}
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
                            📖 {lessonLabel}
                          </p>
                        </div>
                        <button onClick={() => startEditLesson(event)} className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors">
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEditLesson(event)} className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <BookOpen className="w-3 h-3 text-muted-foreground" />
                        <span className="font-inter text-[10px] text-muted-foreground">+ Vincular lição</span>
                      </button>
                    )}

                    {event.description && <p className="text-muted-foreground font-inter text-xs mt-1.5">{event.description}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openEditForm(event)} className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <Pencil className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button onClick={() => handleDelete(event.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
