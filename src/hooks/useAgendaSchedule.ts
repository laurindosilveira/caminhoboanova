import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";

export type ScheduleEntry = {
  eventId: string;
  eventDate: Date;
  eventTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonOrder: number;
  courseId: string;
  courseTitle: string;
  courseOrder: number;
  windowStart: Date;
  /** 10 business-day dates before event. [0..4] = primary week, [5..9] = recovery week. */
  devotionalDates: Date[];
  /** Day numbers the leader chose to release. null = all released. */
  releasedDayNumbers: number[] | null;
  /** True when this event is < 10 calendar days from the previous one (auto-limit to 5 devotionals). */
  autoLimited: boolean;
  /** '5_days' = 5 devotionals with recovery week; '10_days' = 10 devotionals full window. */
  devotionalMode: "5_days" | "10_days";
};

/**
 * Returns N business days before a given date, in chronological order.
 */
export function getBusinessDaysBefore(date: Date, count: number): Date[] {
  const days: Date[] = [];
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - 1);
  while (days.length < count) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      days.unshift(new Date(current));
    }
    current.setDate(current.getDate() - 1);
  }
  return days;
}

function startOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function useAgendaSchedule() {
  const { profile, role, user } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    fetchSchedule();

    const channelName = `agenda-events-realtime:${currentArea}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        fetchSchedule();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentArea, profile]);

  async function fetchSchedule() {
    setLoading(true);

    const eventSelectFallbacks = [
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id, target_user_id, released_devotional_days",
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id, released_devotional_days",
      "id, event_date, linked_lesson_id, title, type, area, community, released_devotional_days",
      "id, event_date, linked_lesson_id, title, type, area, released_devotional_days",
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id, target_user_id",
      "id, event_date, linked_lesson_id, title, type, area, community, turma_id",
      "id, event_date, linked_lesson_id, title, type, area, community",
      "id, event_date, linked_lesson_id, title, type, area",
    ];

    let eventsResult: any = null;
    for (const selectClause of eventSelectFallbacks) {
      const result = await supabase
        .from("events")
        .select(selectClause)
        .not("linked_lesson_id", "is", null)
        .order("event_date") as any;

      if (!result.error) {
        eventsResult = result;
        break;
      }
    }

    if (!eventsResult) {
      eventsResult = {
        data: null,
        error: { message: "useAgendaSchedule: failed to load events with all fallbacks" },
      };
    }

    let lessonsResult = await supabase
      .from("lessons")
      .select("id, title, order_num, course_id, devotional_mode")
      .order("order_num");

    if (lessonsResult.error && /devotional_mode/i.test(lessonsResult.error.message)) {
      lessonsResult = await supabase
        .from("lessons")
        .select("id, title, order_num, course_id")
        .order("order_num");
    }

    const { data: courses } = await supabase
      .from("courses")
      .select("id, title, order_num")
      .order("order_num");

    const events = eventsResult.data;
    const eventsError = eventsResult.error;
    const lessons = lessonsResult.data;

    if (eventsError) {
      console.error("useAgendaSchedule: failed to load events", eventsError.message);
      setSchedule([]);
      setLoading(false);
      return;
    }

    if (lessonsResult.error) {
      console.error("useAgendaSchedule: failed to load lessons", lessonsResult.error.message);
      setSchedule([]);
      setLoading(false);
      return;
    }

    const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l]));
    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

    const entries: ScheduleEntry[] = [];
    const isManager = role === "admin" || role === "lider";

    for (const event of events ?? []) {
      if (!event.linked_lesson_id) continue;
      if ((event as any).target_user_id && (event as any).target_user_id !== user?.id) continue;
      if (event.area && currentArea && event.area !== currentArea) continue;
      if ((event as any).turma_id && profile?.turma_id && (event as any).turma_id !== profile.turma_id) continue;
      if ((event as any).turma_id && !profile?.turma_id) continue;
      const isConfirmatorio = event.type === "confirmatorio";
      if (event.community && !isManager && !isConfirmatorio && event.community !== profile?.community) continue;

      const lesson = lessonMap.get(event.linked_lesson_id);
      if (!lesson) continue;
      const course = courseMap.get(lesson.course_id);
      if (!course) continue;

      const rawDate = event.event_date as string;
      const eventDate = new Date(rawDate.includes("T") ? rawDate : `${rawDate}T12:00:00`);

      const devotionalDates = getBusinessDaysBefore(eventDate, 10);
      const windowStart = devotionalDates[0];

      const prevEntry = entries[entries.length - 1];
      const autoLimited = prevEntry
        ? Math.round((eventDate.getTime() - prevEntry.eventDate.getTime()) / 86400000) < 10
        : false;

      const rawReleased: number[] | null = (event as any).released_devotional_days ?? null;
      let releasedDayNumbers: number[] | null;
      if (autoLimited) {
        const base = rawReleased ?? null;
        releasedDayNumbers = base ? base.filter((d) => d <= 5) : [1, 2, 3, 4, 5];
      } else {
        releasedDayNumbers = rawReleased;
      }

      const devotionalMode: "5_days" | "10_days" =
        (lesson as any).devotional_mode === "5_days" ? "5_days" : "10_days";

      entries.push({
        eventId: event.id,
        eventDate,
        eventTitle: event.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonOrder: lesson.order_num,
        courseId: course.id,
        courseTitle: course.title,
        courseOrder: course.order_num,
        windowStart,
        devotionalDates,
        releasedDayNumbers,
        autoLimited,
        devotionalMode,
      });
    }

    setSchedule(entries);
    setLoading(false);
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const releasedLessonIds = new Set<string>();
  const studyOpenLessonIds = new Set<string>();
  const lateAccessLessonIds = new Set<string>();
  const lessonDevotionalDates = new Map<string, Date[]>();
  const lessonEventDate = new Map<string, Date>();
  const lessonReleasedDays = new Map<string, number[] | null>();
  const lessonDevotionalMode = new Map<string, "5_days" | "10_days">();

  for (const entry of schedule) {
    const eventDay = startOfLocalDay(entry.eventDate);
    if (today >= eventDay) releasedLessonIds.add(entry.lessonId);
    if (now >= entry.eventDate) lateAccessLessonIds.add(entry.lessonId);
    lessonDevotionalDates.set(entry.lessonId, entry.devotionalDates);
    lessonEventDate.set(entry.lessonId, entry.eventDate);
    lessonReleasedDays.set(entry.lessonId, entry.releasedDayNumbers);
    lessonDevotionalMode.set(entry.lessonId, entry.devotionalMode);
  }

  const currentOpenEntry = schedule.find((e) => today >= e.windowStart && now < e.eventDate);
  if (currentOpenEntry) studyOpenLessonIds.add(currentOpenEntry.lessonId);

  const scheduledLessonIds = new Set(schedule.map((e) => e.lessonId));
  const nextScheduledEvent = schedule.find((e) => e.eventDate >= now) ?? null;
  const currentEntry = schedule.find((e) => today >= e.windowStart && e.eventDate >= now) ?? null;

  return {
    schedule,
    loading,
    releasedLessonIds,
    studyOpenLessonIds,
    lateAccessLessonIds,
    scheduledLessonIds,
    lessonDevotionalDates,
    lessonEventDate,
    lessonReleasedDays,
    lessonDevotionalMode,
    nextScheduledEvent,
    currentEntry,
    hasScheduledEvents: schedule.length > 0,
    refetch: fetchSchedule,
  };
}
