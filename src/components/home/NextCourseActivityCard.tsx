import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Clock, ChevronRight, BookOpen, GraduationCap, CalendarDays } from "lucide-react";
import { useAgendaSchedule } from "@/hooks/useAgendaSchedule";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type NextItem = {
  type: "lesson" | "devotional";
  title: string;
  subtitle: string;
  courseTitle: string;
  courseOrder: number;
  lessonOrder: number;
  devotionalDay?: number;
  totalDevotionals?: number;
  completedDevotionals?: number;
  eventDate?: Date;
};

export default function NextCourseActivityCard({ onNavigateToDiscipulado }: { onNavigateToDiscipulado: () => void }) {
  const { profile } = useAuth();
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
    if (!profile?.area || agendaSchedule.loading) return;
    fetchNext();
  }, [profile?.area, agendaSchedule.loading, agendaSchedule.schedule]);

  async function fetchNext() {
    if (!agendaSchedule.hasScheduledEvents) {
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

    // Iterate through schedule entries to find next action
    for (const entry of agendaSchedule.schedule) {
      // Skip entries whose window hasn't opened yet
      if (today < entry.windowStart) continue;

      const lessonId = entry.lessonId;

      // If lesson not studied yet → study it
      if (!studiedLessons.has(lessonId)) {
        setNextItem({
          type: "lesson",
          title: `Lição ${entry.lessonOrder}: ${entry.lessonTitle}`,
          subtitle: "Estude esta lição para avançar na jornada",
          courseTitle: entry.courseTitle,
          courseOrder: entry.courseOrder,
          lessonOrder: entry.lessonOrder,
          eventDate: entry.eventDate,
        });
        setLoading(false);
        return;
      }

      // Lesson studied — check devotionals
      const lessonDevs = (devsByLesson[lessonId] ?? []).sort((a, b) => a.day_number - b.day_number);
      const devDates = entry.devotionalDates;

      for (let i = 0; i < lessonDevs.length; i++) {
        const dev = lessonDevs[i];
        if (completedDevIds.has(dev.id)) continue;

        // Check if this devotional is released (today >= its scheduled date)
        const devDate = devDates[i];
        if (devDate && today >= devDate) {
          const completedCount = lessonDevs.filter(d => completedDevIds.has(d.id)).length;
          setNextItem({
            type: "devotional",
            title: dev.title || `Devocional ${dev.day_number}`,
            subtitle: dev.bible_reference || "",
            courseTitle: entry.courseTitle,
            courseOrder: entry.courseOrder,
            lessonOrder: entry.lessonOrder,
            devotionalDay: dev.day_number,
            totalDevotionals: lessonDevs.length,
            completedDevotionals: completedCount,
            eventDate: entry.eventDate,
          });
          setLoading(false);
          return;
        }
      }
      // All devotionals done or future for this entry, continue
    }

    // Check for future scheduled events
    const futureEntry = agendaSchedule.schedule.find(e => today < e.windowStart);
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
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PRÓXIMA ETAPA</span>
          </div>
          <div className="p-5 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-montserrat font-bold text-foreground text-base">Aguardando programação</p>
            <p className="text-muted-foreground font-inter text-sm mt-1">
              Seu líder ainda não agendou os próximos estudos. Fique atento à agenda! 📅
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
              <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PRÓXIMA ETAPA</span>
            </div>
            <div className="p-5 text-center">
              <span className="text-3xl block mb-2">⏳</span>
              <p className="font-montserrat font-bold text-foreground text-base">
                Próximo estudo: {futureEntry.lessonTitle}
              </p>
              <p className="text-muted-foreground font-inter text-sm mt-1">
                Os devocionais serão liberados a partir de{" "}
                <span className="font-semibold text-foreground">
                  {format(futureEntry.windowStart, "d 'de' MMMM", { locale: ptBR })}
                </span>
              </p>
              <p className="text-muted-foreground font-inter text-xs mt-2">
                📅 Encontro: {format(futureEntry.eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
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
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PRÓXIMA ETAPA</span>
          </div>
          <div className="p-5 text-center">
            <span className="text-4xl block mb-3">🎉</span>
            <p className="font-montserrat font-bold text-foreground text-base">Tudo em dia!</p>
            <p className="text-muted-foreground font-inter text-sm mt-1">Você completou todas as etapas disponíveis. Parabéns!</p>
          </div>
        </div>
      </div>
    );
  }

  const isDevotional = nextItem.type === "devotional";
  const devPct = nextItem.totalDevotionals && nextItem.totalDevotionals > 0
    ? Math.round(((nextItem.completedDevotionals ?? 0) / nextItem.totalDevotionals) * 100)
    : 0;

  return (
    <div className="px-5 pt-5">
      <div className="rounded-3xl shadow-xl border border-border overflow-hidden bg-card">
        {/* Header */}
        <div className="bg-gradient-orange px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            <span className="font-montserrat font-bold text-primary-foreground text-sm tracking-wide">SUA PRÓXIMA ETAPA</span>
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
              Curso {nextItem.courseOrder} — {nextItem.courseTitle}
            </span>
            <span className="text-[10px] font-inter text-muted-foreground">
              · Lição {nextItem.lessonOrder}
            </span>
          </div>

          {/* Event date badge */}
          {nextItem.eventDate && (
            <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
              <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="font-inter text-[10px] text-primary font-medium">
                Encontro: {format(nextItem.eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}

          {/* Content */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-lg ${
              isDevotional ? "bg-gradient-orange shadow-secondary/30" : "bg-primary shadow-primary/30"
            }`}>
              {isDevotional ? <BookOpen className="w-7 h-7 text-primary-foreground" /> : <GraduationCap className="w-7 h-7 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-muted-foreground text-[10px] font-inter mb-0.5 uppercase tracking-wide">
                {isDevotional ? `Devocional · Dia ${nextItem.devotionalDay}` : "Estudo de Lição"}
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
          {isDevotional && nextItem.totalDevotionals && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground text-xs font-inter">
                  {nextItem.completedDevotionals}/{nextItem.totalDevotionals} devocionais desta lição
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
            onClick={onNavigateToDiscipulado}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-montserrat font-black text-sm text-primary-foreground bg-gradient-orange shadow-xl shadow-secondary/40 active:scale-95 transition-all"
          >
            {isDevotional ? "FAZER DEVOCIONAL →" : "ESTUDAR LIÇÃO →"}
          </button>
        </div>
      </div>
    </div>
  );
}
