import { useEffect, useState } from "react";
import { Flame, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  onNavigateToJornada: () => void;
};

export default function StreakRiskReminder({ onNavigateToJornada }: Props) {
  const [daysInactive, setDaysInactive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: progress }, { data: devotionalProgress }] = await Promise.all([
        supabase.from("user_progress").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(1),
        supabase.from("devotional_progress").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(1),
      ]);

      const dates: Date[] = [];
      if (progress?.[0]?.completed_at) dates.push(new Date(progress[0].completed_at));
      if (devotionalProgress?.[0]?.completed_at) dates.push(new Date(devotionalProgress[0].completed_at));

      if (dates.length === 0) {
        setDaysInactive(99);
        setLoading(false);
        return;
      }

      const lastActivity = new Date(Math.max(...dates.map((date) => date.getTime())));
      const diffDays = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
      setDaysInactive(diffDays);
      setLoading(false);
    }

    check();
  }, []);

  if (loading || dismissed || daysInactive < 2) return null;

  const isLongAbsence = daysInactive >= 5;

  return (
    <div
      data-reminder="true"
      className={`mx-5 mb-3 rounded-2xl border p-4 relative overflow-hidden ${
        isLongAbsence ? "border-destructive/30 bg-destructive/5" : "border-accent/30 bg-accent/5"
      }`}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isLongAbsence ? "bg-destructive/15" : "bg-accent/15"
        }`}>
          <Flame className={`w-5 h-5 ${isLongAbsence ? "text-destructive" : "text-accent-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {daysInactive >= 99 ? "Comece sua jornada!" : `${daysInactive} dias sem atividade`}
          </p>
          <p className="text-muted-foreground font-inter text-[10px] mt-0.5 italic">
            {isLongAbsence
              ? "Sua chama esta se apagando. Volte e reacenda seu coracao!"
              : "Nao perca sua sequencia. Um devocional por dia faz toda a diferenca."}
          </p>
        </div>
      </div>

      <button
        onClick={onNavigateToJornada}
        className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-inter text-xs font-semibold transition-colors ${
          isLongAbsence
            ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
            : "bg-accent/15 text-accent-foreground hover:bg-accent/25"
        }`}
      >
        {daysInactive >= 99 ? "Comecar agora" : "Retomar atividades"}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
