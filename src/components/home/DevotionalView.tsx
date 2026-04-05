import { useState, useEffect } from "react";
import BibleModal from "./BibleModal";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, BookOpen, Heart, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type DevotionalContent = {
  bible_text: string;
  bible_reference: string;
  reflection: string;
  prayer: string;
  practice: string;
  questions: string[];
};

type Props = {
  activity: { id: string; title: string; subtitle: string | null; points: number };
  onBack: () => void;
  onComplete: (activityId: string) => void;
  isCompleted: boolean;
  devotionalData?: DevotionalContent;
  hideCompleteButton?: boolean;
  /** True when this completion happens during the recovery window (lower points). */
  isRecovery?: boolean;
  awardedPoints?: number;
  overrideId?: string;
};

export default function DevotionalView({ activity, onBack, onComplete, isCompleted, devotionalData, hideCompleteButton, isRecovery = false, awardedPoints, overrideId }: Props) {
  const [content, setContent] = useState<DevotionalContent | null>(devotionalData ?? null);
  const [loading, setLoading] = useState(!devotionalData);
  const [completing, setCompleting] = useState(false);
  const [bibleModalRef, setBibleModalRef] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [attempted, setAttempted] = useState(false);
  const [readConfirmed, setReadConfirmed] = useState(false);

  useEffect(() => {
    if (devotionalData) return;

    async function load() {
      const { data } = await supabase
        .from("devotional_content")
        .select("*")
        .eq("activity_id", activity.id)
        .maybeSingle();

      if (data) {
        setContent({
          bible_text: data.bible_text || "",
          bible_reference: data.bible_reference || "",
          reflection: data.reflection || "",
          prayer: data.prayer || "",
          practice: data.practice || "",
          questions: (data.questions as string[]) ?? [],
        });
      }

      setLoading(false);
    }

    load();
  }, [activity.id, devotionalData]);

  useEffect(() => {
    async function loadAnswers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("devotional_responses")
        .select("question_index, response")
        .eq("user_id", user.id)
        .eq("devotional_id", activity.id)
        .order("question_index");

      if (!data) return;

      const nextAnswers: Record<number, string> = {};
      data.forEach((row) => {
        nextAnswers[row.question_index] = row.response ?? "";
      });
      setAnswers(nextAnswers);
    }

    loadAnswers();
  }, [activity.id]);

  const activeQuestions = (content?.questions ?? []).filter((question) => question.trim());
  const hasQuestions = activeQuestions.length > 0;
  const allQuestionsAnswered = hasQuestions && activeQuestions.every((_, index) => (answers[index] ?? "").trim().length > 0);
  // When there are no questions, require an explicit read confirmation instead
  const canComplete = hasQuestions ? allQuestionsAnswered : readConfirmed;

  async function handleComplete() {
    setAttempted(true);

    if (!canComplete) {
      toast.error("Responda todas as perguntas antes de concluir!", {
        description: "Preencha cada campo para ganhar seus pontos.",
        duration: 4000,
      });
      return;
    }

    setCompleting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCompleting(false);
      return;
    }

    const answerRows = activeQuestions.map((_, index) => ({
      user_id: user.id,
      devotional_id: activity.id,
      question_index: index,
      response: answers[index] ?? "",
    }));

    let { error: progressError } = await supabase.from("devotional_progress").insert({
      user_id: user.id,
      devotional_id: activity.id,
      is_recovery: isRecovery,
      awarded_points: awardedPoints ?? activity.points,
      override_release_id: overrideId ?? null,
    } as any);

    if (progressError && /awarded_points|override_release_id/i.test(progressError.message)) {
      const fallback = await supabase.from("devotional_progress").insert({
        user_id: user.id,
        devotional_id: activity.id,
        is_recovery: isRecovery,
      } as any);
      progressError = fallback.error;
    }

    if (progressError) {
      toast.error("Não foi possível concluir o devocional.", {
        description: progressError.message,
      });
      setCompleting(false);
      return;
    }

    if (answerRows.length > 0) {
      const { error: answersError } = await supabase
        .from("devotional_responses")
        .upsert(answerRows, { onConflict: "user_id,devotional_id,question_index" });

      if (answersError) {
        await supabase
          .from("devotional_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("devotional_id", activity.id);

        toast.error("Não foi possível salvar as respostas do devocional.", {
          description: "A conclusão foi cancelada para evitar pontuação sem respostas.",
        });
        setCompleting(false);
        return;
      }
    }

    await onComplete(activity.id);
    setCompleting(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-brand-green" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando devocional...</p>
      </div>
    );
  }

  if (!content || (!content.bible_text && !content.reflection)) {
    return (
      <div className="px-5 pt-6 space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">{activity.title}</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Conteúdo em preparação pelo seu pastor. Volte em breve!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6 pb-24 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">📖</div>
          <div>
            <p className="text-primary-foreground/60 font-inter text-xs uppercase tracking-wide">Devocional</p>
            <h1 className="font-montserrat font-black text-primary-foreground text-xl leading-tight">{activity.title}</h1>
          </div>
        </div>
        {activity.subtitle && <p className="text-primary-foreground/70 font-inter text-sm">{activity.subtitle}</p>}
        {isCompleted && (
          <div className="mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
            <span className="text-primary-foreground/80 font-inter text-xs font-medium">Concluído</span>
          </div>
        )}
      </div>

      {content.bible_reference && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-brand-green/5 flex items-center gap-2">
            <span className="text-sm">✝️</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Texto Bíblico</p>
          </div>
          <div className="p-4">
            <button onClick={() => setBibleModalRef(content.bible_reference)} className="font-montserrat font-bold text-brand-green text-sm mb-2 hover:underline inline-flex items-center gap-1">
              📖 {content.bible_reference}
            </button>
            <BibleModal reference={bibleModalRef || ""} open={!!bibleModalRef} onClose={() => setBibleModalRef(null)} />
            {content.bible_text && (
              <p className="text-foreground font-inter text-sm leading-relaxed italic whitespace-pre-wrap">
                "{content.bible_text}"
              </p>
            )}
          </div>
        </div>
      )}

      {content.reflection && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-green" />
            <p className="font-montserrat font-bold text-foreground text-sm">📖 Reflexão</p>
          </div>
          <div className="p-4">
            <p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.reflection}</p>
          </div>
        </div>
      )}

      {activeQuestions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">💬</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Para Pensar</p>
            {!isCompleted && (
              <span className="ml-auto text-muted-foreground font-inter text-[10px]">
                {activeQuestions.filter((_, index) => (answers[index] ?? "").trim()).length}/{activeQuestions.length} respondidas
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {activeQuestions.map((question, index) => {
              const answered = (answers[index] ?? "").trim().length > 0;
              const showError = attempted && !answered && !isCompleted;

              return (
                <div key={index} className="space-y-2">
                  <div className="flex gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-montserrat font-bold text-xs flex-shrink-0 mt-0.5 ${
                      answered ? "bg-brand-green/20 text-brand-green" : showError ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    }`}>
                      {index + 1}
                    </span>
                    <p className="text-foreground font-inter text-sm">{question}</p>
                  </div>
                  {isCompleted ? (
                    <div className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-foreground font-inter text-sm whitespace-pre-wrap min-h-16">
                      {(answers[index] ?? "").trim() || "Sem resposta registrada."}
                    </div>
                  ) : (
                    <textarea
                      value={answers[index] ?? ""}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [index]: event.target.value }))}
                      placeholder="Escreva sua reflexão..."
                      rows={2}
                      className={`w-full px-3 py-2.5 rounded-xl border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 resize-none transition-colors ${
                        showError ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {content.practice && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/5 flex items-center gap-2">
            <span className="text-sm">🧭</span>
            <p className="font-montserrat font-bold text-foreground text-sm">Prática do Dia</p>
          </div>
          <div className="p-4">
            <p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.practice}</p>
          </div>
        </div>
      )}

      {content.prayer && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">🙏 Oração</p>
          </div>
          <div className="p-4">
            <p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap italic">{content.prayer}</p>
          </div>
        </div>
      )}

      {!isCompleted && !hideCompleteButton && !hasQuestions && (
        <label className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-muted/40 border border-border cursor-pointer select-none">
          <input
            type="checkbox"
            checked={readConfirmed}
            onChange={e => setReadConfirmed(e.target.checked)}
            className="w-4 h-4 accent-primary flex-shrink-0"
          />
          <p className="font-inter text-sm text-foreground">
            Li e refleti sobre o devocional de hoje
          </p>
        </label>
      )}

      {!isCompleted && !hideCompleteButton && attempted && !canComplete && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="font-inter text-xs text-destructive">
            {hasQuestions ? "Responda todas as perguntas para poder concluir o devocional." : "Confirme que leu o devocional antes de concluir."}
          </p>
        </div>
      )}

      {!isCompleted && !hideCompleteButton && (
        <div className="space-y-2">
          {(() => {
            const now = new Date();
            const isWeekend = now.getDay() === 0 || now.getDay() === 6;
            const points = isWeekend ? 2 : activity.points;

            return (
              <>
                <button
                  onClick={handleComplete}
                  disabled={completing || !canComplete}
                  className={`w-full py-3.5 rounded-2xl font-montserrat text-sm font-black text-primary-foreground disabled:opacity-60 shadow-lg active:scale-95 transition-all ${
                    canComplete ? "shadow-secondary/30" : "opacity-70"
                  }`}
                  style={{ background: "var(--gradient-orange)" }}
                >
                  {completing ? "Marcando..." : `Concluir Devocional · +${points} pts →`}
                </button>
                {isWeekend && (
                  <p className="text-center text-accent-foreground font-inter text-[10px]">
                    ⚠️ Recuperação de fim de semana: 2 pts ao invés de {activity.points} pts
                  </p>
                )}
              </>
            );
          })()}
          <p className="text-center text-muted-foreground font-inter text-[10px]">
            ⭐ Responda as perguntas para ganhar seus pontos de fé!
          </p>
        </div>
      )}

      {isCompleted && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-green/10 border border-brand-green/20">
          <CheckCircle2 className="w-4 h-4 text-brand-green" />
          <span className="font-inter text-sm font-medium text-brand-green">Concluído · +{activity.points} pts ganhos</span>
        </div>
      )}
    </div>
  );
}
