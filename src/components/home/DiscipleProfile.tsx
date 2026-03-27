import { Star, Flame, CheckCircle, TrendingUp } from "lucide-react";

interface DiscipleProfileProps {
  faithPoints: number;
  faithLevel: number;
  streakDays: number;
  completedCount: number;
  community?: string;
  area?: string;
}

export default function DiscipleProfile({ faithPoints, faithLevel, streakDays, completedCount, community, area }: DiscipleProfileProps) {
  const nextLevelPoints = 200;
  const progress = Math.round((faithPoints / nextLevelPoints) * 100);

  return (
    <div className="px-5 pb-6">
      <div className="rounded-3xl overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        {/* Decorative orbs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6 pointer-events-none" />

        <div className="relative p-5">
          {/* Growth badge */}
          <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 w-fit mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-accent" />
            <span className="text-accent text-xs font-montserrat font-bold">Você está crescendo! ⭐</span>
          </div>

          {/* Avatar + Info */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl border-2 border-white/30 flex-shrink-0">
              🧑‍🎓
            </div>
            <div>
              <p className="text-primary-foreground/70 text-xs font-inter">Perfil do discípulo</p>
              <h3 className="font-montserrat font-black text-primary-foreground text-lg">Discípulo Nível {faithLevel}</h3>
              <p className="text-primary-foreground/70 text-sm font-inter">{community ?? "Caminho"} • {area ?? "Área 1"}</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-white/10 rounded-2xl p-2.5 flex flex-col items-center gap-1">
              <Flame className="w-4 h-4 text-secondary" style={{ fill: "hsl(var(--secondary))" }} />
              <span className="font-montserrat font-black text-primary-foreground text-base">{streakDays}</span>
              <span className="text-primary-foreground/60 text-xs font-inter text-center">dias</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-2.5 flex flex-col items-center gap-1">
              <Star className="w-4 h-4 text-accent" style={{ fill: "hsl(var(--accent))" }} />
              <span className="font-montserrat font-black text-primary-foreground text-base">{faithPoints}</span>
              <span className="text-primary-foreground/60 text-xs font-inter text-center">pontos</span>
            </div>
            <div className="bg-white/10 rounded-2xl p-2.5 flex flex-col items-center gap-1">
              <CheckCircle className="w-4 h-4 text-brand-green fill-brand-green" />
              <span className="font-montserrat font-black text-primary-foreground text-base">{completedCount}</span>
              <span className="text-primary-foreground/60 text-xs font-inter text-center">concluídos</span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-primary-foreground/70 text-xs font-inter">Progresso para Nível {faithLevel + 1}</span>
              <span className="text-primary-foreground text-xs font-montserrat font-bold">{faithPoints}/{nextLevelPoints} pts</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-orange rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-primary-foreground/80 text-xs font-inter italic text-center">
            ✨ "Crescendo na fé, juntos."
          </p>
        </div>
      </div>
    </div>
  );
}
