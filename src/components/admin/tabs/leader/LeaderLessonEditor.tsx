import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronLeft, Save, Plus, Trash2, BookOpen, Heart,
  MessageCircle, Target, Pen, Play, Volume2, Link2, FileText, Globe, Pencil, RotateCcw
} from "lucide-react";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type ContentFields = {
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

// Fields that the leader can individually toggle to override
type OverrideFlags = {
  greeting: boolean;
  icebreaker: boolean;
  summary: boolean;
  bible_texts: boolean;
  questions: boolean;
  practice: boolean;
  prayer_prompt: boolean;
  video_link: boolean;
  audio_link: boolean;
  pdf_link: boolean;
};

function emptyContent(): ContentFields {
  return {
    greeting: "", icebreaker: "", summary: "",
    bible_texts: [], questions: [],
    practice: "", prayer_prompt: "",
    video_link: "", audio_link: "", pdf_link: "",
  };
}

type Props = {
  lesson: Lesson;
  onBack: () => void;
};

export default function LeaderLessonEditor({ lesson, onBack }: Props) {
  const { profile } = useAuth();

  const [globalContent, setGlobalContent] = useState<ContentFields>(emptyContent());
  const [override, setOverride] = useState<ContentFields>(emptyContent());
  const [flags, setFlags] = useState<OverrideFlags>({
    greeting: false, icebreaker: false, summary: false,
    bible_texts: false, questions: false,
    practice: false, prayer_prompt: false,
    video_link: false, audio_link: false, pdf_link: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);

  useEffect(() => { loadContent(); }, [lesson.id]);

  async function loadContent() {
    setLoading(true);

    // Load global content
    const { data: globalData } = await supabase
      .from("lesson_content")
      .select("*")
      .eq("lesson_id", lesson.id)
      .maybeSingle();

    const global: ContentFields = globalData ? {
      greeting: globalData.greeting ?? "",
      icebreaker: globalData.icebreaker ?? "",
      summary: globalData.summary ?? "",
      bible_texts: globalData.bible_texts ?? [],
      questions: globalData.questions ?? [],
      practice: globalData.practice ?? "",
      prayer_prompt: globalData.prayer_prompt ?? "",
      video_link: globalData.video_link ?? "",
      audio_link: globalData.audio_link ?? "",
      pdf_link: (globalData as any).pdf_link ?? "",
    } : emptyContent();
    setGlobalContent(global);

    // Load turma override if exists
    if (profile?.turma_id) {
      const { data: ov } = await supabase
        .from("turma_lesson_content")
        .select("*")
        .eq("turma_id", profile.turma_id)
        .eq("lesson_id", lesson.id)
        .maybeSingle();

      if (ov) {
        setHasOverride(true);
        // A field is overridden if it's non-null/non-empty in the override record
        const f: OverrideFlags = {
          greeting: !!ov.greeting,
          icebreaker: !!ov.icebreaker,
          summary: !!ov.summary,
          bible_texts: !!(ov.bible_texts?.length),
          questions: !!(ov.questions?.length),
          practice: !!ov.practice,
          prayer_prompt: !!ov.prayer_prompt,
          video_link: !!ov.video_link,
          audio_link: !!ov.audio_link,
          pdf_link: !!(ov as any).pdf_link,
        };
        setFlags(f);
        setOverride({
          greeting: ov.greeting ?? "",
          icebreaker: ov.icebreaker ?? "",
          summary: ov.summary ?? "",
          bible_texts: ov.bible_texts ?? [],
          questions: ov.questions ?? [],
          practice: ov.practice ?? "",
          prayer_prompt: ov.prayer_prompt ?? "",
          video_link: ov.video_link ?? "",
          audio_link: ov.audio_link ?? "",
          pdf_link: (ov as any).pdf_link ?? "",
        });
      }
    }

    setLoading(false);
  }

  function toggleFlag(field: keyof OverrideFlags) {
    setFlags(prev => {
      const next = { ...prev, [field]: !prev[field] };
      // When enabling, pre-fill with global value
      if (!prev[field]) {
        setOverride(o => ({
          ...o,
          [field]: field === "bible_texts" || field === "questions"
            ? [...(globalContent[field] as string[])]
            : globalContent[field],
        }));
      }
      return next;
    });
  }

  async function handleSave() {
    if (!profile?.turma_id) return;
    setSaving(true);

    const payload: Record<string, any> = {
      turma_id: profile.turma_id,
      lesson_id: lesson.id,
      created_by: (await supabase.auth.getUser()).data.user?.id,
      // Only save fields that are flagged as overridden
      greeting: flags.greeting ? override.greeting : null,
      icebreaker: flags.icebreaker ? override.icebreaker : null,
      summary: flags.summary ? override.summary : null,
      bible_texts: flags.bible_texts ? override.bible_texts.filter(t => t.trim()) : null,
      questions: flags.questions ? override.questions.filter(q => q.trim()) : null,
      practice: flags.practice ? override.practice : null,
      prayer_prompt: flags.prayer_prompt ? override.prayer_prompt : null,
      video_link: flags.video_link ? override.video_link : null,
      audio_link: flags.audio_link ? override.audio_link : null,
      pdf_link: flags.pdf_link ? override.pdf_link : null,
    };

    const { error } = await supabase
      .from("turma_lesson_content")
      .upsert(payload, { onConflict: "turma_id,lesson_id" });

    if (error) {
      console.error("Erro ao salvar personalização:", error.message);
    } else {
      setSaved(true);
      setHasOverride(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  function updateBibleText(i: number, val: string) {
    setOverride(prev => {
      const arr = [...prev.bible_texts];
      arr[i] = val;
      return { ...prev, bible_texts: arr };
    });
  }

  function updateQuestion(i: number, val: string) {
    setOverride(prev => {
      const arr = [...prev.questions];
      arr[i] = val;
      return { ...prev, questions: arr };
    });
  }

  // Reusable field block: shows global as reference, toggle to override
  function FieldBlock({
    fieldKey, icon, title, rows = 3,
    render,
  }: {
    fieldKey: keyof OverrideFlags;
    icon: React.ReactNode;
    title: string;
    rows?: number;
    render?: () => React.ReactNode;
  }) {
    const isOverriding = flags[fieldKey];
    const globalVal = globalContent[fieldKey];
    const isArray = fieldKey === "bible_texts" || fieldKey === "questions";

    return (
      <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${isOverriding ? "border-primary/40" : "border-border"}`}>
        <div className={`px-4 py-3 border-b flex items-center justify-between ${isOverriding ? "border-primary/20 bg-primary/5" : "border-border bg-muted/30"}`}>
          <div className="flex items-center gap-2">
            {icon}
            <p className="font-montserrat font-bold text-foreground text-sm">{title}</p>
          </div>
          <button
            onClick={() => toggleFlag(fieldKey)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-inter font-medium transition-colors ${
              isOverriding
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
            }`}
          >
            {isOverriding ? <><RotateCcw className="w-3 h-3" /> Usar global</> : <><Pencil className="w-3 h-3" /> Personalizar</>}
          </button>
        </div>

        <div className="p-4 space-y-2">
          {/* Global reference */}
          {!isOverriding && (
            <div className="rounded-xl bg-muted/40 px-3 py-2 space-y-1">
              <p className="font-inter text-[10px] text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" /> Conteúdo global (todos os membros veem isso)
              </p>
              {isArray ? (
                <ul className="space-y-0.5 pl-3">
                  {(globalVal as string[]).map((v, i) => (
                    <li key={i} className="font-inter text-xs text-foreground">{v || <em className="text-muted-foreground">vazio</em>}</li>
                  ))}
                  {(globalVal as string[]).length === 0 && <li className="font-inter text-xs text-muted-foreground italic">Nenhum item</li>}
                </ul>
              ) : (
                <p className="font-inter text-xs text-foreground whitespace-pre-wrap">
                  {(globalVal as string) || <em className="text-muted-foreground">vazio</em>}
                </p>
              )}
            </div>
          )}

          {/* Override editor */}
          {isOverriding && (
            render ? render() : !isArray ? (
              <textarea
                value={override[fieldKey] as string}
                onChange={e => setOverride(o => ({ ...o, [fieldKey]: e.target.value }))}
                rows={rows}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            ) : null
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
        <p className="text-muted-foreground font-inter text-sm">Carregando conteúdo...</p>
      </div>
    );
  }

  if (!profile?.turma_id) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-inter text-sm">Você precisa estar vinculado a uma turma para personalizar lições.</p>
        <button onClick={onBack} className="mt-4 text-primary font-inter text-sm hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Header */}
      <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-primary-foreground/60 font-inter text-xs">Personalização · Lição {lesson.order_num}</p>
          {hasOverride ? (
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-primary-foreground text-[10px] font-inter font-bold">✅ Personalizada</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-primary-foreground/60 text-[10px] font-inter font-bold">Usando conteúdo global</span>
          )}
        </div>
        <h2 className="font-montserrat font-black text-primary-foreground text-lg leading-tight">{lesson.title}</h2>
        {lesson.objective && (
          <p className="text-primary-foreground/70 font-inter text-xs mt-1">{lesson.objective}</p>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
        <Pencil className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="font-inter text-xs text-primary leading-relaxed">
          Personalize apenas os campos necessários para a sua turma. Os campos não personalizados continuam usando o conteúdo global do pastor.
        </p>
      </div>

      {/* 1. Saudação */}
      <FieldBlock fieldKey="greeting" icon={<Heart className="w-4 h-4 text-primary" />} title="👋 Saudação do Líder" rows={3} />

      {/* 2. Quebra-gelo */}
      <FieldBlock fieldKey="icebreaker" icon={<MessageCircle className="w-4 h-4 text-secondary" />} title="🔗 Quebra-gelo" rows={2} />

      {/* 3. Mídia */}
      <FieldBlock
        fieldKey="video_link"
        icon={<Play className="w-4 h-4 text-primary" />}
        title="🎥 Vídeo"
        render={() => (
          <input
            type="url"
            value={override.video_link}
            onChange={e => setOverride(o => ({ ...o, video_link: e.target.value }))}
            placeholder="https://youtube.com/..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      />

      <FieldBlock
        fieldKey="audio_link"
        icon={<Volume2 className="w-4 h-4 text-primary" />}
        title="🎙️ Áudio / Podcast"
        render={() => (
          <input
            type="url"
            value={override.audio_link}
            onChange={e => setOverride(o => ({ ...o, audio_link: e.target.value }))}
            placeholder="https://..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      />

      <FieldBlock
        fieldKey="pdf_link"
        icon={<FileText className="w-4 h-4 text-primary" />}
        title="📄 Apostila / PDF"
        render={() => (
          <input
            type="url"
            value={override.pdf_link}
            onChange={e => setOverride(o => ({ ...o, pdf_link: e.target.value }))}
            placeholder="https://drive.google.com/..."
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
      />

      {/* 4. Resumo */}
      <FieldBlock fieldKey="summary" icon={<BookOpen className="w-4 h-4 text-secondary" />} title="📝 Resumo do Conteúdo" rows={5} />

      {/* 5. Textos Bíblicos */}
      <FieldBlock
        fieldKey="bible_texts"
        icon={<span className="text-sm">✝️</span>}
        title="📖 Textos Bíblicos"
        render={() => (
          <div className="space-y-2">
            {override.bible_texts.map((text, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => updateBibleText(i, e.target.value)}
                  placeholder="Ex: João 3:16"
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {override.bible_texts.length > 1 && (
                  <button
                    onClick={() => setOverride(o => ({ ...o, bible_texts: o.bible_texts.filter((_, idx) => idx !== i) }))}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setOverride(o => ({ ...o, bible_texts: [...o.bible_texts, ""] }))}
              className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar referência
            </button>
          </div>
        )}
      />

      {/* 6. Perguntas */}
      <FieldBlock
        fieldKey="questions"
        icon={<Pen className="w-4 h-4 text-primary" />}
        title="💬 Perguntas para Diálogo"
        render={() => (
          <div className="space-y-3">
            {override.questions.map((q, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center font-montserrat font-bold text-primary text-[10px] flex-shrink-0">{i + 1}</span>
                  <p className="font-inter text-xs font-semibold text-muted-foreground">Pergunta {i + 1}</p>
                  {override.questions.length > 1 && (
                    <button
                      onClick={() => setOverride(o => ({ ...o, questions: o.questions.filter((_, idx) => idx !== i) }))}
                      className="ml-auto p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  value={q}
                  onChange={e => updateQuestion(i, e.target.value)}
                  rows={2}
                  placeholder={`Pergunta ${i + 1}...`}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            ))}
            <button
              onClick={() => setOverride(o => ({ ...o, questions: [...o.questions, ""] }))}
              className="flex items-center gap-2 text-primary font-inter text-xs font-medium py-1.5 hover:opacity-70 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar pergunta
            </button>
          </div>
        )}
      />

      {/* 7. Prática */}
      <FieldBlock fieldKey="practice" icon={<Target className="w-4 h-4 text-secondary" />} title="🧭 Prática da Semana" rows={3} />

      {/* 8. Oração */}
      <FieldBlock fieldKey="prayer_prompt" icon={<Heart className="w-4 h-4 text-primary" />} title="🙏 Oração Final" rows={3} />

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70 transition-opacity"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Save className="w-4 h-4" />
        {saving ? "Salvando..." : saved ? "✅ Personalização salva!" : "Salvar personalização"}
      </button>
    </div>
  );
}
