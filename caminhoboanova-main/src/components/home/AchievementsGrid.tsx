import { useEffect, useState, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Lock, Flame, RefreshCw, Share2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import GameRulesDialog from "./GameRulesDialog";
import PlayerDetailSheet from "./PlayerDetailSheet";

interface AchievementsGridProps {
  faithPoints: number;
  streakDays: number;
  completedCount: number;
}

type Achievement = {
  id: number;
  key: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  current: number;
  target: number;
  secret?: boolean;
  bonusPoints: number;
};

type Winner = { position: number; user_id: string; full_name: string; faith_points: number; medal: string };
type RankingSeason = { id: string; course_id: string; community: string; closed_at: string; winners: Winner[]; total_participants: number };

interface RankingMember {
  user_id: string;
  full_name: string;
  completed_count: number;
  faith_points: number;
}

export default function AchievementsGrid({ faithPoints, streakDays, completedCount }: AchievementsGridProps) {
  const { profile, role } = useAuth();
  const canManage = role === "admin" || role === "lider";
  const myUserId = profile?.user_id;
  const [seasons, setSeasons] = useState<RankingSeason[]>([]);
  const [members, setMembers] = useState<RankingMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [celebrationFired, setCelebrationFired] = useState(false);
  const winnerBannerRef = useRef<HTMLDivElement>(null);
  const [devCount, setDevCount] = useState(0);
  const [worshipCount, setWorshipCount] = useState(0);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [prayerCount, setPrayerCount] = useState(0);
  const [isApto, setIsApto] = useState(false);
  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [totalLessons, setTotalLessons] = useState(0);
  const [totalDevotionals, setTotalDevotionals] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [lessonStudyCount, setLessonStudyCount] = useState(0);
  const [activityPoints, setActivityPoints] = useState(0);
  const [achievementBonus, setAchievementBonus] = useState(0);
  const [biweeklyStreakDone, setBiweeklyStreakDone] = useState(false);
  const [biweeklyProgress, setBiweeklyProgress] = useState({ devsDone: 0, devsTotal: 0, studyDone: false, attendanceDone: false });
  const [selectedPlayer, setSelectedPlayer] = useState<{ userId: string; fullName: string } | null>(null);
  const [resettingGame, setResettingGame] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fireCelebration = useCallback(() => {
    if (celebrationFired) return;
    const seasonIds = seasons.map(s => s.id).sort().join(",");
    const storageKey = `celebration_seen_${myUserId}_${seasonIds}`;
    if (localStorage.getItem(storageKey)) return;

    setCelebrationFired(true);
    localStorage.setItem(storageKey, "true");

    const end = Date.now() + 2500;
    const colors = ["#FFD700", "#FFA500", "#FF6347", "#9b59b6", "#3498db"];

    (function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [celebrationFired, seasons, myUserId]);

  useEffect(() => {
    if (!profile) return;
    async function fetchSeasons() {
      const { data } = await supabase
        .from("ranking_seasons")
        .select("*")
        .eq("community", profile!.community as string);
      setSeasons((data ?? []) as unknown as RankingSeason[]);
    }
    async function fetchRanking() {
      setLoadingMembers(true);
      const { data } = await supabase.rpc("get_community_ranking", {
        _community: profile!.community as any,
      });
      setMembers((data ?? []) as RankingMember[]);
      setLoadingMembers(false);
    }
    fetchSeasons();
    fetchRanking();
    // Fetch qualitative data
    async function fetchQualitative() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
      const [{ count: devC }, { count: worC }, { data: attD }, { count: chatC }, { count: prayerC }, { data: planData }, { data: existingUnlocks }, { count: totalLessonsC }, { count: totalDevsC }, { count: totalEventsC }, { data: lessonResps }, { data: allActs }, { data: userProg }, { data: achUnlocks },
        // Biweekly streak data
        { data: recentEvents }, { data: recentAttendance }, { data: recentDevContent }, { data: recentDevProgress }, { data: recentLessonResps },
      ] = await Promise.all([
        supabase.from("devotional_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("worship_attendance").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "aprovado"),
        supabase.from("attendance").select("event_id").eq("user_id", user.id).eq("status", "presente"),
        supabase.from("community_chat").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("prayer_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("discipleship_plans").select("aptidao").eq("user_id", user.id).limit(1),
        supabase.from("achievement_unlocks").select("achievement_key").eq("user_id", user.id),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("devotional_content").select("id", { count: "exact", head: true }),
        supabase.from("events").select("id", { count: "exact", head: true }).gte("event_date", new Date(Date.now() - 90 * 86400000).toISOString()).or(`area.eq.${profile!.area},area.is.null`),
        supabase.from("lesson_responses").select("lesson_id").eq("user_id", user.id),
        supabase.from("activities").select("id, points"),
        supabase.from("user_progress").select("activity_id").eq("user_id", user.id),
        supabase.from("achievement_unlocks").select("bonus_points").eq("user_id", user.id),
        // Biweekly: events in last 15 days for user's area
        supabase.from("events").select("id, linked_lesson_id").gte("event_date", fifteenDaysAgo).or(`area.eq.${profile!.area},area.is.null`),
        supabase.from("attendance").select("event_id, status").eq("user_id", user.id).eq("status", "presente"),
        // Devotionals linked to lessons that have events in last 15 days
        supabase.from("devotional_content").select("id, lesson_id").not("lesson_id", "is", null),
        supabase.from("devotional_progress").select("devotional_id, completed_at").eq("user_id", user.id).gte("completed_at", fifteenDaysAgo),
        supabase.from("lesson_responses").select("lesson_id, created_at").eq("user_id", user.id).gte("created_at", fifteenDaysAgo),
      ]);
      setDevCount(devC ?? 0);
      setWorshipCount(worC ?? 0);
      setAttendanceCount((attD ?? []).length);
      setChatCount(chatC ?? 0);
      setPrayerCount(prayerC ?? 0);
      setIsApto(planData?.[0]?.aptidao === "apto");
      setUnlockedKeys(new Set((existingUnlocks ?? []).map(u => u.achievement_key)));
      setTotalLessons(totalLessonsC ?? 0);
      setTotalDevotionals(totalDevsC ?? 0);
      setTotalEvents(totalEventsC ?? 0);
      setLessonStudyCount(new Set((lessonResps ?? []).map(r => r.lesson_id)).size);
      
      const completedActIds = new Set((userProg ?? []).map(p => p.activity_id));
      const actPts = (allActs ?? []).filter(a => completedActIds.has(a.id)).reduce((s, a) => s + (a.points ?? 0), 0);
      setActivityPoints(actPts);
      setAchievementBonus((achUnlocks ?? []).reduce((s, a) => s + (a.bonus_points ?? 0), 0));

      // Calculate biweekly streak
      const recentEventIds = (recentEvents ?? []).map(e => e.id);
      const recentEventLessonIds = (recentEvents ?? []).filter(e => e.linked_lesson_id).map(e => e.linked_lesson_id!);
      const attendedEventIds = new Set((recentAttendance ?? []).map(a => a.event_id));
      const attendedAllRecentEvents = recentEventIds.length > 0 && recentEventIds.every(id => attendedEventIds.has(id));

      // Devotionals from lessons linked to recent events
      const recentDevCompletedIds = new Set((recentDevProgress ?? []).map(p => p.devotional_id));
      const devsForRecentLessons = (recentDevContent ?? []).filter(d => d.lesson_id && recentEventLessonIds.includes(d.lesson_id));
      const allRecentDevsDone = devsForRecentLessons.length > 0 && devsForRecentLessons.every(d => recentDevCompletedIds.has(d.id));
      const recentDevsCompleted = devsForRecentLessons.filter(d => recentDevCompletedIds.has(d.id)).length;

      // Check if any devotional was completed on a weekend (catch-up) — breaks perfect streak
      const hasWeekendCatchUp = (recentDevProgress ?? []).some(p => {
        const d = new Date(p.completed_at);
        const dow = d.getDay();
        return dow === 0 || dow === 6;
      });

      // Lesson study for recent event lessons
      const recentStudiedLessons = new Set((recentLessonResps ?? []).map(r => r.lesson_id));
      const allRecentLessonsStudied = recentEventLessonIds.length > 0 && recentEventLessonIds.every(id => recentStudiedLessons.has(id));

      // Biweekly streak: must have all done AND no weekend catch-ups
      const streakComplete = recentEventIds.length > 0 && attendedAllRecentEvents && allRecentDevsDone && allRecentLessonsStudied && !hasWeekendCatchUp;
      setBiweeklyStreakDone(streakComplete);
      setBiweeklyProgress({
        devsDone: recentDevsCompleted,
        devsTotal: devsForRecentLessons.length,
        studyDone: allRecentLessonsStudied,
        attendanceDone: attendedAllRecentEvents,
      });
      setBiweeklyProgress({
        devsDone: recentDevsCompleted,
        devsTotal: devsForRecentLessons.length,
        studyDone: allRecentLessonsStudied,
        attendanceDone: attendedAllRecentEvents,
      });
    }
    fetchQualitative();
  }, [profile]);

  const achievements: Achievement[] = [
    { id: 1, key: "streak_7", icon: "🔥", title: "7 dias seguidos", desc: "Sequência de fé incrível!", unlocked: streakDays >= 7, current: streakDays, target: 7, bonusPoints: 10 },
    { id: 2, key: "first_activity", icon: "📖", title: "Primeiros passos", desc: "Completou sua 1ª atividade!", unlocked: completedCount >= 1, current: completedCount, target: 1, bonusPoints: 10 },
    { id: 3, key: "activities_5", icon: "🎓", title: "5 atividades", desc: "Comprometido com a jornada!", unlocked: completedCount >= 5, current: completedCount, target: 5, bonusPoints: 10 },
    { id: 4, key: "points_100", icon: "⭐", title: "100 pontos da fé", desc: "Crescendo sempre!", unlocked: faithPoints >= 100, current: faithPoints, target: 100, bonusPoints: 10 },
    { id: 5, key: "activities_10", icon: "🏆", title: "10 atividades", desc: "Dedicação exemplar!", unlocked: completedCount >= 10, current: completedCount, target: 10, bonusPoints: 10 },
    { id: 6, key: "points_200", icon: "💎", title: "200 pontos", desc: "Nível máximo de fé!", unlocked: faithPoints >= 200, current: faithPoints, target: 200, bonusPoints: 10 },
    { id: 9, key: "dev_10", icon: "❤️", title: "Oração contínua", desc: "10 devocionais completos", unlocked: devCount >= 10, current: devCount, target: 10, bonusPoints: 10 },
    { id: 10, key: "attendance_5", icon: "🤝", title: "Serviço fiel", desc: "5 presenças em encontros", unlocked: attendanceCount >= 5, current: attendanceCount, target: 5, bonusPoints: 10 },
    { id: 11, key: "dev_20", icon: "📖", title: "Leitura bíblica", desc: "20 devocionais completos", unlocked: devCount >= 20, current: devCount, target: 20, bonusPoints: 10 },
    { id: 12, key: "worship_5", icon: "⛪", title: "Adorador", desc: "5 cultos confirmados", unlocked: worshipCount >= 5, current: worshipCount, target: 5, bonusPoints: 10 },
    { id: 13, key: "attendance_3", icon: "👥", title: "Participou do encontro", desc: "3 presenças em encontros", unlocked: attendanceCount >= 3, current: attendanceCount, target: 3, bonusPoints: 10 },
    { id: 14, key: "chat_5", icon: "🎤", title: "Compartilhou testemunho", desc: "5 mensagens no chat", unlocked: chatCount >= 5, current: chatCount, target: 5, bonusPoints: 10 },
    { id: 15, key: "prayer_3", icon: "🙏", title: "Intercessor", desc: "3 pedidos de oração", unlocked: prayerCount >= 3, current: prayerCount, target: 3, bonusPoints: 10 },
    { id: 16, key: "chat_20", icon: "💬", title: "Voz ativa", desc: "20 mensagens no chat", unlocked: chatCount >= 20, current: chatCount, target: 20, bonusPoints: 10 },
    { id: 18, key: "biweekly_streak", icon: "🏅", title: "Quinzena perfeita", desc: "Completou estudo, devocionais e presença nos últimos 15 dias!", unlocked: biweeklyStreakDone, current: biweeklyStreakDone ? 1 : 0, target: 1, bonusPoints: 30 },
    { id: 7, key: "streak_14", icon: "🛡️", title: "Guardião da Fé", desc: "14 dias seguidos de dedicação!", unlocked: streakDays >= 14, current: streakDays, target: 14, secret: true, bonusPoints: 25 },
    { id: 8, key: "streak_30", icon: "👁️‍🗨️", title: "Constância Invisível", desc: "30 dias seguidos — lendário!", unlocked: streakDays >= 30, current: streakDays, target: 30, secret: true, bonusPoints: 25 },
    { id: 17, key: "apto", icon: "✝️", title: "Pronto para a Profissão de Fé", desc: "Seu pastor confirmou: você está pronto!", unlocked: isApto, current: isApto ? 1 : 0, target: 1, secret: true, bonusPoints: 50 },
  ];

  // Track newly unlocked for animation
  const [newlyUnlockedKeys, setNewlyUnlockedKeys] = useState<Set<string>>(new Set());

  // Auto-save newly unlocked achievements
  useEffect(() => {
    async function saveNewUnlocks() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || unlockedKeys.size === 0 && achievements.every(a => !a.unlocked)) return;

      const newlyUnlocked = achievements.filter(a => a.unlocked && !unlockedKeys.has(a.key));
      if (newlyUnlocked.length === 0) return;

      // Track for animation
      setNewlyUnlockedKeys(new Set(newlyUnlocked.map(a => a.key)));

      for (const a of newlyUnlocked) {
        await supabase.from("achievement_unlocks").insert({
          user_id: user.id,
          achievement_key: a.key,
          bonus_points: a.bonusPoints,
        });
      }

      setUnlockedKeys(prev => {
        const next = new Set(prev);
        newlyUnlocked.forEach(a => next.add(a.key));
        return next;
      });

      const totalBonus = newlyUnlocked.reduce((s, a) => s + a.bonusPoints, 0);
      toast.success(`🏆 ${newlyUnlocked.length} conquista${newlyUnlocked.length > 1 ? "s" : ""} desbloqueada${newlyUnlocked.length > 1 ? "s" : ""}! +${totalBonus} pts bônus`, {
        description: newlyUnlocked.map(a => `${a.icon} ${a.title}`).join(" · "),
        duration: 5000,
      });

      // Fire confetti for unlock
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });

      // Clear animation state after delay
      setTimeout(() => setNewlyUnlockedKeys(new Set()), 3000);
    }
    saveNewUnlocks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faithPoints, streakDays, completedCount, devCount, worshipCount, attendanceCount, chatCount, prayerCount, isApto]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  async function shareAchievement(achievement: Achievement) {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 600, 400);
    grad.addColorStop(0, "#1F3C88");
    grad.addColorStop(1, "#E8880A");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, 600, 400, 20);
    ctx.fill();

    // Dark overlay
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, 600, 400);

    // Icon
    ctx.font = "80px serif";
    ctx.textAlign = "center";
    ctx.fillText(achievement.icon, 300, 150);

    // Title
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(achievement.title, 300, 220);

    // Description
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(achievement.desc, 300, 260);

    // Points
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`+${achievement.bonusPoints} pts bônus`, 300, 310);

    // App name
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Caminho — Profissão de Fé", 300, 370);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "conquista.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: `Conquista: ${achievement.title}`,
            text: `${achievement.icon} Desbloqueei "${achievement.title}" no Caminho! ${achievement.desc}`,
            files: [file],
          });
        } catch {
          // User cancelled
        }
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "conquista.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Imagem da conquista baixada!");
      }
    }, "image/png");
  }

  async function handleResetGame() {
    setResettingGame(true);
    const userIds = members.map(m => m.user_id);
    if (userIds.length === 0) {
      toast.error("Nenhum membro encontrado.");
      setResettingGame(false);
      setShowResetConfirm(false);
      return;
    }
    try {
      await Promise.all([
        supabase.from("user_progress").delete().in("user_id", userIds),
        supabase.from("lesson_responses").delete().in("user_id", userIds),
        supabase.from("devotional_progress").delete().in("user_id", userIds),
        supabase.from("achievement_unlocks").delete().in("user_id", userIds),
        supabase.from("attendance").delete().in("user_id", userIds),
        supabase.from("worship_attendance").delete().in("user_id", userIds),
      ]);
      toast.success(`✅ Pontuações resetadas para ${userIds.length} participantes!`);
      const { data } = await supabase.rpc("get_community_ranking", { _community: profile!.community as any });
      setMembers((data ?? []) as RankingMember[]);
    } catch (err: any) {
      toast.error("Erro ao resetar: " + (err.message ?? ""));
    }
    setResettingGame(false);
    setShowResetConfirm(false);
  }

  return (
    <div className="px-5 pt-2 pb-4 space-y-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-montserrat font-black text-foreground text-xl">🏆 Conquistas</h2>
        <div className="flex items-center gap-2">
          <GameRulesDialog breakdown={{
            lessonStudyCount,
            devotionalCount: devCount,
            attendanceCount,
            worshipCount,
            activityPoints,
            achievementBonus,
            totalLessons,
            totalDevotionals,
            totalEvents,
          }} />
          <span className="text-xs font-inter text-muted-foreground bg-muted rounded-full px-3 py-1">
            {unlockedCount}/{achievements.length}
          </span>
        </div>
      </div>

      {/* Winner Banner */}
      {seasons.length > 0 && (() => {
        const myWins = seasons.flatMap(s =>
          ((s.winners ?? []) as Winner[]).filter(w => w.user_id === myUserId).map(w => ({ ...w, season: s }))
        );
        if (myWins.length === 0) return null;
        return (
          <div ref={winnerBannerRef}>
            {myWins.map((win, idx) => (
              <div key={idx} className="rounded-2xl p-5 text-center border border-accent/30 shadow-lg mb-3 animate-scale-in relative overflow-hidden"
                style={{ background: "var(--gradient-gold)" }}
                onAnimationEnd={() => fireCelebration()}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)", backgroundSize: "200% 100%", animation: "shimmer 2s ease-in-out infinite" }} />
                <span className="text-5xl block mb-2 drop-shadow-lg animate-float">{win.medal}</span>
                <p className="font-montserrat font-black text-foreground text-lg">🎉 Parabéns, Campeão! 🎉</p>
                <p className="font-inter text-sm text-foreground/80 mt-1">
                  Você ficou em <strong>{win.position}º lugar</strong> com <strong>{win.faith_points} pontos</strong>!
                </p>
                <p className="font-inter text-xs text-muted-foreground mt-2">
                  Ranking encerrado em {new Date(win.season.closed_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Closed Season Podiums */}
      {seasons.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-accent-foreground" />
            <span className="font-montserrat font-bold text-foreground text-sm">🏆 Pódio Final</span>
          </div>
          {seasons.map(s => (
            <div key={s.id} className="bg-card rounded-2xl border border-accent/20 overflow-hidden shadow-sm mb-3">
              <div className="px-4 py-2.5 bg-accent/10 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="font-montserrat font-bold text-foreground text-xs">Ranking encerrado</span>
                <span className="text-[10px] font-inter text-muted-foreground ml-auto">
                  {new Date(s.closed_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="p-4 space-y-2">
                {((s.winners ?? []) as Winner[]).map(w => (
                  <div key={w.user_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${w.user_id === myUserId ? "bg-accent/10 ring-1 ring-accent/30" : "bg-muted/30"}`}>
                    <span className="text-2xl">{w.medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-montserrat font-bold text-foreground text-sm">
                        {w.full_name} {w.user_id === myUserId && <span className="text-accent-foreground text-xs font-inter">(você!)</span>}
                      </p>
                    </div>
                    <span className="font-montserrat font-black text-accent-foreground text-sm">{w.faith_points} pts</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-border">
                <p className="text-muted-foreground font-inter text-[10px]">{s.total_participants} participantes</p>
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Ranking da Turma */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-secondary" />
            <span className="font-montserrat font-bold text-foreground text-sm">Ranking da turma</span>
          </div>
          {canManage && (
            <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-[10px] font-inter font-bold hover:bg-destructive/20 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Resetar
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl max-w-sm">
                <AlertDialogHeader>
                  <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                    <AlertTriangle className="w-7 h-7 text-destructive" />
                  </div>
                  <AlertDialogTitle className="text-center font-montserrat font-black text-lg">
                    ⚠️ Resetar pontuações?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center font-inter text-sm">
                    Isso vai <strong className="text-destructive font-bold">zerar permanentemente</strong> o progresso de <strong>{members.length} participantes</strong> da comunidade. Esta ação <strong className="text-destructive font-bold">não pode ser desfeita</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
                  <AlertDialogCancel className="flex-1 rounded-xl font-montserrat font-bold">
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetGame}
                    disabled={resettingGame}
                    className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-montserrat font-bold gap-1.5"
                  >
                    <RefreshCw className={`w-4 h-4 ${resettingGame ? "animate-spin" : ""}`} />
                    {resettingGame ? "Resetando..." : "Sim, resetar tudo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {loadingMembers ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-16 animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <p className="text-muted-foreground text-sm font-inter">Nenhum participante encontrado.</p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {members.map((m, i) => {
              const isMe = m.user_id === myUserId;
              const initials = m.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              const clickable = canManage && !isMe;
              return (
                <div
                  key={m.user_id}
                  onClick={() => clickable && setSelectedPlayer({ userId: m.user_id, fullName: m.full_name })}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i < members.length - 1 ? "border-b border-border" : ""
                  } ${isMe ? "bg-primary/5" : ""} ${clickable ? "cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors" : ""}`}
                >
                  <div className="w-7 flex-shrink-0 text-center">
                    {medal ? (
                      <span className="text-lg">{medal}</span>
                    ) : (
                      <span className="font-montserrat font-black text-muted-foreground text-sm">#{i + 1}</span>
                    )}
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-montserrat font-black text-sm text-primary-foreground flex-shrink-0 ${isMe ? "bg-gradient-orange" : "bg-primary"}`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-card-foreground text-sm">
                      {m.full_name} {isMe && <span className="text-secondary text-xs font-inter">(você)</span>}
                    </p>
                    <p className="text-muted-foreground text-xs font-inter">{Number(m.completed_count)} atividades · {Number(m.faith_points)} pts</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-montserrat font-black text-accent text-sm">{Number(m.faith_points)} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence>
          {achievements.filter(a => !a.secret || a.unlocked).map((a, idx) => {
            const isNewlyUnlocked = newlyUnlockedKeys.has(a.key);
            const progressPct = Math.min(100, (a.current / a.target) * 100);

            return (
              <motion.div
                key={a.id}
                initial={isNewlyUnlocked ? { scale: 0.5, opacity: 0, rotateY: 180 } : { opacity: 1 }}
                animate={isNewlyUnlocked
                  ? { scale: [0.5, 1.15, 1], opacity: 1, rotateY: [180, 0] }
                  : { opacity: 1 }
                }
                transition={isNewlyUnlocked
                  ? { duration: 0.7, ease: "easeOut", times: [0, 0.6, 1] }
                  : { duration: 0.3, delay: idx * 0.05 }
                }
                className={`rounded-2xl p-4 border transition-all ${
                  a.unlocked
                    ? a.secret
                      ? "bg-card border-amber-400/40 shadow-lg ring-1 ring-amber-400/20"
                      : "bg-card border-accent/30 shadow-md"
                    : "bg-muted border-border opacity-60"
                } ${isNewlyUnlocked ? "ring-2 ring-secondary ring-offset-2" : ""}`}
              >
                <span className="text-3xl block mb-2">{a.unlocked ? a.icon : "🔒"}</span>
                <p className="font-montserrat font-bold text-card-foreground text-sm leading-tight">
                  {a.secret && a.unlocked && <span className="text-amber-500 text-[10px] font-inter block mb-0.5">✨ SURPRESA!</span>}
                  {a.title}
                </p>
                <p className="text-muted-foreground text-xs font-inter mt-1">{a.desc}</p>
                {a.unlocked ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${a.secret ? "bg-amber-500" : "bg-brand-green"}`} />
                      <span className={`text-xs font-inter ${a.secret ? "text-amber-500" : "text-brand-green"}`}>
                        +{a.bonusPoints} pts bônus
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        shareAchievement(a);
                      }}
                      className="flex items-center gap-1 text-[10px] font-inter font-semibold text-secondary hover:text-secondary/80 transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      Compartilhar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground text-[10px] font-inter font-semibold">
                        {a.current}/{a.target}
                      </span>
                      <span className="text-muted-foreground text-[10px] font-inter">
                        {Math.round(progressPct)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted-foreground/15 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        className="h-full rounded-full bg-secondary/50"
                      />
                    </div>
                    <p className="text-muted-foreground text-[10px] font-inter mt-1">
                      Faltam {Math.max(0, a.target - a.current)}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Placeholder para conquistas secretas não desbloqueadas */}
        {achievements.filter(a => a.secret && !a.unlocked).length > 0 && (
          <div className="rounded-2xl p-4 border border-dashed border-amber-400/30 bg-amber-400/5 flex flex-col items-center justify-center text-center col-span-2">
            <span className="text-3xl mb-2">❓</span>
            <p className="font-montserrat font-bold text-foreground/60 text-sm">Conquistas secretas</p>
            <p className="text-muted-foreground text-[10px] font-inter mt-1">
              {achievements.filter(a => a.secret && !a.unlocked).length} conquista{achievements.filter(a => a.secret && !a.unlocked).length > 1 ? "s" : ""} escondida{achievements.filter(a => a.secret && !a.unlocked).length > 1 ? "s" : ""} — continue sua jornada!
            </p>
          </div>
        )}
      </div>

      {/* Player detail sheet */}
      {selectedPlayer && (
        <PlayerDetailSheet
          userId={selectedPlayer.userId}
          fullName={selectedPlayer.fullName}
          onClose={() => setSelectedPlayer(null)}
          onPointsChanged={async () => {
            const { data } = await supabase.rpc("get_community_ranking", { _community: profile!.community as any });
            setMembers((data ?? []) as RankingMember[]);
          }}
        />
      )}
    </div>
  );
}
