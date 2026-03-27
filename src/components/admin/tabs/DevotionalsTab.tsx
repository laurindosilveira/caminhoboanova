import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, Save, Plus, Trash2, BookOpen, Heart,
  Pen, GripVertical, Edit2, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Activity = {
  id: string; type: string; title: string; subtitle: string | null; order_num: number; points: number;
};

type DevotionalContent = {
  bible_text: string;
  bible_reference: string;
  reflection: string;
  prayer: string;
  practice: string;
  questions: string[];
};

const DEFAULT_CONTENT: DevotionalContent = {
  bible_text: "",
  bible_reference: "",
  reflection: "",
  prayer: "",
  practice: "",
  questions: [""],
};

export default function DevotionalsTab() {
  const { toast } = useToast();
  const [devotionals, setDevotionals] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [content, setContent] = useState<DevotionalContent>(DEFAULT_CONTENT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // New devotional form
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Edit title/subtitle
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editPoints, setEditPoints] = useState(10);

  useEffect(() => { fetchDevotionals(); }, []);

  async function fetchDevotionals() {
    setLoading(true);
    const { data } = await supabase
      .from("activities")
      .select("*")
      .eq("type", "devocional")
      .order("order_num");
    setDevotionals(data ?? []);
    setLoading(false);
  }

  async function handleCreateNew() {
    if (!newTitle.trim()) return;
    setSavingNew(true);
    const maxOrder = devotionals.length > 0 ? Math.max(...devotionals.map(d => d.order_num)) : 0;
    const { error } = await supabase.from("activities").insert({
      type: "devocional",
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || null,
      order_num: maxOrder + 1,
      points: 10,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Devocional criado ✅" });
      setNewTitle("");
      setNewSubtitle("");
      setShowNew(false);
      await fetchDevotionals();
    }
    setSavingNew(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este devocional?")) return;
    await supabase.from("devotional_content").delete().eq("activity_id", id);
    await supabase.from("activities").delete().eq("id", id);
    toast({ title: "Devocional excluído" });
    setEditing(null);
    setEditingContent(false);
    await fetchDevotionals();
  }

  async function handleSaveDetails() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("activities").update({
      title: editTitle,
      subtitle: editSubtitle || null,
      points: editPoints,
    }).eq("id", editing.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast({ title: "Devocional atualizado ✅" });
    await fetchDevotionals();
  }

  function openEdit(dev: Activity) {
    setEditing(dev);
    setEditTitle(dev.title);
    setEditSubtitle(dev.subtitle ?? "");
    setEditPoints(dev.points);
    setEditingContent(false);
  }

  async function openContentEditor(dev: Activity) {
    setEditing(dev);
    setEditingContent(true);
    const { data } = await supabase
      .from("devotional_content")
      .select("*")
      .eq("activity_id", dev.id)
      .maybeSingle();
    if (data) {
      setIsPublished(true);
      setContent({
        bible_text: data.bible_text || "",
        bible_reference: data.bible_reference || "",
        reflection: data.reflection || "",
        prayer: data.prayer || "",
        practice: data.practice || "",
        questions: (data.questions as string[])?.length ? data.questions as string[] : [""],
      });
    } else {
      setIsPublished(false);
      setContent({ ...DEFAULT_CONTENT, questions: [""] });
    }
  }

  async function handleSaveContent() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("devotional_content").upsert({
      activity_id: editing.id,
      bible_text: content.bible_text,
      bible_reference: content.bible_reference,
      reflection: content.reflection,
      prayer: content.prayer,
      practice: content.practice,
      questions: content.questions.filter(q => q.trim()),
    }, { onConflict: "activity_id" });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conteúdo salvo ✅" });
      setIsPublished(true);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function updateQuestion(i: number, val: string) {
    setContent(prev => {
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
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-16 animate-pulse" />)}</div>;
  }

  // Content editor view
  if (editing && editingContent) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditingContent(false)} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-primary-foreground/60 font-inter text-xs">Editando conteúdo · 📖 Devocional</p>
            {isPublished ? (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-primary-foreground text-[10px] font-inter font-bold">✅ Publicado</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-primary-foreground/60 text-[10px] font-inter font-bold">📝 Rascunho</span>
            )}
          </div>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg">{editing.title}</h2>
        </div>

        {/* Bible reference */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">✝️</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Texto Bíblico</p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Referência (ex: João 3:16)</p>
              <input type="text" value={content.bible_reference}
                onChange={e => setContent(p => ({ ...p, bible_reference: e.target.value }))}
                placeholder="Ex: Salmos 23:1-6"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <Field label="Texto bíblico completo" value={content.bible_text}
              onChange={v => setContent(p => ({ ...p, bible_text: v }))} rows={5}
              placeholder="Cole aqui o texto bíblico completo para o devocional..." />
          </div>
        </div>

        {/* Reflection */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-green" />
            <p className="font-montserrat font-bold text-foreground text-sm">📖 Reflexão</p>
          </div>
          <div className="p-4">
            <Field label="Reflexão sobre o texto" value={content.reflection}
              onChange={v => setContent(p => ({ ...p, reflection: v }))} rows={5}
              placeholder="Escreva uma reflexão pastoral sobre o texto bíblico..." />
          </div>
        </div>

        {/* Questions */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">💬 Perguntas para Reflexão</p>
          </div>
          <div className="p-4 space-y-3">
            {content.questions.map((q, i) => (
              <div key={i} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-montserrat font-bold text-primary text-[10px] flex-shrink-0 mt-2">{i + 1}</span>
                <textarea value={q} onChange={e => updateQuestion(i, e.target.value)} rows={2}
                  placeholder={`Pergunta ${i + 1}...`}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                {content.questions.length > 1 && (
                  <button onClick={() => setContent(p => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }))}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors mt-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setContent(p => ({ ...p, questions: [...p.questions, ""] }))}
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
            <Field label="Desafio prático" value={content.practice}
              onChange={v => setContent(p => ({ ...p, practice: v }))} rows={3}
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
            <Field label="Orientação para oração" value={content.prayer}
              onChange={v => setContent(p => ({ ...p, prayer: v }))} rows={3}
              placeholder="Ex: Ore ao Senhor usando as palavras do Salmo que você leu..." />
          </div>
        </div>

        <button onClick={handleSaveContent} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70"
          style={{ background: "var(--gradient-hero)" }}>
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : saved ? "✅ Salvo!" : "Salvar conteúdo do devocional"}
        </button>
      </div>
    );
  }

  // Edit details view
  if (editing && !editingContent) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
          <p className="text-primary-foreground/60 font-inter text-xs mb-1">Editando devocional</p>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg">{editing.title}</h2>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div>
            <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Título</p>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Subtítulo (opcional)</p>
            <input type="text" value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)}
              placeholder="Breve descrição..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <p className="font-inter text-xs font-semibold text-muted-foreground mb-1.5">Pontos</p>
            <input type="number" value={editPoints} onChange={e => setEditPoints(Number(e.target.value))}
              className="w-24 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleSaveDetails} disabled={saving}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-inter text-sm font-medium">
            <Save className="w-4 h-4" /> {saving ? "..." : saved ? "✅" : "Salvar"}
          </button>
          <button onClick={() => openContentEditor(editing)}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-green text-primary-foreground font-inter text-sm font-medium">
            <Edit2 className="w-4 h-4" /> Editar conteúdo
          </button>
        </div>

        <button onClick={() => handleDelete(editing.id)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-destructive text-destructive font-inter text-sm font-medium hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-4 h-4" /> Excluir devocional
        </button>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-brand-green" />
        </div>
        <div className="flex-1">
          <h2 className="font-montserrat font-black text-foreground text-lg">📖 Devocionais</h2>
          <p className="text-muted-foreground text-xs font-inter">{devotionals.length} devocional(is) cadastrado(s)</p>
        </div>
        <button onClick={() => setShowNew(!showNew)}
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showNew && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="font-montserrat font-bold text-foreground text-sm">Novo Devocional</p>
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Título do devocional"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="text" value={newSubtitle} onChange={e => setNewSubtitle(e.target.value)}
            placeholder="Subtítulo (opcional)"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={handleCreateNew} disabled={savingNew || !newTitle.trim()}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-inter text-sm font-medium disabled:opacity-50">
            {savingNew ? "Criando..." : "Criar Devocional"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {devotionals.map((dev, i) => (
          <div key={dev.id} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            <button onClick={() => openEdit(dev)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📖</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-montserrat font-bold text-foreground text-sm">{dev.title}</p>
                {dev.subtitle && <p className="text-muted-foreground font-inter text-xs truncate">{dev.subtitle}</p>}
                <p className="text-muted-foreground font-inter text-[10px]">Ordem: {dev.order_num} · {dev.points} pts</p>
              </div>
              <Edit2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          </div>
        ))}
      </div>

      {devotionals.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum devocional</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Clique no + para criar o primeiro.</p>
        </div>
      )}
    </div>
  );
}
