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
  devotionalDates: Date[]; // business-day release dates indexed by devotional day_number - 1
  /** Day numbers the leader chose to release. null = all released. */
  releasedDayNumbers: number[] | null;
  /** True when this event is < 10 calendar days from the previous one (auto-limit to 5 devotionals). */
  autoLimited: boolean;
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

export function useAgendaSchedule() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    fetchSchedule();

    // Use a unique channel name per area to avoid stale channel reuse
    const channelName = `agenda-events-realtime:${currentArea}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => { fetchSchedule(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentArea, profile]);

  async function fetchSchedule() {
    setLoading(true);
    let eventsQuery = supabase
      .from("events")
      .select("id, event_date, linked_lesson_id, title, type, area, released_devotional_days")
      .eq("type", "confirmatorio")
      .not("linked_lesson_id", "is", null)
      .order("event_date");

    const [{ data: events }, { data: lessons }, { data: courses }] = await Promise.all([
      eventsQuery,
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
      supabase.from("courses").select("id, title, order_num").order("order_num"),
    ]);

    const lessonMap = new Map((lessons ?? []).map(l => [l.id, l]));
    const courseMap = new Map((courses ?? []).map(c => [c.id, c]));

    const entries: ScheduleEntry[] = [];
    for (const event of (events ?? [])) {
      if (!event.linked_lesson_id) continue;
      if (event.area && currentArea && event.area !== currentArea) continue;
      const lesson = lessonMap.get(event.linked_lesson_id);
      if (!lesson) continue;
      const course = courseMap.get(lesson.course_id);
      if (!course) continue;

      // Parse date safely: if the string has no time component, appending T12:00:00
      // avoids UTC-midnight being interpreted as the previous day in UTC-3 (Brazil).
      const rawDate = event.event_date as string;
      const eventDate = new Date(rawDate.includes("T") ? rawDate : rawDate + "T12:00:00");
      const businessDays = getBusinessDaysBefore(eventDate, 10);
      const windowStart = businessDays[0];
      // Keep the full business-day window so lessons with 6+ devotionals
      // can continue releasing on the following week before the event.
      const devotionalDates = businessDays;

      // Auto-limit: if this event is < 10 calendar days from the previous one,
      // cap released devotionals at day numbers 1–5.
      const prevEntry = entries[entries.length - 1];
      const autoLimited = prevEntry
        ? Math.round((eventDate.getTime() - prevEntry.eventDate.getTime()) / 86400000) < 10
        : false;

      // Leader-selected release days (null = all)
      const rawReleased: number[] | null = (event as any).released_devotional_days ?? null;

      let releasedDayNumbers: number[] | null;
      if (autoLimited) {
        // Keep only days 1–5 even if leader selected more
        const base = rawReleased ?? null;
        releasedDayNumbers = base ? base.filter(d => d <= 5) : [1, 2, 3, 4, 5];
      } else {
        releasedDayNumbers = rawReleased;
      }

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
      });
    }

    setSchedule(entries);
    setLoading(false);
  }

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Which lessons are "released" (window is open)
  const releasedLessonIds = new Set<string>();
  // Which lessons have study available (from first devotional until 1 day before event)
  const studyOpenLessonIds = new Set<string>();
  // Lessons where event has already passed — accessible but 0 points
  const lateAccessLessonIds = new Set<string>();
  const lessonDevotionalDates = new Map<string, Date[]>();
  const lessonEventDate = new Map<string, Date>();
  const lessonReleasedDays = new Map<string, number[] | null>();

  for (const entry of schedule) {
    if (today >= entry.windowStart) {
      releasedLessonIds.add(entry.lessonId);
    }
    if (now >= entry.eventDate) {
      lateAccessLessonIds.add(entry.lessonId);
    }
    lessonDevotionalDates.set(entry.lessonId, entry.devotionalDates);
    lessonEventDate.set(entry.lessonId, entry.eventDate);
    lessonReleasedDays.set(entry.lessonId, entry.releasedDayNumbers);
  }

  // Only the single earliest upcoming lesson with an open window is study-open.
  const currentOpenEntry = schedule.find(e => today >= e.windowStart && now < e.eventDate);
  if (currentOpenEntry) {
    studyOpenLessonIds.add(currentOpenEntry.lessonId);
  }

  const scheduledLessonIds = new Set(schedule.map(e => e.lessonId));
  const nextScheduledEvent = schedule.find(e => e.eventDate >= now) ?? null;
  const currentEntry = schedule.find(e => today >= e.windowStart && e.eventDate >= now) ?? null;

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
    nextScheduledEvent,
    currentEntry,
    hasScheduledEvents: schedule.length > 0,
    refetch: fetchSchedule,
  };
}
