import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { Zap, Clock, ChevronRight, BookOpen, GraduationCap, CalendarDays } from "lucide-react";
import { useAgendaSchedule } from "@/hooks/useAgendaSchedule";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type NextItem = {
  type: "lesson" | "devotional" | "waiting_devotional";
  lessonId: string;
  title: string;
  subtitle: string;
  courseTitle: string;
  courseOrder: number;
  lessonOrder: number;
  devotionalDay?: number;
  totalDevotionals?: number;
  completedDevotionals?: number;
  eventDate?: Date;
  nextReleaseDate?: Date;
};

export default function NextCourseActivityCard({ onNavigateToDiscipulado }: { onNavigateToDiscipulado: () => void }) {
  const { profile, role, user } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const [nextItem, setNextItem] = useState<NextItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState("");
  const [noSchedule, setNoSchedule] = useState(false);
  const agendaSchedule = useAgendaSchedule();

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

  useEffect(() => {
    if (!currentArea || agendaSchedule.loading) return;
    fetchNext();
  }, [currentArea, agendaSchedule.loading, agendaSchedule.schedule]);

  async function loadScheduleFallback() {
    const eventSelectFallbacks = [
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id, target_user_id",
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id",
      "id, event_date, linked_lesson_id, title, type, area, community",
      "id, event_date, linked_lesson_id, title, type, area",
    ];

    let events: any[] = [];
    for (const selectClause of eventSelectFallbacks) {
      const result = await supabase
        .from("events")
        .select(selectClause)
        .not("linked_lesson_id", "is", null)
        .order("event_date");
      if (!result.error) {
        events = result.data ?? [];
        break;
      }
    }

    if (events.length === 0) return [];

    const [{ data: lessons }, { data: courses }] = await Promise.all([
      supabase.from("lessons").select("id, title, order_num, course_id"),
      supabase.from("courses").select("id, title, order_num"),
    ]);

    const lessonMap = new Map((lessons ?? []).map((lesson: any) => [lesson.id, lesson]));
    const courseMap = new Map((courses ?? []).map((course: any) => [course.id, course]));
    const isManager = role === "admin" || role === "lider";

    return events
      .filter((event: any) => {
        if (!event.linked_lesson_id) return false;
        if (event.target_user_id && event.target_user_id !== user?.id) return false;
        if (event.area && currentArea && event.area !== currentArea) return false;
        if (event.turma_id && profile?.turma_id && event.turma_id !== profile.turma_id) return false;
        if (event.turma_id && !profile?.turma_id) return false;
        const isConfirmatorio = event.type === "confirmatorio";
        if (event.community && !isManager && !isConfirmatorio && event.community !== profile?.community) return false;
        return true;
      })
      .map((event: any) => {
        const lesson = lessonMap.get(event.linked_lesson_id);
        if (!lesson) return null;
        const course = courseMap.get(lesson.course_id);
        if (!course) return null;
        const eventDate = new Date(event.event_date);
        const devotionalDates = [];
        const current = new Date(eventDate);
        current.setHours(0, 0, 0, 0);
        current.setDate(current.getDate() - 1);
        while (devotionalDates.length < 10) {
          if (current.getDay() !== 0 && current.getDay() !== 6) {
            devotionalDates.unshift(new Date(current));
          }
          current.setDate(current.getDate() - 1);
        }
        return {
          eventId: event.id,
          eventDate,
          eventTitle: event.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonOrder: lesson.order_num,
          courseId: course.id,
          courseTitle: course.title,
          courseOrder: course.order_num,
          windowStart: devotionalDates[0],
          devotionalDates,
          releasedDayNumbers: null,
          autoLimited: false,
          devotionalMode: "10_days" as const,
        };
      })
      .filter(Boolean);
  }

  async function fetchNext() {
    const effectiveSchedule = agendaSchedule.schedule.length > 0
      ? agendaSchedule.schedule
      : await loadScheduleFallback();

    if (effectiveSchedule.length === 0) {
      setNoSchedule(true);
      setLoading(false);
      return;
    }
    setNoSchedule(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: responses }, { data: devContent }, { data: devProgress }] = await Promise.all([
      supabase.from("lesson_responses").select("lesson_id").eq("user_id", user.id),
      supabase.from("devotional_content").select("id, lesson_id, day_number, title, bible_reference").not("lesson_id", "is", null),
      supabase.from("devotional_progress").select("devotional_id").eq("user_id", user.id),
    ]);

    const studiedLessons = new Set((responses ?? []).map(r => r.lesson_id));
    const completedDevIds = new Set((devProgress ?? []).map(p => p.devotional_id));

    const devsByLesson: Record<string, typeof devContent> = {};
    (devContent ?? []).forEach(d => {
      if (!d.lesson_id) return;
      if (!devsByLesson[d.lesson_id]) devsByLesson[d.lesson_id] = [];
      devsByLesson[d.lesson_id]!.push(d);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const actionableEntries = effectiveSchedule.filter(
      (entry) => today >= entry.windowStart && now < entry.eventDate
    );

    // Iterate through currently active schedule entries only.
    // Past events should not override the next upcoming teaching in this card.
    for (const entry of actionableEntries) {

      const lessonId = entry.lessonId;

      // Check devotionals first, independent of lesson study status
      const allLessonDevs = (devsByLesson[lessonId] ?? []).sort((a, b) => a.day_number - b.day_number);
      const lessonDevs = allLessonDevs
        .filter((dev) => !entry.releasedDayNumbers || entry.releasedDayNumbers.includes(dev.day_number));

      // In 5_days mode, primary devs missed in week 1 get recovery dates from devotionalDates[5+]
      const is5days = entry.devotionalMode === "5_days";
      const primaryDevs = is5days ? lessonDevs.filter(d => d.day_number <= 5) : lessonDevs;
      const missedPrimary = is5days
        ? primaryDevs.filter(d => {
            const pd = new Date(entry.devotionalDates[d.day_number - 1]);
            pd.setHours(0, 0, 0, 0);
            return !completedDevIds.has(d.id) && pd < today;
          })
        : [];

      // Build a map of devId → release date (primary or recovery)
      const devReleaseDateMap = new Map<string, Date>();
      lessonDevs.forEach((dev, i) => {
        const primaryDate = entry.devotionalDates[is5days ? dev.day_number - 1 : i];
        if (primaryDate) devReleaseDateMap.set(dev.id, primaryDate);
      });
      // Override with recovery dates for missed primary devs
      missedPrimary.forEach((dev, i) => {
        const recoveryDate = entry.devotionalDates[5 + i];
        if (recoveryDate) devReleaseDateMap.set(dev.id, recoveryDate);
      });

      const isWeekend = today.getDay() === 0 || today.getDay() === 6;

      // Missed devs = uncompleted, scheduled on a past weekday (Mon–Fri)
      const missedCurrentWeekDevs = lessonDevs.filter((dev) => {
        if (completedDevIds.has(dev.id)) return false;
        if (is5days && dev.day_number > 5) return false;
        const devDate = devReleaseDateMap.get(dev.id);
        if (!devDate) return false;
        const nd = new Date(devDate);
        nd.setHours(0, 0, 0, 0);
        const dow = nd.getDay();
        return nd < today && dow >= 1 && dow <= 5;
      });

      // Today's devotional: uncompleted dev whose scheduled date is exactly today
      const todaysDev = (() => {
        for (const dev of lessonDevs) {
          if (completedDevIds.has(dev.id)) continue;
          if (is5days && dev.day_number > 5) continue;
          const devDate = devReleaseDateMap.get(dev.id);
          if (!devDate) continue;
          const nd = new Date(devDate);
          nd.setHours(0, 0, 0, 0);
          if (nd.getTime() === today.getTime()) return dev;
        }
        return null;
      })();

      // Next future devotional: first uncompleted dev whose date is strictly after today
      let nextFutureDev: typeof lessonDevs[number] | null = null;
      let nextFutureDate: Date | null = null;
      for (const dev of lessonDevs) {
        if (completedDevIds.has(dev.id)) continue;
        if (is5days && dev.day_number > 5) continue;
        const devDate = devReleaseDateMap.get(dev.id);
        if (!devDate) continue;
        const nd = new Date(devDate);
        nd.setHours(0, 0, 0, 0);
        if (nd > today) {
          nextFutureDev = dev;
          nextFutureDate = nd;
          break;
        }
      }

      // Priority 1: show today's devotional
      if (todaysDev) {
        const completedCount = lessonDevs.filter(d => completedDevIds.has(d.id)).length;
        setNextItem({
          type: "devotional",
          lessonId,
          title: todaysDev.title || `Devocional ${todaysDev.day_number}`,
          subtitle: todaysDev.bible_reference || "",
          courseTitle: entry.courseTitle,
          courseOrder: entry.courseOrder,
          lessonOrder: entry.lessonOrder,
          devotionalDay: todaysDev.day_number,
          totalDevotionals: lessonDevs.length,
          completedDevotionals: completedCount,
          eventDate: entry.eventDate,
        });
        setLoading(false);
        return;
      }

      // Priority 2 (weekend only): show first missed weekday dev as recoverable
      if (isWeekend && missedCurrentWeekDevs.length > 0) {
        const missedDev = missedCurrentWeekDevs[0];
        const completedCount = lessonDevs.filter(d => completedDevIds.has(d.id)).length;
        setNextItem({
          type: "devotional",
          lessonId,
          title: missedDev.title || `Devocional ${missedDev.day_number}`,
          subtitle: missedDev.bible_reference || "",
          courseTitle: entry.courseTitle,
          courseOrder: entry.courseOrder,
          lessonOrder: entry.lessonOrder,
          devotionalDay: missedDev.day_number,
          totalDevotionals: lessonDevs.length,
          completedDevotionals: completedCount,
          eventDate: entry.eventDate,
        });
        setLoading(false);
        return;
      }

      const eventDay = new Date(entry.eventDate);
      eventDay.setHours(0, 0, 0, 0);
      if (!studiedLessons.has(lessonId) && today >= eventDay) {
        setNextItem({
          type: "lesson",
          title: `Licao ${entry.lessonOrder}: ${entry.lessonTitle}`,
          subtitle: "Estude esta licao para avancar na jornada",
          lessonId,
          courseTitle: entry.courseTitle,
          courseOrder: entry.courseOrder,
          lessonOrder: entry.lessonOrder,
          eventDate: entry.eventDate,
        });
        setLoading(false);
        return;
      }

      // No devotional available today — show when the next one opens
      if (nextFutureDev && nextFutureDate) {
        const completedCount = lessonDevs.filter(d => completedDevIds.has(d.id)).length;
        setNextItem({
          type: "waiting_devotional",
          lessonId,
          title: nextFutureDev.title || `Devocional ${nextFutureDev.day_number}`,
          subtitle: isWeekend && missedCurrentWeekDevs.length > 0
            ? "Neste fim de semana, os devocionais atrasados da semana ficam liberados para recuperacao."
            : isWeekend
            ? "Voce concluiu os devocionais da semana. O proximo sera liberado na proxima data da agenda."
            : `O proximo devocional desta licao sera liberado em ${format(nextFutureDate, "d 'de' MMMM", { locale: ptBR })}.`,
          courseTitle: entry.courseTitle,
          courseOrder: entry.courseOrder,
          lessonOrder: entry.lessonOrder,
          devotionalDay: nextFutureDev.day_number,
          totalDevotionals: lessonDevs.length,
          completedDevotionals: completedCount,
          eventDate: entry.eventDate,
          nextReleaseDate: nextFutureDate,
        });
        setLoading(false);
        return;
      }
    }

    // Check for future scheduled events
    const futureEntry = effectiveSchedule.find(e => today < e.windowStart);
    if (futureEntry) {
      setNextItem(null);
      setNoSchedule(false);
      setLoading(false);
      return;
    }

    setNextItem(null);
    setLoading(false);
  }

  if (loading || agendaSchedule.loading) {
    return (
      <div className="px-5 pt-5">
        <div className="h-48 rounded-3xl bg-muted animate-pulse" />
      </div>
    );
  }

  // No events scheduled — waiting message
  if (noSchedule) {
    return (
      <div className="px-5 pt-5">
        <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
          <div className="bg-gradient-orange px-5 py-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PROXIMA ETAPA</span>
          </div>
          <div className="p-5 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-montserrat font-bold text-foreground text-base">Aguardando programacao</p>
            <p className="text-muted-foreground font-inter text-sm mt-1">
              Seu lider ainda nao agendou os proximos estudos. Fique atento a agenda!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!nextItem) {
    // Check if there's a future event window not yet open
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureEntry = agendaSchedule.schedule.find(e => today < e.windowStart);
    if (futureEntry) {
      return (
        <div className="px-5 pt-5">
          <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
            <div className="bg-gradient-orange px-5 py-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
              <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PROXIMA ETAPA</span>
            </div>
            <div className="p-5 text-center">
              <span className="text-3xl block mb-2">Aguardando</span>
              <p className="font-montserrat font-bold text-foreground text-base">
                Proximo estudo: {futureEntry.lessonTitle}
              </p>
              <p className="text-muted-foreground font-inter text-sm mt-1">
                Os devocionais serao liberados a partir de{" "}
                <span className="font-semibold text-foreground">
                  {format(futureEntry.windowStart, "d 'de' MMMM", { locale: ptBR })}
                </span>
              </p>
              <p className="text-muted-foreground font-inter text-xs mt-2">
                Encontro: {format(futureEntry.eventDate, "d 'de' MMMM 'as' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-5 pt-5">
        <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
          <div className="bg-gradient-orange px-5 py-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PROXIMA ETAPA</span>
          </div>
          <div className="p-5 text-center">
            <span className="text-4xl block mb-3">Tudo pronto</span>
            <p className="font-montserrat font-bold text-foreground text-base">Tudo em dia!</p>
            <p className="text-muted-foreground font-inter text-sm mt-1">Voce completou todas as etapas disponiveis. Parabens!</p>
          </div>
        </div>
      </div>
    );
  }

  const isDevotional = nextItem.type !== "lesson";
  const isWaitingDevotional = nextItem.type === "waiting_devotional";
  const devPct = nextItem.totalDevotionals && nextItem.totalDevotionals > 0
    ? Math.round(((nextItem.completedDevotionals ?? 0) / nextItem.totalDevotionals) * 100)
    : 0;
  const handleOpenNextItem = () => {
    if (isWaitingDevotional) {
      onNavigateToDiscipulado();
      return;
    }
    window.dispatchEvent(new CustomEvent("navigate-to-lesson", {
      detail: {
        lessonId: nextItem.lessonId,
        mode: isDevotional ? "devotional" : "choice",
      },
    }));
    onNavigateToDiscipulado();
  };

  return (
    <div className="px-5 pt-5">
      <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
        {/* Header */}
        <div className="bg-gradient-orange px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PROXIMA ETAPA</span>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
            <Clock className="w-3 h-3 text-primary-foreground" />
            <span className="text-primary-foreground text-xs font-inter">{timeLeft}</span>
          </div>
        </div>

        <div className="p-5">
          {/* Course context */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[10px] font-inter font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
              Curso {nextItem.courseOrder} - {nextItem.courseTitle}
            </span>
            <span className="text-[10px] font-inter text-muted-foreground">
              - Licao {nextItem.lessonOrder}
            </span>
          </div>

          {/* Event date badge */}
          {nextItem.eventDate && (
            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
              <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="font-inter text-[10px] text-primary font-medium">
                Encontro: {format(nextItem.eventDate, "d 'de' MMMM 'as' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Content */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg ${
              isDevotional || isWaitingDevotional ? "bg-gradient-orange shadow-secondary/30" : "bg-primary shadow-primary/30"
            }`}>
              {isDevotional || isWaitingDevotional ? <BookOpen className="w-7 h-7 text-primary-foreground" /> : <GraduationCap className="w-7 h-7 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-[10px] font-inter mb-0.5 uppercase tracking-wide">
                {isDevotional ? `Devocional - Dia ${nextItem.devotionalDay}` : "Estudo de Licao"}
              </p>
              <h2 className="font-montserrat font-black text-card-foreground text-lg leading-tight">
                {nextItem.title}
              </h2>
              {nextItem.subtitle && (
                <p className="text-muted-foreground text-sm font-inter mt-0.5">{nextItem.subtitle}</p>
              )}
            </div>
          </div>

          {/* Devotional progress */}
          {(isDevotional || isWaitingDevotional) && nextItem.totalDevotionals && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground text-xs font-inter">
                  {nextItem.completedDevotionals}/{nextItem.totalDevotionals} devocionais desta licao
                </span>
                <span className="text-xs font-montserrat font-bold text-secondary">{devPct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-orange rounded-full transition-all duration-700" style={{ width: `${devPct}%` }} />
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleOpenNextItem}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-montserrat font-black text-sm text-primary-foreground bg-gradient-orange shadow-xl shadow-secondary/40 active:scale-95 transition-all"
          >
            {isDevotional ? "FAZER DEVOCIONAL ->" : "ESTUDAR LICAO ->"}
          </button>
        </div>
      </div>
    </div>
  );
}
