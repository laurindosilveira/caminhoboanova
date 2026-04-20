import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, Save, Plus, Trash2, BookOpen, Heart, Pen, Edit3, CalendarDays, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type Devotional = {
  id: string;
  lesson_id: string;
  day_number: number;
  title: string;
  bible_text: string;
  bible_reference: string;
  reflection: string;
  prayer: string;
  practice: string;
  questions: string[];
};

type EventRelease = {
  id: string;
  event_date: string;
  area: string | null;
  released_devotional_days: number[] | null;
  intervalDays: number | null;
};

const DAY_LABELS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Props = {
  lesson: Lesson;
  onBack: () => void;
};

export default function LessonDevotionalEditor({ lesson, onBack }: Props) {
  const { toast } = useToast();
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Devotional | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [eventReleases, setEventReleases] = useState<EventRelease[]>([]);
  const [devotionalMode, setDevotionalMode] = useState<"10_days" | "5_days">("10_days");
  const [savingMode, setSavingMode] = useState(false);

  // Form state for editing
  const [form, setForm] = useState({
    title: "",
    bible_text: "",
    bible_reference: "",
    reflection: "",
    prayer: "",
    practice: "",
    questions: [""] as string[],
  });

  useEffect(() => {
    fetchDevotionals();
    fetchEventReleases();
    fetchDevotionalMode();
  }, [lesson.id]);

  async function fetchDevotionalMode() {
    const { data } = await supabase
      .from("lessons")
      .select("devotional_mode")
      .eq("id", lesson.id)
      .maybeSingle();
    if (data) setDevotionalMode(((data as any).devotional_mode ?? "10_days") as "10_days" | "5_days");
  }

  async function saveDevotionalMode(mode: "10_days" | "5_days") {
    setSavingMode(true);
    setDevotionalMode(mode);
    await supabase.from("lessons").update({ devotional_mode: mode } as any).eq("id", lesson.id);
    setSavingMode(false);
    toast({ title: mode === "5_days" ? "Modo 5 dias ativado" : "Modo 10 dias ativado" });
  }

  async function fetchDevotionals() {
    setLoading(true);
    const { data } = await supabase
      .from("devotional_content")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("day_number");
    setDevotionals((data ?? []) as Devotional[]);
    setLoading(false);
  }

  async function fetchEventReleases() {
    const { data } = await supabase
      .from("events")
      .select("id, event_date, area, released_devotional_days")
      .eq("linked_lesson_id", lesson.id)
      .order("event_date");

    if (!data) { setEventReleases([]); return; }

    const releases: EventRelease[] = data.map((ev, i) => {
      const prev = data[i - 1];
      const intervalDays = prev
        ? Math.round(
            (new Date(ev.event_date).getTime() - new Date(prev.event_date).getTime()) / 86400000
          )
        : null;
      return {
        id: ev.id,
        event_date: ev.event_date,
        area: ev.area,
        released_devotional_days: (ev as any).released_devotional_days ?? null,
        intervalDays,
      };
    });
    setEventReleases(releases);
  }

  async function toggleDevotionalDay(eventId: string, dayNum: number) {
    const ev = eventReleases.find(e => e.id === eventId);
    if (!ev) return;

    // null = all days; expand to explicit list before toggling
    const allDays = devotionals.map(d => d.day_number);
    const current = ev.released_devotional_days ?? allDays;
    const next = current.includes(dayNum)
      ? current.filter(d => d !== dayNum)
      : [...current, dayNum].sort((a, b) => a - b);

    await supabase
      .from("events")
      .update({ released_devotional_days: next } as any)
      .eq("id", eventId);

    setEventReleases(prev =>
      prev.map(e => e.id === eventId ? { ...e, released_devotional_days: next } : e)
    );

    toast({ title: "Liberação atualizada" });
  }

  async function handleAddDay() {
    const nextDay = devotionals.length > 0
      ? Math.max(...devotionals.map(d => d.day_number)) + 1
      : 1;
    if (nextDay > 6) {
      toast({ title: "Máximo de 6 devocionais por lição", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("devotional_content").insert({
      lesson_id: lesson.id,
      day_number: nextDay,
      title: `Dia ${nextDay} — ${DAY_LABELS[nextDay] || ""}`,
      bible_text: "",
      bible_reference: "",
      reflection: "",
      prayer: "",
      practice: "",
      questions: [],
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await fetchDevotionals();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este devocional?")) return;
    await supabase.from("devotional_content").delete().eq("id", id);
    setEditing(null);
    await fetchDevotionals();
    toast({ title: "Devocional excluído" });
  }

  function openEdit(dev: Devotional) {
    setEditing(dev);
    setForm({
      title: dev.title,
      bible_text: dev.bible_text,
      bible_reference: dev.bible_reference,
      reflection: dev.reflection,
      prayer: dev.prayer,
      practice: dev.practice,
      questions: dev.questions.length > 0 ? dev.questions : [""],
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("devotional_content").update({
      title: form.title,
      bible_text: form.bible_text,
      bible_reference: form.bible_reference,
      reflection: form.reflection,
      prayer: form.prayer,
      practice: form.practice,
      questions: form.questions.filter(q => q.trim()),
    }).eq("id", editing.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    toast({ title: "Devocional salvo ✅" });
    await fetchDevotionals();
  }

  function updateQuestion(i: number, val: string) {
    setForm(prev => {
      const arr = [...prev.questions];
      arr[i] = val;
      return { ...prev, questions: arr };
    });
  }

  const Field = ({ label, value, onChange, rows = 3, placeholder = "" }: {
    label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
  }) => (
    <div>
      <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-brand-green" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando devocionais...</p>
      </div>
    );
  }

  // Editing a specific devotional
  if (editing) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
          <p className="text-primary-foreground/60 font-inter text-xs mb-1">
            📖 Devocional · Dia {editing.day_number} · Lição {lesson.order_num}
          </p>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg">{lesson.title}</h2>
        </div>

        {/* Title */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Título do devocional</p>
          <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ex: Dia 1 — A graça de Deus"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {/* Bible */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">✝️</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Texto Bíblico</p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Referência</p>
              <input type="text" value={form.bible_reference}
                onChange={e => setForm(p => ({ ...p, bible_reference: e.target.value }))}
                placeholder="Ex: João 3:16"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <Field label="Texto bíblico completo" value={form.bible_text}
              onChange={v => setForm(p => ({ ...p, bible_text: v }))} rows={5}
              placeholder="Cole aqui o texto bíblico..." />
          </div>
        </div>

        {/* Reflection */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-green" />
            <p className="font-montserrat font-bold text-foreground text-sm">📖 Reflexão</p>
          </div>
          <div className="p-4">
            <Field label="Reflexão sobre o texto" value={form.reflection}
              onChange={v => setForm(p => ({ ...p, reflection: v }))} rows={5}
              placeholder="Escreva uma reflexão pastoral..." />
          </div>
        </div>

        {/* Questions */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">💬 Perguntas</p>
          </div>
          <div className="p-4 space-y-3">
            {form.questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-montserrat font-bold text-primary text-[10px] flex-shrink-0 mt-2">{i + 1}</span>
                <textarea value={q} onChange={e => updateQuestion(i, e.target.value)} rows={2}
                  placeholder={`Pergunta ${i + 1}...`}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                {form.questions.length > 1 && (
                  <button onClick={() => setForm(p => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }))}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setForm(p => ({ ...p, questions: [...p.questions, ""] }))}
              className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar pergunta
            </button>
          </div>
        </div>

        {/* Practice */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">🧭</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Prática do Dia</p>
          </div>
          <div className="p-4">
            <Field label="Desafio prático" value={form.practice}
              onChange={v => setForm(p => ({ ...p, practice: v }))} rows={3}
              placeholder="Ex: Hoje, leia o texto em voz alta e medite por 5 minutos..." />
          </div>
        </div>

        {/* Prayer */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">🙏 Oração</p>
          </div>
          <div className="p-4">
            <Field label="Orientação para oração" value={form.prayer}
              onChange={v => setForm(p => ({ ...p, prayer: v }))} rows={3}
              placeholder="Ex: Ore ao Senhor usando as palavras do texto..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70"
            style={{ background: "var(--gradient-hero)" }}>
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : saved ? "✅ Salvo!" : "Salvar"}
          </button>
          <button onClick={() => handleDelete(editing.id)}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-destructive text-destructive font-inter text-sm font-medium hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        </div>
      </div>
    );
  }

  // List view: all devotionals for this lesson
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar à lição
      </button>

      <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-primary-foreground/60 font-inter text-xs mb-1">Devocionais da semana · Lição {lesson.order_num}</p>
        <h2 className="font-montserrat font-black text-primary-foreground text-lg">{lesson.title}</h2>
        <p className="text-primary-foreground/70 font-inter text-xs mt-1">
          {devotionals.length} devocional(is) · Dias de preparação antes do encontro
        </p>
      </div>

      {/* Window mode toggle */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">Janela de Devocionais</p>
          {savingMode && <span className="text-xs text-muted-foreground font-inter ml-auto">Salvando...</span>}
        </div>
        <div className="p-4 space-y-3">
          <p className="font-inter text-xs text-muted-foreground">
            Define quantos dias de devocionais serão liberados antes do encontro presencial.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => devotionalMode !== "10_days" && saveDevotionalMode("10_days")}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors ${
                devotionalMode === "10_days"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <span className="font-montserrat font-bold text-base">10 dias</span>
              <span className="font-inter text-[10px] text-center leading-tight">
                Até 10 devocionais, um por dia útil (padrão)
              </span>
            </button>
            <button
              onClick={() => devotionalMode !== "5_days" && saveDevotionalMode("5_days")}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors ${
                devotionalMode === "5_days"
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/30"
              }`}
            >
              <span className="font-montserrat font-bold text-base">5 dias</span>
              <span className="font-inter text-[10px] text-center leading-tight">
                5 devocionais na 1ª semana + recuperação na 2ª semana
              </span>
            </button>
          </div>
          {devotionalMode === "5_days" && (
            <div className="rounded-xl bg-brand-green/5 border border-brand-green/20 p-3 space-y-1">
              <p className="font-inter text-[10px] font-semibold text-brand-green">Como funciona o modo 5 dias:</p>
              <ul className="font-inter text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Os 5 primeiros devocionais são liberados na 1ª semana (dias 1–5)</li>
                <li>Se não fizer no dia certo, pode recuperar na 2ª semana (dias 6–10)</li>
                <li>Na recuperação, apenas 1 por dia — se perder o dia, fica bloqueado</li>
                <li>Devocionais feitos na recuperação valem menos pontos</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {devotionals.map((dev) => (
          <button key={dev.id} onClick={() => openEdit(dev)}
            className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm text-left hover:bg-muted/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
              <span className="font-montserrat font-bold text-brand-green text-sm">{dev.day_number}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-montserrat font-bold text-foreground text-sm">{dev.title || `Dia ${dev.day_number}`}</p>
              <p className="text-muted-foreground font-inter text-[10px] truncate">
                {dev.bible_reference ? `✝️ ${dev.bible_reference}` : "Sem texto bíblico"}
                {dev.reflection ? " · 📖 Reflexão" : ""}
              </p>
            </div>
            <Edit3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Add button */}
      {devotionals.length < 6 && (
        <button onClick={handleAddDay}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-brand-green/40 text-brand-green font-inter text-sm font-medium hover:bg-brand-green/5 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar Dia {devotionals.length + 1}
        </button>
      )}

      {devotionals.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="font-montserrat font-bold text-foreground text-sm">Nenhum devocional</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Adicione devocionais para os dias da semana antes do encontro.</p>
        </div>
      )}

      {/* ── Release config per event ── */}
      {eventReleases.length > 0 && devotionals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Liberação por Encontro</p>
          </div>
          <div className="divide-y divide-border">
            {eventReleases.map(ev => {
              const isAutoLimited = ev.intervalDays !== null && ev.intervalDays < 10;
              // All day_numbers in this lesson
              const allDays = devotionals.map(d => d.day_number);
              // Effective released days (null = all)
              const released = ev.released_devotional_days ?? allDays;

              return (
                <div key={ev.id} className="p-4 space-y-3">
                  {/* Event header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-inter text-xs font-semibold text-foreground">
                        {ev.area ?? "Sem área"} · {format(new Date(ev.event_date), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {ev.intervalDays !== null && (
                        <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
                          Intervalo desde encontro anterior: {ev.intervalDays} dias
                        </p>
                      )}
                    </div>
                    {isAutoLimited && (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5 text-[10px] font-inter font-semibold whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" /> Máx 5 auto
                      </span>
                    )}
                  </div>

                  {/* Devotional day checkboxes */}
                  <div className="flex flex-wrap gap-2">
                    {devotionals.map(dev => {
                      const isBlocked = isAutoLimited && dev.day_number > 5;
                      const isChecked = released.includes(dev.day_number);

                      return (
                        <button
                          key={dev.day_number}
                          disabled={isBlocked}
                          onClick={() => !isBlocked && toggleDevotionalDay(ev.id, dev.day_number)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-inter font-medium transition-colors ${
                            isBlocked
                              ? "border-border bg-muted/40 text-muted-foreground opacity-50 cursor-not-allowed"
                              : isChecked
                              ? "border-brand-green bg-brand-green/10 text-brand-green"
                              : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            isBlocked ? "border-muted-foreground/40" :
                            isChecked ? "border-brand-green bg-brand-green" : "border-muted-foreground"
                          }`}>
                            {isChecked && !isBlocked && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          Dia {dev.day_number}
                          {isBlocked && " 🔒"}
                        </button>
                      );
                    })}
                  </div>

                  {isAutoLimited && (
                    <p className="text-amber-600/80 font-inter text-[10px]">
                      Intervalo curto — dias 6+ bloqueados automaticamente. Ajuste a data do encontro para liberar mais devocionais.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {eventReleases.length === 0 && devotionals.length > 0 && (
        <div className="bg-muted/30 rounded-2xl border border-dashed border-border p-4 text-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="font-inter text-xs text-muted-foreground">
            Nenhum encontro agendado para esta lição. Adicione um evento Confirmatório vinculado a esta lição na aba Agenda para configurar a liberação dos devocionais.
          </p>
        </div>
      )}
    </div>
  );
}
