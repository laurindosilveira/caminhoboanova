import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, Save, Plus, Trash2, BookOpen, Heart,
  MessageCircle, Target, Pen, Play
} from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type GuideContent = {
  greeting: string;
  icebreaker: string;
  summary: string;
  bible_texts: string[];
  questions: string[];
  practice: string;
  prayer_prompt: string;
};

const EMPTY: GuideContent = {
  greeting: "",
  icebreaker: "",
  summary: "",
  bible_texts: [],
  questions: [],
  practice: "",
  prayer_prompt: "",
};

type Props = { lesson: Lesson; onBack: () => void };

export default function LeaderGuideEditor({ lesson, onBack }: Props) {
  const [content, setContent] = useState<GuideContent>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => { loadContent(); }, [lesson.id]);

  async function loadContent() {
    setLoading(true);
    const { data } = await supabase
      .from("leader_guide")
      .select("*")
      .eq("lesson_id", lesson.id)
      .maybeSingle();
    if (data) {
      setIsPublished(true);
      setContent({
        greeting: data.greeting || "",
        icebreaker: data.icebreaker || "",
        summary: data.summary || "",
        bible_texts: (data.bible_texts as string[])?.length ? (data.bible_texts as string[]) : [],
        questions: (data.questions as string[])?.length ? (data.questions as string[]) : [],
        practice: data.practice || "",
        prayer_prompt: data.prayer_prompt || "",
      });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("leader_guide").upsert({
      lesson_id: lesson.id,
      greeting: content.greeting,
      icebreaker: content.icebreaker,
      summary: content.summary,
      bible_texts: content.bible_texts.filter(t => t.trim()),
      questions: content.questions.filter(q => q.trim()),
      practice: content.practice,
      prayer_prompt: content.prayer_prompt,
    }, { onConflict: "lesson_id" });
    setSaving(false);
    setSaved(true);
    setIsPublished(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function updateArr(key: "bible_texts" | "questions", i: number, val: string) {
    setContent(prev => {
      const arr = [...prev[key]];
      arr[i] = val;
      return { ...prev, [key]: arr };
    });
  }
  function addArr(key: "bible_texts" | "questions") {
    setContent(prev => ({ ...prev, [key]: [...prev[key], ""] }));
  }
  function removeArr(key: "bible_texts" | "questions", i: number) {
    setContent(prev => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando roteiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
      </div>

      <div className="rounded-2xl p-4 bg-amber-600">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white/60 font-inter text-xs">📋 Roteiro do Líder · Lição {lesson.order_num}</p>
          {isPublished ? (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-inter font-bold">✅ Publicado</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-inter font-bold">📝 Rascunho</span>
          )}
        </div>
        <h2 className="font-montserrat font-black text-white text-lg leading-tight">{lesson.title}</h2>
        <p className="text-white/50 font-inter text-[10px] mt-2 italic">
          ⚠️ Este conteúdo é exclusivo para líderes e não afeta o conteúdo do estudo dos alunos.
        </p>
      </div>

      {/* 1. Objetivos e Foco Pedagógico */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Play className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🎯 Objetivos e Foco Pedagógico</p>
        </div>
        <div className="p-4">
          <Field label="Objetivos do encontro e orientações pedagógicas" value={content.greeting} onChange={v => setContent(p => ({ ...p, greeting: v }))} rows={6} placeholder="Descreva os objetivos do encontro e orientações para o líder..." />
        </div>
      </div>

      {/* 2. Sugestão de Tempo */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">⏱️ Sugestão de Tempo</p>
        </div>
        <div className="p-4">
          <Field label="Distribuição de tempo para cada parte do encontro" value={content.icebreaker} onChange={v => setContent(p => ({ ...p, icebreaker: v }))} rows={4} placeholder="Ex: Saudação: 5min | Quebra-gelo: 8min | Resumo: 10min..." />
        </div>
      </div>

      {/* 3. Pontos Teológicos */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">📖 Pontos Teológicos Essenciais</p>
        </div>
        <div className="p-4">
          <Field label="Pontos teológicos que devem aparecer na conversa" value={content.summary} onChange={v => setContent(p => ({ ...p, summary: v }))} rows={8} placeholder="Liste os pontos teológicos essenciais..." />
        </div>
      </div>

      {/* 4. Textos Bíblicos */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <span className="text-sm">✝️</span>
          <p className="font-montserrat font-bold text-foreground text-sm">📜 Textos Bíblicos de Apoio</p>
        </div>
        <div className="p-4 space-y-2">
          {content.bible_texts.map((text, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={text} onChange={e => updateArr("bible_texts", i, e.target.value)} placeholder="Ex: Gênesis 3.1-7"
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              {content.bible_texts.length > 1 && (
                <button onClick={() => removeArr("bible_texts", i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => addArr("bible_texts")} className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Adicionar referência
          </button>
        </div>
      </div>

      {/* 5. Orientações de Diálogo */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Pen className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">💬 Orientações para o Diálogo</p>
        </div>
        <div className="p-4 space-y-3">
          {content.questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-montserrat font-bold text-primary text-[10px] flex-shrink-0">{i + 1}</span>
                <p className="font-inter text-xs font-semibold text-muted-foreground">Orientação {i + 1}</p>
                {content.questions.length > 1 && (
                  <button onClick={() => removeArr("questions", i)} className="ml-auto p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <textarea value={q} onChange={e => updateArr("questions", i, e.target.value)} rows={2} placeholder="Orientação para conduzir o diálogo..."
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
          ))}
          <button onClick={() => addArr("questions")} className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity">
            <Plus className="w-3.5 h-3.5" /> Adicionar orientação
          </button>
        </div>
      </div>

      {/* 6. Dúvidas Frequentes + Conexão 3M */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-green" />
          <p className="font-montserrat font-bold text-foreground text-sm">❓ Dúvidas Frequentes + Conexão 3M</p>
        </div>
        <div className="p-4">
          <Field label="Dúvidas comuns e conexão com a visão discipular" value={content.practice} onChange={v => setContent(p => ({ ...p, practice: v }))} rows={6} placeholder="Liste possíveis dúvidas e como conectar com a visão 3M..." />
        </div>
      </div>

      {/* 7. Postura Espiritual */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🙏 Postura Espiritual do Líder</p>
        </div>
        <div className="p-4">
          <Field label="Orientações sobre postura e oração preparatória" value={content.prayer_prompt} onChange={v => setContent(p => ({ ...p, prayer_prompt: v }))} rows={4} placeholder="Orientações sobre postura do líder e oração preparatória..." />
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-white disabled:opacity-70 transition-opacity bg-amber-600 hover:bg-amber-700">
        <Save className="w-4 h-4" />
        {saving ? "Salvando..." : saved ? "✅ Roteiro salvo!" : "Salvar Roteiro do Líder"}
      </button>
    </div>
  );
}
