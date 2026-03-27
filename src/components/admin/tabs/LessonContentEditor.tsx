import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, Save, Plus, Trash2, BookOpen, Heart,
  MessageCircle, Target, Pen, Play, Volume2, Link2, FileText
} from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type LessonContent = {
  greeting: string;
  icebreaker: string;
  summary: string;
  bible_texts: string[];
  questions: string[];
  practice: string;
  prayer_prompt: string;
  video_link: string;
  audio_link: string;
  pdf_link: string;
};

function getDefaultContent(lessonNum: number): LessonContent {
  return {
    greeting: `Bem-vindo à lição ${lessonNum}! Que este tempo seja de crescimento e encontro com Deus.`,
    icebreaker: "Pergunta inicial: O que você mais aprendeu na lição anterior?",
    summary: "Conteúdo desta lição em preparação pelo seu pastor. Fique atento às próximas atualizações!",
    bible_texts: ["Salmos 119:105", "2 Timóteo 3:16-17"],
    questions: [
      "Como você está aplicando o que aprendeu na última lição?",
      "O que mais te desafia na sua caminhada com Deus?",
      "Que oração você tem feito ultimamente?",
    ],
    practice: "Esta semana: Aplique algo aprendido nesta lição em uma situação real do seu dia a dia.",
    prayer_prompt: "Escreva uma oração sobre o que você aprendeu hoje e como deseja crescer.",
    video_link: "",
    audio_link: "",
    pdf_link: "",
  };
}

type Props = {
  lesson: Lesson;
  onBack: () => void;
};

export default function LessonContentEditor({ lesson, onBack }: Props) {
  const defaults = getDefaultContent(lesson.order_num);
  const [content, setContent] = useState<LessonContent>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    loadContent();
  }, [lesson.id]);

  async function loadContent() {
    setLoading(true);
    const { data } = await supabase
      .from("lesson_content")
      .select("*")
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    if (data) {
      setIsPublished(true);
      setContent({
        greeting: data.greeting || defaults.greeting,
        icebreaker: data.icebreaker || defaults.icebreaker,
        summary: data.summary || defaults.summary,
        bible_texts: data.bible_texts?.length ? data.bible_texts : defaults.bible_texts,
        questions: data.questions?.length ? data.questions : defaults.questions,
        practice: data.practice || defaults.practice,
        prayer_prompt: data.prayer_prompt || defaults.prayer_prompt,
        video_link: data.video_link ?? "",
        audio_link: data.audio_link ?? "",
        pdf_link: (data as any).pdf_link ?? "",
      });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("lesson_content").upsert({
      lesson_id: lesson.id,
      greeting: content.greeting,
      icebreaker: content.icebreaker,
      summary: content.summary,
      bible_texts: content.bible_texts.filter(t => t.trim()),
      questions: content.questions.filter(q => q.trim()),
      practice: content.practice,
      prayer_prompt: content.prayer_prompt,
      video_link: content.video_link,
      audio_link: content.audio_link,
      pdf_link: content.pdf_link,
    }, { onConflict: "lesson_id" });
    setSaving(false);
    setSaved(true);
    setIsPublished(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function updateBibleText(i: number, val: string) {
    setContent(prev => {
      const arr = [...prev.bible_texts];
      arr[i] = val;
      return { ...prev, bible_texts: arr };
    });
  }

  function addBibleText() {
    setContent(prev => ({ ...prev, bible_texts: [...prev.bible_texts, ""] }));
  }

  function removeBibleText(i: number) {
    setContent(prev => ({ ...prev, bible_texts: prev.bible_texts.filter((_, idx) => idx !== i) }));
  }

  function updateQuestion(i: number, val: string) {
    setContent(prev => {
      const arr = [...prev.questions];
      arr[i] = val;
      return { ...prev, questions: arr };
    });
  }

  function addQuestion() {
    setContent(prev => ({ ...prev, questions: [...prev.questions, ""] }));
  }

  function removeQuestion(i: number) {
    setContent(prev => ({ ...prev, questions: prev.questions.filter((_, idx) => idx !== i) }));
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
        <p className="text-muted-foreground font-inter text-sm">Carregando conteúdo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-primary-foreground/60 font-inter text-xs">Editando conteúdo · Lição {lesson.order_num}</p>
          {isPublished ? (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-primary-foreground text-[10px] font-inter font-bold">✅ Publicado</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-primary-foreground/60 text-[10px] font-inter font-bold">📝 Rascunho</span>
          )}
        </div>
        <h2 className="font-montserrat font-black text-primary-foreground text-lg leading-tight">{lesson.title}</h2>
        {lesson.objective && (
          <p className="text-primary-foreground/70 font-inter text-xs mt-1">{lesson.objective}</p>
        )}
        {!isPublished && (
          <p className="text-primary-foreground/50 font-inter text-[10px] mt-2 italic">
            ⚠️ Este conteúdo usa valores padrão. Edite e salve para publicar.
          </p>
        )}
      </div>

      {/* 1. Saudação */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">👋 Saudação do Líder</p>
        </div>
        <div className="p-4">
          <Field
            label="Texto de saudação"
            value={content.greeting}
            onChange={v => setContent(p => ({ ...p, greeting: v }))}
            rows={3}
            placeholder="Escreva uma saudação calorosa para o jovem ao começar esta lição..."
          />
        </div>
      </div>

      {/* 2. Quebra-gelo */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🔗 Quebra-gelo</p>
        </div>
        <div className="p-4">
          <Field
            label="Pergunta ou atividade de quebra-gelo"
            value={content.icebreaker}
            onChange={v => setContent(p => ({ ...p, icebreaker: v }))}
            rows={2}
            placeholder="Ex: Se você pudesse descrever sua fé em uma palavra, qual seria?"
          />
        </div>
      </div>

      {/* 3. Vídeo e Áudio */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🎥 Episódio / Mídia</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="font-inter text-xs font-semibold text-muted-foreground">Link do vídeo (YouTube ou outro)</p>
            </div>
            <input
              type="url"
              value={content.video_link}
              onChange={e => setContent(p => ({ ...p, video_link: e.target.value }))}
              placeholder="https://youtube.com/..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="font-inter text-xs font-semibold text-muted-foreground">Link do áudio / podcast</p>
            </div>
            <input
              type="url"
              value={content.audio_link}
              onChange={e => setContent(p => ({ ...p, audio_link: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="font-inter text-xs font-semibold text-muted-foreground">Link da apostila / PDF (Google Drive)</p>
            </div>
            <input
              type="url"
              value={content.pdf_link}
              onChange={e => setContent(p => ({ ...p, pdf_link: e.target.value }))}
              placeholder="https://drive.google.com/..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 4. Resumo */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">📝 Resumo do Conteúdo</p>
        </div>
        <div className="p-4">
          <Field
            label="Texto explicativo da lição"
            value={content.summary}
            onChange={v => setContent(p => ({ ...p, summary: v }))}
            rows={5}
            placeholder="Descreva o conteúdo central desta lição de forma clara e formativa..."
          />
        </div>
      </div>

      {/* 5. Textos Bíblicos */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <span className="text-sm">✝️</span>
          <p className="font-montserrat font-bold text-foreground text-sm">📖 Textos Bíblicos</p>
        </div>
        <div className="p-4 space-y-2">
          {content.bible_texts.map((text, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => updateBibleText(i, e.target.value)}
                placeholder="Ex: João 3:16"
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {content.bible_texts.length > 1 && (
                <button onClick={() => removeBibleText(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addBibleText}
            className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar referência bíblica
          </button>
        </div>
      </div>

      {/* 6. Perguntas */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Pen className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">💬 Perguntas para Diálogo</p>
        </div>
        <div className="p-4 space-y-3">
          {content.questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-montserrat font-bold text-primary text-[10px] flex-shrink-0">{i + 1}</span>
                <p className="font-inter text-xs font-semibold text-muted-foreground">Pergunta {i + 1}</p>
                {content.questions.length > 1 && (
                  <button onClick={() => removeQuestion(i)} className="ml-auto p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <textarea
                value={q}
                onChange={e => updateQuestion(i, e.target.value)}
                rows={2}
                placeholder={`Pergunta reflexiva ${i + 1}...`}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          ))}
          <button
            onClick={addQuestion}
            className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar pergunta
          </button>
        </div>
      </div>

      {/* 7. Prática */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Target className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🧭 Prática da Semana</p>
        </div>
        <div className="p-4">
          <Field
            label="Desafio prático para a semana"
            value={content.practice}
            onChange={v => setContent(p => ({ ...p, practice: v }))}
            rows={3}
            placeholder="Ex: Esta semana, reserve 5 minutos diários para orar..."
          />
        </div>
      </div>

      {/* 8. Oração */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🙏 Oração Final</p>
        </div>
        <div className="p-4">
          <Field
            label="Orientação para a oração final"
            value={content.prayer_prompt}
            onChange={v => setContent(p => ({ ...p, prayer_prompt: v }))}
            rows={3}
            placeholder="Ex: Escreva uma oração pessoal expressando onde você está espiritualmente..."
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70 transition-opacity"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Save className="w-4 h-4" />
        {saving ? "Salvando..." : saved ? "✅ Conteúdo salvo!" : "Salvar conteúdo da lição"}
      </button>
    </div>
  );
}
