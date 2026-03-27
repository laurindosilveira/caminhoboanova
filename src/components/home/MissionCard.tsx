import { useState, useEffect } from "react";
import { Zap, Star, Clock, ChevronRight } from "lucide-react";

type Activity = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  points: number;
};

const TYPE_EMOJI: Record<string, string> = {
  devocional: "📖",
  formacao: "🎓",
  encontro: "📅",
  desafio: "✨",
};
const TYPE_LABEL: Record<string, string> = {
  devocional: "Devocional",
  formacao: "Formação",
  encontro: "Encontro",
  desafio: "Atividade",
};

interface MissionCardProps {
  nextActivity: Activity | null;
  completedCount: number;
  totalActivities: number;
  onComplete: (activityId: string) => void;
}

export default function MissionCard({ nextActivity, completedCount, totalActivities, onComplete }: MissionCardProps) {
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(23, 59, 59, 999);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}h ${m}min restantes`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  async function handleStart() {
    if (!nextActivity || completing || done) return;
    setCompleting(true);
    await onComplete(nextActivity.id);
    setDone(true);
    setCompleting(false);
  }

  const pct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  // No activity available
  if (!nextActivity) {
    return (
      <div className="px-5 -mt-1 pt-5">
        <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
          <div className="bg-gradient-orange px-5 py-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">PRÓXIMA ATIVIDADE</span>
          </div>
          <div className="p-5 text-center">
            <span className="text-4xl block mb-3">🎉</span>
            <p className="font-montserrat font-bold text-foreground text-base">Jornada concluída!</p>
            <p className="text-muted-foreground font-inter text-sm mt-1">Você completou todas as atividades. Parabéns!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 -mt-1 pt-5">
      <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
        {/* Header stripe */}
        <div className="bg-gradient-orange px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">PRÓXIMA ATIVIDADE</span>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
            <Clock className="w-3 h-3 text-primary-foreground" />
            <span className="text-primary-foreground text-xs font-inter">{timeLeft}</span>
          </div>
        </div>

        <div className="p-5">
          {/* Content */}
          <div className="flex items-start gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-orange flex items-center justify-center text-3xl flex-shrink-0 shadow-lg shadow-secondary/30">
              {TYPE_EMOJI[nextActivity.type] ?? "📌"}
            </div>
            <div className="flex-1">
              <p className="text-muted-foreground text-xs font-inter mb-1 uppercase tracking-wide">
                {TYPE_LABEL[nextActivity.type] ?? nextActivity.type}
              </p>
              <h2 className="font-montserrat font-black text-card-foreground text-xl leading-tight">
                {nextActivity.title}
              </h2>
              {nextActivity.subtitle && (
                <p className="text-muted-foreground text-sm font-inter mt-1">{nextActivity.subtitle}</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-muted-foreground text-xs font-inter">
                {completedCount}/{totalActivities} atividades concluídas
              </span>
              <span className="text-xs font-montserrat font-bold text-secondary">{pct}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-orange rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
              </div>
              <span className="text-accent font-montserrat font-black text-base">+{nextActivity.points} pts</span>
            </div>
            <button
              onClick={handleStart}
              disabled={completing}
              className={`px-7 py-3.5 rounded-2xl font-montserrat font-black text-sm text-primary-foreground transition-all active:scale-95 disabled:opacity-60 ${
                done
                  ? "bg-brand-green shadow-lg shadow-brand-green/30"
                  : "bg-gradient-orange shadow-xl shadow-secondary/40 animate-pulse-glow"
              }`}
            >
              {done ? "✅ Concluído!" : completing ? "..." : completedCount === 0 ? "COMEÇAR AGORA →" : "CONTINUAR →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
