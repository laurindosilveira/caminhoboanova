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
  devotionalDates: Date[]; // 5 dates for devotional days 1..5
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
    if (profile) fetchSchedule();
  }, [currentArea]);

  // Realtime subscription for events changes
  useEffect(() => {
    const channel = supabase
      .channel('agenda-events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          if (profile) fetchSchedule();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentArea]);

  async function fetchSchedule() {
    setLoading(true);
    let eventsQuery = supabase.from("events").select("id, event_date, linked_lesson_id, title, type, area")
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
      // Filter by user's area: show events with no area or matching area
      if (event.area && currentArea && event.area !== currentArea) continue;
      const lesson = lessonMap.get(event.linked_lesson_id);
      if (!lesson) continue;
      const course = courseMap.get(lesson.course_id);
      if (!course) continue;

      const eventDate = new Date(event.event_date);
      const businessDays = getBusinessDaysBefore(eventDate, 10);
      const windowStart = businessDays[0];
      const devotionalDates = businessDays.slice(0, 5);

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
      });
    }

    setSchedule(entries);
    setLoading(false);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Which lessons are "released" (window is open)
  const releasedLessonIds = new Set<string>();
  // Which lessons have study available (from first devotional until 1 day before event)
  const studyOpenLessonIds = new Set<string>();
  // Lessons where event has already passed — accessible but 0 points
  const lateAccessLessonIds = new Set<string>();
  const lessonDevotionalDates = new Map<string, Date[]>();
  const lessonEventDate = new Map<string, Date>();

  for (const entry of schedule) {
    if (today >= entry.windowStart) {
      releasedLessonIds.add(entry.lessonId);
    }
    const eventDay = new Date(entry.eventDate);
    eventDay.setHours(0, 0, 0, 0);
    if (today >= entry.windowStart && today < eventDay) {
      // Study is open from windowStart until the day BEFORE the event
      studyOpenLessonIds.add(entry.lessonId);
    } else if (today >= eventDay) {
      // After event day: late access (no points)
      lateAccessLessonIds.add(entry.lessonId);
    }
    lessonDevotionalDates.set(entry.lessonId, entry.devotionalDates);
    lessonEventDate.set(entry.lessonId, entry.eventDate);
  }

  // All scheduled lesson IDs (regardless of window)
  const scheduledLessonIds = new Set(schedule.map(e => e.lessonId));

  // Next upcoming scheduled event (window open or future)
  const nextScheduledEvent = schedule.find(e => e.eventDate >= today) ?? null;

  // Current active entry = next one with window open
  const currentEntry = schedule.find(e => today >= e.windowStart && e.eventDate >= today) ?? null;

  return {
    schedule,
    loading,
    releasedLessonIds,
    studyOpenLessonIds,
    lateAccessLessonIds,
    scheduledLessonIds,
    lessonDevotionalDates,
    lessonEventDate,
    nextScheduledEvent,
    currentEntry,
    hasScheduledEvents: schedule.length > 0,
    refetch: fetchSchedule,
  };
}
