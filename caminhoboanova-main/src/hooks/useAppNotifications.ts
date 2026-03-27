import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isNotificationEnabled, sendNotification } from "@/lib/notifications";

const NOTIF_SENT_PREFIX = "caminho_notif_sent_";
const NOTIF_RUN_KEY = "caminho_notif_run_today";

function wasSentToday(key: string): boolean {
  const last = localStorage.getItem(NOTIF_SENT_PREFIX + key);
  return last === new Date().toDateString();
}

function wasRunToday(): boolean {
  return localStorage.getItem(NOTIF_RUN_KEY) === new Date().toDateString();
}

function markRunToday() {
  localStorage.setItem(NOTIF_RUN_KEY, new Date().toDateString());
}

function markSentToday(key: string) {
  localStorage.setItem(NOTIF_SENT_PREFIX + key, new Date().toDateString());
}

/**
 * Hook that checks user activity and sends relevant push notifications
 * every time the app is opened (once per day max).
 * No more setTimeout-based scheduler — that doesn't work when the PWA is closed.
 */
export function useAppNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!isNotificationEnabled()) return;
    // Only run once per calendar day, but always run on fresh day
    if (wasRunToday()) return;

    async function checkAndNotify() {
      // 1. Load notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      // If no prefs saved or master disabled, skip
      if (prefs && !prefs.master_enabled) return;

      // Default all on if no record exists
      const devocionalOn = prefs ? prefs.devocional : true;
      const eventosOn = prefs ? prefs.eventos : true;
      const streakOn = prefs ? prefs.streak : true;
      const mensagensOn = prefs ? prefs.mensagens : true;

      // Run checks in parallel
      const checks: Promise<void>[] = [];

      // --- DEVOCIONAL check ---
      if (devocionalOn && !wasSentToday("devocional")) {
        checks.push(checkDevocional());
      }

      // --- STREAK check ---
      if (streakOn && !wasSentToday("streak")) {
        checks.push(checkStreak());
      }

      // --- EVENTOS check ---
      if (eventosOn && !wasSentToday("eventos")) {
        checks.push(checkUpcomingEvents());
      }

      // --- MENSAGENS check ---
      if (mensagensOn && !wasSentToday("mensagens")) {
        checks.push(checkNewMessages());
      }

      // --- LESSON COMPLETION celebration ---
      if (!wasSentToday("lesson_complete")) {
        checks.push(checkLessonCompletion());
      }

      await Promise.allSettled(checks);
      markRunToday();
    }

    // Small delay so the app has time to render
    const timer = setTimeout(checkAndNotify, 2000);
    return () => clearTimeout(timer);
  }, [user]);
}

async function checkDevocional() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase.from("profiles").select("area").eq("user_id", user.id).maybeSingle();
    const userArea = profileData?.area;

    const [{ data: lessons }, { data: devs }, { data: prog }, { data: unlocks }] = await Promise.all([
      supabase.from("lessons").select("id, title, order_num, course_id").order("order_num"),
      supabase.from("devotional_content").select("id, lesson_id"),
      supabase.from("devotional_progress").select("devotional_id").eq("user_id", user.id),
      supabase.from("course_unlocks").select("course_id").eq("area", userArea ?? ""),
    ]);

    const unlockedCourseIds = new Set((unlocks ?? []).map(u => u.course_id));
    const completedSet = new Set((prog ?? []).map((p) => p.devotional_id));

    // Group devotionals by lesson
    const lessonDevMap: Record<string, { total: number; completed: number }> = {};
    (devs ?? []).forEach((d) => {
      if (!d.lesson_id) return;
      if (!lessonDevMap[d.lesson_id]) lessonDevMap[d.lesson_id] = { total: 0, completed: 0 };
      lessonDevMap[d.lesson_id].total++;
      if (completedSet.has(d.id)) lessonDevMap[d.lesson_id].completed++;
    });

    // Find first accessible lesson with pending devotionals
    const accessibleLessons = (lessons ?? []).filter((l) => unlockedCourseIds.has(l.course_id));
    for (const l of accessibleLessons) {
      const info = lessonDevMap[l.id];
      if (info && info.completed < info.total) {
        const pending = info.total - info.completed;
        await sendNotification(
          "📖 Devocional pendente!",
          `Você tem ${pending} devocional${pending > 1 ? "is" : ""} da Lição ${l.order_num} esperando. Não perca sua caminhada!`
        );
        markSentToday("devocional");
        return;
      }
    }
  } catch (err) {
    console.warn("Devocional notification check failed", err);
  }
}

async function checkStreak() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prog }, { data: devProg }] = await Promise.all([
      supabase.from("user_progress").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(1),
      supabase.from("devotional_progress").select("completed_at").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(1),
    ]);

    const dates: Date[] = [];
    if (prog?.[0]?.completed_at) dates.push(new Date(prog[0].completed_at));
    if (devProg?.[0]?.completed_at) dates.push(new Date(devProg[0].completed_at));

    if (dates.length === 0) return; // Never active, don't nag

    const lastActivity = new Date(Math.max(...dates.map((d) => d.getTime())));
    const diffDays = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);

    if (diffDays >= 2) {
      const msg = diffDays >= 5
        ? `Sua chama está se apagando! Já são ${diffDays} dias sem atividade. Volte e reacenda seu coração! 🔥`
        : `Não perca sua sequência! Já são ${diffDays} dias sem atividade. Um devocional por dia faz toda a diferença! 💪`;

      await sendNotification("🔥 Sequência em risco!", msg);
      markSentToday("streak");
    }
  } catch (err) {
    console.warn("Streak notification check failed", err);
  }
}

async function checkUpcomingEvents() {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const { data } = await supabase
      .from("events")
      .select("title, event_date, location")
      .gte("event_date", now.toISOString())
      .lte("event_date", tomorrow.toISOString())
      .order("event_date")
      .limit(1);

    if (data && data.length > 0) {
      const ev = data[0];
      const evDate = new Date(ev.event_date);
      const isToday = evDate.toDateString() === now.toDateString();
      const timeStr = evDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const dayLabel = isToday ? "hoje" : "em breve";

      await sendNotification(
        `📅 Evento ${dayLabel}!`,
        `${ev.title} às ${timeStr}${ev.location ? ` • 📍 ${ev.location}` : ""}`
      );
      markSentToday("eventos");
    }
  } catch (err) {
    console.warn("Events notification check failed", err);
  }
}

async function checkNewMessages() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check for messages from the last 24h
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data, count } = await supabase
      .from("messages")
      .select("title", { count: "exact" })
      .gte("created_at", since)
      .limit(1);

    if (count && count > 0) {
      await sendNotification(
        "📢 Novo aviso no app!",
        "Você tem um novo comunicado. Abra o app para conferir!"
      );
      markSentToday("mensagens");
    }
  } catch (err) {
    console.warn("Messages notification check failed", err);
  }
}

async function checkLessonCompletion() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user completed all responses for any lesson in the last 24h
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: recentResponses } = await supabase
      .from("lesson_responses")
      .select("lesson_id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since);

    if (!recentResponses || recentResponses.length === 0) return;

    // Get unique lesson IDs from recent responses
    const recentLessonIds = [...new Set(recentResponses.map(r => r.lesson_id))];

    // Get lesson info
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, order_num")
      .in("id", recentLessonIds);

    if (!lessons || lessons.length === 0) return;

    // Check devotionals completion for these lessons
    const { data: devs } = await supabase
      .from("devotional_content")
      .select("id, lesson_id")
      .in("lesson_id", recentLessonIds);

    const { data: devProg } = await supabase
      .from("devotional_progress")
      .select("devotional_id")
      .eq("user_id", user.id);

    const completedDevIds = new Set((devProg ?? []).map(p => p.devotional_id));

    // Check each recent lesson for full completion
    for (const lesson of lessons) {
      const lessonDevs = (devs ?? []).filter(d => d.lesson_id === lesson.id);
      const allDevsCompleted = lessonDevs.length === 0 || lessonDevs.every(d => completedDevIds.has(d.id));

      if (allDevsCompleted) {
        await sendNotification(
          "🎉 Lição concluída!",
          `Parabéns! Você completou a Lição ${lesson.order_num}: ${lesson.title}. Continue firme na caminhada! 🙌`
        );
        markSentToday("lesson_complete");
        return;
      }
    }
  } catch (err) {
    console.warn("Lesson completion notification check failed", err);
  }
}
