import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X, ChevronRight, Star } from "lucide-react";

type DevotionalStats = {
  totalCompleted: number;
  currentLessonTitle: string;
  currentLessonOrder: number;
  currentLessonCompleted: number;
  currentLessonTotal: number;
  hasAnyPending: boolean;
};

type Props = {
  onNavigateToDiscipulado: () => void;
};

export default function DevotionalReminder({ onNavigateToDiscipulado }: Props) {
  const [stats, setStats] = useState<DevotionalStats | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get user profile for area
      const { data: profileData } = await supabase.from("profiles").select("area").eq("user_id", user.id).maybeSingle();
      const userArea = profileData?.area;

      const [{ data: lessons }, { data: devs }, { data: prog }, { data: unlocks }] = await Promise.all([
        supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
        supabase.from("devotional_content").select("id, lesson_id"),
        supabase.from("devotional_progress").select("devotional_id").eq("user_id", user.id),
        supabase.from("course_unlocks").select("course_id").eq("area", userArea ?? ""),
      ]);

      const unlockedCourseIds = new Set((unlocks ?? []).map(u => u.course_id));
      const completedSet = new Set((prog ?? []).map((p: any) => p.devotional_id));
      const totalCompleted = completedSet.size;

      // Only consider lessons from unlocked courses
      const accessibleLessons = (lessons ?? []).filter((l: any) => unlockedCourseIds.has(l.course_id));

      // Group devotionals by lesson
      const lessonDevMap: Record<string, { total: number; completed: number }> = {};
      (devs ?? []).forEach((d: any) => {
        if (!d.lesson_id) return;
        if (!lessonDevMap[d.lesson_id]) lessonDevMap[d.lesson_id] = { total: 0, completed: 0 };
        lessonDevMap[d.lesson_id].total++;
        if (completedSet.has(d.id)) lessonDevMap[d.lesson_id].completed++;
      });

      // Find the FIRST accessible lesson with pending devotionals
      let currentLesson: DevotionalStats | null = null;
      for (const l of accessibleLessons as any[]) {
        const info = lessonDevMap[l.id];
        if (info && info.completed < info.total) {
          currentLesson = {
            totalCompleted,
            currentLessonTitle: l.title,
            currentLessonOrder: l.order_num,
            currentLessonCompleted: info.completed,
            currentLessonTotal: info.total,
            hasAnyPending: true,
          };
          break;
        }
      }

      if (!currentLesson && totalCompleted > 0) {
        // All done!
        currentLesson = {
          totalCompleted,
          currentLessonTitle: "",
          currentLessonOrder: 0,
          currentLessonCompleted: 0,
          currentLessonTotal: 0,
          hasAnyPending: false,
        };
      }

      setStats(currentLesson);
      setLoading(false);
    }
    check();
  }, []);

  if (loading || dismissed || !stats) return null;

  // All devotionals completed — celebration message
  if (!stats.hasAnyPending) {
    return (
      <div className="mx-5 mb-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 relative overflow-hidden">
        <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-brand-green" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="font-montserrat font-bold text-foreground text-sm">
              🎉 Parabéns! Todos os devocionais concluídos!
            </p>
            <p className="text-muted-foreground font-inter text-[11px] mt-0.5">
              Você já completou {stats.totalCompleted} devocionais. Continue firme!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = stats.currentLessonTotal > 0
    ? Math.round((stats.currentLessonCompleted / stats.currentLessonTotal) * 100)
    : 0;

  // Motivational messages based on progress
  const getMessage = () => {
    if (stats.totalCompleted === 0) return "Comece sua caminhada devocional hoje! 🌱";
    if (progressPct >= 80) return "Quase lá! Falta pouco para concluir esta lição! 🔥";
    if (progressPct >= 50) return "Você está indo muito bem! Continue assim! 💪";
    if (stats.totalCompleted >= 10) return "Incrível! Já são " + stats.totalCompleted + " devocionais concluídos! ⭐";
    return "Cada dia conta na sua jornada de fé! ✨";
  };

  return (
    <div className="mx-5 mb-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 relative overflow-hidden">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-brand-green" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {stats.totalCompleted > 0
              ? `🎯 ${stats.currentLessonCompleted}/${stats.currentLessonTotal} na Lição ${stats.currentLessonOrder}`
              : `📖 Lição ${stats.currentLessonOrder}: ${stats.currentLessonTitle}`
            }
          </p>
          {stats.totalCompleted > 0 && (
            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
          <p className="text-muted-foreground font-inter text-[11px] mt-1">
            {getMessage()}
          </p>
        </div>
      </div>

      <button
        onClick={onNavigateToDiscipulado}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-green/15 text-brand-green font-inter text-xs font-semibold hover:bg-brand-green/25 transition-colors"
      >
        {stats.totalCompleted > 0 ? "Continuar Devocional" : "Começar Devocional"}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
