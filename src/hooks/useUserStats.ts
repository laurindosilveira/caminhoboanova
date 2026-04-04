import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserStats = {
  faithPoints: number;
  faithLevel: number;
  streakDays: number;
  faithEnergy: number;
  completedCount: number;
  nextActivity: { id: string; type: string; title: string; subtitle: string | null; points: number } | null;
  totalActivities: number;
  loading: boolean;
};

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates.map(d => d.split("T")[0]))].sort((a, b) => b.localeCompare(a));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let check = new Date(today);

  for (const dateStr of unique) {
    const d = new Date(dateStr + "T00:00:00");
    const diff = Math.round((check.getTime() - d.getTime()) / 86400000);
    if (diff === 0 || diff === 1) {
      streak++;
      check = d;
    } else {
      break;
    }
  }
  return streak;
}

function calculateLevel(points: number, thresholds: number[]): number {
  // thresholds = [level2, level3, level4, level5]
  if (points >= thresholds[3]) return 5;
  if (points >= thresholds[2]) return 4;
  if (points >= thresholds[1]) return 3;
  if (points >= thresholds[0]) return 2;
  return 1;
}

function calculateEnergy(dates: string[]): number {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = dates.filter(d => new Date(d) >= sevenDaysAgo);
  return Math.min(5, recent.length);
}

export function useUserStats(currentArea?: string): UserStats {
  const [stats, setStats] = useState<UserStats>({
    faithPoints: 0,
    faithLevel: 1,
    streakDays: 0,
    faithEnergy: 0,
    completedCount: 0,
    nextActivity: null,
    totalActivities: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStats(s => ({ ...s, loading: false })); return; }

      const [
        { data: activities },
        { data: progress },
        { data: devProgress },
        { data: lessonResponses },
        { data: attendance },
        { data: worshipData },
        { data: achievementUnlocks },
        { data: coursesData },
        { data: lessonsData },
        { data: challengeData },
        { data: gameConfig },
      ] = await Promise.all([
        supabase.from("activities").select("id, type, title, subtitle, order_num, points").order("order_num"),
        supabase.from("user_progress").select("activity_id, completed_at").eq("user_id", user.id),
        supabase.from("devotional_progress").select("devotional_id, completed_at, is_recovery").eq("user_id", user.id),
        supabase.from("lesson_responses").select("lesson_id").eq("user_id", user.id),
        supabase.from("attendance").select("event_id, status").eq("user_id", user.id),
        supabase.from("worship_attendance").select("id, status").eq("user_id", user.id).eq("status", "aprovado"),
        supabase.from("achievement_unlocks").select("achievement_key, bonus_points").eq("user_id", user.id),
        supabase.from("courses").select("id"),
        supabase.from("lessons").select("id, course_id"),
        supabase.from("challenge_participants").select("id, completed").eq("user_id", user.id).eq("completed", true),
        supabase.rpc("get_game_config" as any),
      ]);

      // Carrega configuração dinâmica com fallback nos defaults
      const cfgMap = new Map<string, number>((gameConfig ?? []).map((r: any) => [r.key, Number(r.value)]));
      const cfg = {
        lessonPoints:          cfgMap.get("lesson_points")             ?? 20,
        devotionalPoints:      cfgMap.get("devotional_points")         ?? 5,
        devotionalWeekendPts:  cfgMap.get("devotional_weekend_points") ?? 2,
        devotionalRecoveryPts: cfgMap.get("devotional_recovery_points") ?? 2,
        attendancePoints:      cfgMap.get("attendance_points")         ?? 10,
        worshipPoints:         cfgMap.get("worship_points")            ?? 5,
        courseBonus:           cfgMap.get("course_completion_bonus")   ?? 100,
        challengePoints:       cfgMap.get("challenge_points")          ?? 15,
      };
      const levelThresholds = [
        cfgMap.get("level_2_threshold") ?? 20,
        cfgMap.get("level_3_threshold") ?? 60,
        cfgMap.get("level_4_threshold") ?? 100,
        cfgMap.get("level_5_threshold") ?? 200,
      ];

      const acts = activities ?? [];
      const prog = progress ?? [];
      const devProg = devProgress ?? [];
      const completedIds = new Set(prog.map(p => p.activity_id));
      const allDates = [
        ...prog.map(p => p.completed_at),
        ...devProg.map(p => p.completed_at),
      ];

      // Pontos de atividades legadas
      const activityPoints = acts
        .filter(a => completedIds.has(a.id) && a.type !== "devocional" && a.type !== "formacao" && a.type !== "encontro")
        .reduce((sum, a) => sum + (a.points ?? 0), 0);

      // Pontos de devocionais: recovery = valor reduzido, fim de semana = weekendPts, normal = devotionalPoints
      const devotionalPoints = devProg.reduce((sum, dp: any) => {
        if (dp.is_recovery) return sum + cfg.devotionalRecoveryPts;
        const dow = new Date(dp.completed_at).getDay();
        return sum + (dow === 0 || dow === 6 ? cfg.devotionalWeekendPts : cfg.devotionalPoints);
      }, 0);

      const completedLessonIds = new Set((lessonResponses ?? []).map(r => r.lesson_id));
      const lessonStudyPoints = completedLessonIds.size * cfg.lessonPoints;
      const attendancePoints = (attendance ?? []).filter(a => a.status === "presente").length * cfg.attendancePoints;
      const worshipPoints = (worshipData ?? []).length * cfg.worshipPoints;
      const achievementBonusPoints = (achievementUnlocks ?? []).reduce((sum, a) => sum + (a.bonus_points ?? 0), 0);
      const challengePoints = (challengeData ?? []).length * cfg.challengePoints;

      // Bônus por curso completo
      let courseBonusPoints = 0;
      const allLessons = lessonsData ?? [];
      (coursesData ?? []).forEach(course => {
        const courseLessons = allLessons.filter(l => l.course_id === course.id);
        if (courseLessons.length > 0 && courseLessons.every(l => completedLessonIds.has(l.id))) {
          courseBonusPoints += cfg.courseBonus;
        }
      });

      const faithPoints = activityPoints + devotionalPoints + lessonStudyPoints + attendancePoints + worshipPoints + achievementBonusPoints + courseBonusPoints + challengePoints;

      const faithLevel = calculateLevel(faithPoints, levelThresholds);
      const streakDays = calculateStreak(allDates);
      const faithEnergy = calculateEnergy(allDates);
      const completedCount = completedIds.size;

      const nextActivity = acts.find(a => !completedIds.has(a.id)) ?? null;

      setStats({
        faithPoints,
        faithLevel,
        streakDays,
        faithEnergy,
        completedCount,
        nextActivity,
        totalActivities: acts.length,
        loading: false,
      });
    }
    fetchStats();
  }, [currentArea]);

  return stats;
}
