import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { Trophy, Flame, BookOpen, Users, Heart, Target } from "lucide-react";

interface CommunityStats {
  totalDevotionals: number;
  totalAttendance: number;
  totalMembers: number;
  totalChallengesCompleted: number;
  streakDays: number;
}

export default function CommunityAchievements() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentArea) fetchStats();
  }, [currentArea]);

  async function fetchStats() {
    setLoading(true);
    // Get member IDs from the selected area so admins see updated numbers when switching
    const { data: members } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("area", currentArea as any);

    const memberIds = (members ?? []).map(m => m.user_id);
    if (memberIds.length === 0) {
      setStats({ totalDevotionals: 0, totalAttendance: 0, totalMembers: 0, totalChallengesCompleted: 0, streakDays: 0 });
      setLoading(false);
      return;
    }

    const [devResult, attResult, challengeResult] = await Promise.all([
      supabase.from("devotional_progress").select("id, completed_at").in("user_id", memberIds),
      supabase.from("attendance").select("id").in("user_id", memberIds).eq("status", "presente"),
      supabase.from("challenge_participants").select("id").in("user_id", memberIds).eq("completed", true),
    ]);

    // Calculate community streak: consecutive days where at least 1 member did a devotional
    const devDates = new Set(
      (devResult.data ?? []).map(d => new Date(d.completed_at).toISOString().split("T")[0])
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const day = checkDate.getDay();
      if (day === 0 || day === 6) continue; // skip weekends
      const dateStr = checkDate.toISOString().split("T")[0];
      if (devDates.has(dateStr)) {
        streak++;
      } else {
        break;
      }
    }

    setStats({
      totalDevotionals: devResult.data?.length ?? 0,
      totalAttendance: attResult.data?.length ?? 0,
      totalMembers: memberIds.length,
      totalChallengesCompleted: challengeResult.data?.length ?? 0,
      streakDays: streak,
    });
    setLoading(false);
  }

  if (loading) {
    return <div className="bg-muted rounded-2xl h-36 animate-pulse" />;
  }

  if (!stats) return null;

  const achievements = [
    {
      icon: BookOpen,
      label: "Devocionais",
      value: stats.totalDevotionals,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      icon: Flame,
      label: "Streak",
      value: `${stats.streakDays}d`,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      icon: Users,
      label: "Presenças",
      value: stats.totalAttendance,
      color: "text-brand-green",
      bg: "bg-brand-green/10",
    },
    {
      icon: Target,
      label: "Desafios",
      value: stats.totalChallengesCompleted,
      color: "text-accent-foreground",
      bg: "bg-accent/50",
    },
  ];

  // Milestones
  const milestones = [
    { target: 50, label: "50 devocionais", current: stats.totalDevotionals, emoji: "📖" },
    { target: 100, label: "100 devocionais", current: stats.totalDevotionals, emoji: "🔥" },
    { target: 500, label: "500 devocionais", current: stats.totalDevotionals, emoji: "⭐" },
    { target: 10, label: "10 dias de streak", current: stats.streakDays, emoji: "🔥" },
    { target: 30, label: "30 dias de streak", current: stats.streakDays, emoji: "💎" },
  ];

  const nextMilestone = milestones.find(m => m.current < m.target);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-secondary" />
        <span className="font-montserrat font-bold text-foreground text-sm">🏆 Conquistas da Comunidade</span>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {achievements.map(a => (
            <div key={a.label} className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                <a.icon className={`w-5 h-5 ${a.color}`} />
              </div>
              <span className="font-montserrat font-black text-foreground text-base leading-none">
                {typeof a.value === "number" ? a.value.toLocaleString("pt-BR") : a.value}
              </span>
              <span className="text-[10px] font-inter text-muted-foreground text-center leading-tight">{a.label}</span>
            </div>
          ))}
        </div>

        {/* Members badge */}
        <div className="flex items-center justify-center gap-1.5 bg-muted/50 rounded-xl py-2">
          <Heart className="w-3.5 h-3.5 text-destructive" />
          <span className="text-xs font-inter text-muted-foreground">
            <strong className="text-foreground">{stats.totalMembers}</strong> membros na comunidade
          </span>
        </div>

        {/* Next milestone progress */}
        {nextMilestone && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-inter text-muted-foreground">
                Próximo marco: {nextMilestone.emoji} {nextMilestone.label}
              </span>
              <span className="text-xs font-montserrat font-bold text-foreground">
                {nextMilestone.current}/{nextMilestone.target}
              </span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (nextMilestone.current / nextMilestone.target) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
