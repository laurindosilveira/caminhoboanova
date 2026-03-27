import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

interface PointsBreakdown {
  lessonStudyCount: number;
  devotionalCount: number;
  attendanceCount: number;
  worshipCount: number;
  activityPoints: number;
  achievementBonus: number;
  devotionalPoints?: number;
  // Potential (max possible)
  totalLessons: number;
  totalDevotionals: number;
  totalEvents: number;
}

export default function GameRulesDialog({ breakdown }: { breakdown: PointsBreakdown }) {
  const earned = {
    lessons: breakdown.lessonStudyCount * 20,
    devotionals: breakdown.devotionalPoints ?? (breakdown.devotionalCount * 5),
    attendance: breakdown.attendanceCount * 10,
    worship: breakdown.worshipCount * 5,
    activities: breakdown.activityPoints,
    achievements: breakdown.achievementBonus,
  };

  const missed = {
    lessons: (breakdown.totalLessons - breakdown.lessonStudyCount) * 20,
    devotionals: (breakdown.totalDevotionals - breakdown.devotionalCount) * 5,
    attendance: (breakdown.totalEvents - breakdown.attendanceCount) * 10,
  };

  const totalEarned = Object.values(earned).reduce((a, b) => a + b, 0);
  const totalMissed = Object.values(missed).reduce((a, b) => a + b, 0);

  const rules = [
    { emoji: "🎓", label: "Estudo de lição", pts: "20 pts", desc: "cada lição estudada" },
    { emoji: "📖", label: "Devocional (semana)", pts: "5 pts", desc: "cada devocional feito seg-sex" },
    { emoji: "📖", label: "Devocional (fim de sem.)", pts: "2 pts", desc: "cada devocional recuperado no sáb/dom" },
    { emoji: "📅", label: "Presença em encontro", pts: "10 pts", desc: "cada presença confirmada" },
    { emoji: "⛪", label: "Culto confirmado", pts: "5 pts", desc: "cada culto aprovado" },
    { emoji: "✅", label: "Atividade completa", pts: "variável", desc: "pontos definidos por atividade" },
    { emoji: "🏆", label: "Conquista desbloqueada", pts: "+10 a +50", desc: "bônus por conquista" },
    { emoji: "🔥", label: "Sequência (streak)", pts: "—", desc: "dias consecutivos com atividade" },
    { emoji: "🏅", label: "Quinzena perfeita", pts: "+30 pts", desc: "completar estudo + devocionais + presença nos últimos 15 dias" },
    { emoji: "📚", label: "Curso completo", pts: "+100 pts", desc: "bônus por concluir todas as lições de um curso" },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-full px-3 py-1.5 transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-inter font-semibold">Como funciona?</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-montserrat text-lg">📋 Regras do Game</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Rules */}
          <div>
            <p className="font-montserrat font-bold text-foreground text-sm mb-3">Como ganhar pontos</p>
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.label} className="flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2.5">
                  <span className="text-lg">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-foreground">{r.label}</p>
                    <p className="font-inter text-[10px] text-muted-foreground">{r.desc}</p>
                  </div>
                  <span className="font-montserrat font-bold text-secondary text-xs flex-shrink-0">{r.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Earned report */}
          <div>
            <p className="font-montserrat font-bold text-foreground text-sm mb-2">✅ Seus pontos ganhos</p>
            <div className="bg-card rounded-xl border border-border p-3 space-y-1.5">
              <Row label="Lições estudadas" count={breakdown.lessonStudyCount} pts={earned.lessons} />
              <Row label="Devocionais" count={breakdown.devotionalCount} pts={earned.devotionals} />
              <Row label="Presenças" count={breakdown.attendanceCount} pts={earned.attendance} />
              <Row label="Cultos" count={breakdown.worshipCount} pts={earned.worship} />
              <Row label="Atividades" pts={earned.activities} />
              <Row label="Bônus conquistas" pts={earned.achievements} />
              <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
                <span className="font-montserrat font-bold text-foreground text-sm">Total ganho</span>
                <span className="font-montserrat font-black text-brand-green text-sm">+{totalEarned} pts</span>
              </div>
            </div>
          </div>

          {/* Missed report */}
          <div>
            <p className="font-montserrat font-bold text-foreground text-sm mb-2">❌ Pontos perdidos</p>
            <p className="font-inter text-[11px] text-muted-foreground mb-2">
              Pontos que você deixou de ganhar por não completar atividades.
            </p>
            <div className="bg-card rounded-xl border border-destructive/20 p-3 space-y-1.5">
              <MissedRow label="Lições não estudadas" count={breakdown.totalLessons - breakdown.lessonStudyCount} pts={missed.lessons} />
              <MissedRow label="Devocionais pendentes" count={breakdown.totalDevotionals - breakdown.devotionalCount} pts={missed.devotionals} />
              <MissedRow label="Encontros ausentes" count={breakdown.totalEvents - breakdown.attendanceCount} pts={missed.attendance} />
              <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between">
                <span className="font-montserrat font-bold text-foreground text-sm">Total perdido</span>
                <span className="font-montserrat font-black text-destructive text-sm">-{totalMissed} pts</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-secondary/5 rounded-xl p-3">
            <p className="font-montserrat font-bold text-foreground text-xs mb-1">💡 Dicas</p>
            <ul className="font-inter text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              <li>Mantenha sua sequência diária para desbloquear conquistas secretas!</li>
              <li>Conquistas normais dão +10 pts, secretas +25 pts</li>
              <li>A conquista "Profissão de Fé" vale +50 pts bônus</li>
              <li>Complete cursos inteiros para ganhar +100 pts de bônus</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, count, pts }: { label: string; count?: number; pts: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-inter text-xs text-foreground">
        {label}{count !== undefined ? ` (${count})` : ""}
      </span>
      <span className="font-montserrat font-bold text-brand-green text-xs">+{pts}</span>
    </div>
  );
}

function MissedRow({ label, count, pts }: { label: string; count: number; pts: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="font-inter text-xs text-foreground">{label} ({count})</span>
      <span className="font-montserrat font-bold text-destructive text-xs">-{pts}</span>
    </div>
  );
}
