import { useEffect, useState } from "react";
import { Sparkles, X, ChevronRight, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgendaSchedule } from "@/hooks/useAgendaSchedule";

type DevotionalStats = {
  totalCompleted: number;
  currentLessonId: string;
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
  const agendaSchedule = useAgendaSchedule();

  useEffect(() => {
    if (agendaSchedule.loading) return;

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("area").eq("user_id", user.id).maybeSingle();
      const userArea = profileData?.area;

      const [{ data: lessons }, { data: devotionals }, { data: progress }, { data: unlocks }] = await Promise.all([
        supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
        supabase.from("devotional_content").select("id, lesson_id, day_number"),
        supabase.from("devotional_progress").select("devotional_id").eq("user_id", user.id),
        supabase.from("course_unlocks").select("course_id").eq("area", userArea ?? ""),
      ]);

      const unlockedCourseIds = new Set((unlocks ?? []).map((unlock) => unlock.course_id));
      const completedSet = new Set((progress ?? []).map((item: any) => item.devotional_id));
      const totalCompleted = completedSet.size;
      const accessibleLessons = (lessons ?? []).filter((lesson: any) => unlockedCourseIds.has(lesson.course_id));

      const lessonDevMap: Record<string, { total: number; completed: number }> = {};
      (devotionals ?? []).forEach((devotional: any) => {
        if (!devotional.lesson_id) return;
        if (!lessonDevMap[devotional.lesson_id]) lessonDevMap[devotional.lesson_id] = { total: 0, completed: 0 };
        lessonDevMap[devotional.lesson_id].total++;
        if (completedSet.has(devotional.id)) lessonDevMap[devotional.lesson_id].completed++;
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentLesson: DevotionalStats | null = null;

      for (const entry of agendaSchedule.schedule) {
        if (today < entry.windowStart) continue;

        const lessonDevs = (devotionals ?? [])
          .filter((devotional: any) => devotional.lesson_id === entry.lessonId)
          .sort((a: any, b: any) => a.day_number - b.day_number);
        const releasedDays = entry.releasedDayNumbers ? new Set(entry.releasedDayNumbers) : null;
        const visibleLessonDevs = lessonDevs.filter((devotional: any) => !releasedDays || releasedDays.has(devotional.day_number));

        let hasAvailableToday = false;
        for (const devotional of visibleLessonDevs) {
          const releaseDate = entry.devotionalDates[devotional.day_number - 1];
          if (!releaseDate || completedSet.has(devotional.id)) continue;
          if (today >= releaseDate) {
            hasAvailableToday = true;
            break;
          }
        }

        if (hasAvailableToday) {
          const info = lessonDevMap[entry.lessonId] ?? { total: visibleLessonDevs.length, completed: 0 };
          currentLesson = {
            totalCompleted,
            currentLessonId: entry.lessonId,
            currentLessonTitle: entry.lessonTitle,
            currentLessonOrder: entry.lessonOrder,
            currentLessonCompleted: info.completed,
            currentLessonTotal: visibleLessonDevs.length || info.total,
            hasAnyPending: true,
          };
          break;
        }
      }

      if (!currentLesson) {
        for (const lesson of accessibleLessons as any[]) {
          const info = lessonDevMap[lesson.id];
          if (info && info.completed < info.total) {
            currentLesson = {
              totalCompleted,
              currentLessonId: lesson.id,
              currentLessonTitle: lesson.title,
              currentLessonOrder: lesson.order_num,
              currentLessonCompleted: info.completed,
              currentLessonTotal: info.total,
              hasAnyPending: true,
            };
            break;
          }
        }
      }

      if (!currentLesson && totalCompleted > 0) {
        currentLesson = {
          totalCompleted,
          currentLessonId: "",
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
  }, [agendaSchedule.loading, agendaSchedule.schedule]);

  if (loading || dismissed || !stats) return null;

  if (!stats.hasAnyPending) {
    return (
      <div data-reminder="true" className="mx-5 mb-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 relative overflow-hidden">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
            <Star className="w-5 h-5 text-brand-green" />
          </div>
          <div className="flex-1 min-w-0 pr-4">
            <p className="font-montserrat font-bold text-foreground text-sm">
              Parabens! Todos os devocionais concluidos!
            </p>
            <p className="text-muted-foreground font-inter text-[11px] mt-0.5">
              Voce ja completou {stats.totalCompleted} devocionais. Continue firme!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = stats.currentLessonTotal > 0
    ? Math.round((stats.currentLessonCompleted / stats.currentLessonTotal) * 100)
    : 0;

  const getMessage = () => {
    if (stats.totalCompleted === 0) return "Comece sua caminhada devocional hoje.";
    if (progressPct >= 80) return "Quase la. Falta pouco para concluir esta licao.";
    if (progressPct >= 50) return "Voce esta indo muito bem. Continue assim.";
    if (stats.totalCompleted >= 10) return `Incrivel. Ja sao ${stats.totalCompleted} devocionais concluidos.`;
    return "Cada dia conta na sua jornada de fe.";
  };

  const handleOpenDevotional = () => {
    if (stats.currentLessonId) {
      window.dispatchEvent(new CustomEvent("navigate-to-lesson", {
        detail: {
          lessonId: stats.currentLessonId,
          mode: "devotional",
        },
      }));
    }
    onNavigateToDiscipulado();
  };

  return (
    <div data-reminder="true" className="mx-5 mb-3 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 relative overflow-hidden">
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
              ? `${stats.currentLessonCompleted}/${stats.currentLessonTotal} na Licao ${stats.currentLessonOrder}`
              : `Licao ${stats.currentLessonOrder}: ${stats.currentLessonTitle}`}
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
        onClick={handleOpenDevotional}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-green/15 text-brand-green font-inter text-xs font-semibold hover:bg-brand-green/25 transition-colors"
      >
        {stats.totalCompleted > 0 ? "Continuar devocional" : "Comecar devocional"}
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
