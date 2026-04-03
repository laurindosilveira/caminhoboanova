import { useState, useEffect, useMemo } from "react";
import { AREAS } from "@/config/areas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, TrendingUp, AlertTriangle, BarChart3, Trophy, Filter, Calendar, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

type TurmaStats = {
  turma_id: string;
  turma_name: string;
  area: string | null;
  total: number;
  active: number;
  inactive: number;
  avgProgress: number;
  engagementRate: number;
  attendanceRate: number;
  devotionalRate: number;
};

type AttRow = { user_id: string; status: string; created_at: string };
type DevRow = { user_id: string; completed_at: string };
type LessonRow = { user_id: string; lesson_id: string; created_at: string };

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#ec4899",
];

const PERIOD_OPTIONS = [
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "12m", label: "12 meses" },
  { id: "all", label: "Tudo" },
];

export default function AdminOverviewTab({
  participants,
  activities,
  turmas,
}: {
  participants: any[];
  activities: any[];
  turmas: any[];
}) {
  const { isSuper } = useAuth();

  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [devRows, setDevRows] = useState<DevRow[]>([]);
  const [lessonRows, setLessonRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [period, setPeriod] = useState("6m");
  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("all");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: att }, { data: dev }, { data: les }] = await Promise.all([
      supabase.from("attendance").select("user_id, status, created_at"),
      supabase.from("devotional_progress").select("user_id, completed_at"),
      supabase.from("lesson_responses").select("user_id, lesson_id, created_at"),
    ]);
    setAttRows(att ?? []);
    setDevRows(dev ?? []);
    setLessonRows(les ?? []);
    setLoading(false);
  }

  // Period cutoff
  const cutoff = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    const months = parseInt(period);
    d.setMonth(d.getMonth() - months);
    return d.toISOString();
  }, [period]);

  // Filtered participants by turma
  const filteredParticipants = useMemo(() => {
    if (selectedTurmaId === "all") return participants;
    return participants.filter(p => (p as any).turma_id === selectedTurmaId);
  }, [participants, selectedTurmaId]);

  const filteredUserIds = useMemo(() => new Set(filteredParticipants.map(p => p.user_id)), [filteredParticipants]);

  // Filter data by period + users
  const filteredAtt = useMemo(() => {
    return attRows.filter(a => filteredUserIds.has(a.user_id) && (!cutoff || a.created_at >= cutoff));
  }, [attRows, filteredUserIds, cutoff]);

  const filteredDev = useMemo(() => {
    return devRows.filter(d => filteredUserIds.has(d.user_id) && (!cutoff || d.completed_at >= cutoff));
  }, [devRows, filteredUserIds, cutoff]);

  const filteredLessons = useMemo(() => {
    return lessonRows.filter(l => filteredUserIds.has(l.user_id) && (!cutoff || l.created_at >= cutoff));
  }, [lessonRows, filteredUserIds, cutoff]);

  // === KPIs ===
  const totalParticipants = filteredParticipants.length;
  const usersWithPresence = new Set(filteredAtt.filter(a => a.status === "presente").map(a => a.user_id)).size;
  const usersWithDev = new Set(filteredDev.map(d => d.user_id)).size;
  const usersWithLesson = new Set(filteredLessons.map(l => l.user_id)).size;
  const engagedUsers = new Set([
    ...filteredAtt.filter(a => a.status === "presente").map(a => a.user_id),
    ...filteredDev.map(d => d.user_id),
    ...filteredLessons.map(l => l.user_id),
  ]).size;
  const engagementRate = totalParticipants > 0 ? Math.round((engagedUsers / totalParticipants) * 100) : 0;
  const inactiveCount = totalParticipants - engagedUsers;

  // === Turma comparison ===
  const turmaStats: TurmaStats[] = useMemo(() => {
    return turmas.map(t => {
      const turmaUsers = participants.filter(p => (p as any).turma_id === t.id);
      const turmaIds = new Set(turmaUsers.map(u => u.user_id));
      const tAtt = attRows.filter(a => turmaIds.has(a.user_id) && a.status === "presente" && (!cutoff || a.created_at >= cutoff));
      const tDev = devRows.filter(d => turmaIds.has(d.user_id) && (!cutoff || d.completed_at >= cutoff));
      const tLes = lessonRows.filter(l => turmaIds.has(l.user_id) && (!cutoff || l.created_at >= cutoff));

      const total = turmaUsers.length;
      const activeUsers = new Set([...tAtt.map(a => a.user_id), ...tDev.map(d => d.user_id), ...tLes.map(l => l.user_id)]).size;
      const attUsers = new Set(tAtt.map(a => a.user_id)).size;
      const devUsers = new Set(tDev.map(d => d.user_id)).size;

      return {
        turma_id: t.id,
        turma_name: t.name,
        area: t.area,
        total,
        active: activeUsers,
        inactive: total - activeUsers,
        avgProgress: total > 0 && activities.length > 0
          ? Math.round(turmaUsers.reduce((s, p) => s + (p.completed_count / activities.length) * 100, 0) / total)
          : 0,
        engagementRate: total > 0 ? Math.round((activeUsers / total) * 100) : 0,
        attendanceRate: total > 0 ? Math.round((attUsers / total) * 100) : 0,
        devotionalRate: total > 0 ? Math.round((devUsers / total) * 100) : 0,
      };
    });
  }, [turmas, participants, attRows, devRows, lessonRows, activities, cutoff]);

  // === Monthly trends ===
  const monthlyTrend = useMemo(() => {
    const months: Record<string, { presenças: number; devocionais: number; lições: number }> = {};
    filteredAtt.filter(a => a.status === "presente").forEach(a => {
      const m = a.created_at.substring(0, 7);
      if (!months[m]) months[m] = { presenças: 0, devocionais: 0, lições: 0 };
      months[m].presenças++;
    });
    filteredDev.forEach(d => {
      const m = d.completed_at.substring(0, 7);
      if (!months[m]) months[m] = { presenças: 0, devocionais: 0, lições: 0 };
      months[m].devocionais++;
    });
    filteredLessons.forEach(l => {
      const m = l.created_at.substring(0, 7);
      if (!months[m]) months[m] = { presenças: 0, devocionais: 0, lições: 0 };
      months[m].lições++;
    });
    return Object.keys(months).sort().slice(-12).map(m => ({
      mês: new Date(m + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      ...months[m],
    }));
  }, [filteredAtt, filteredDev, filteredLessons]);

  // === Area distribution ===
  const areaData = AREAS.map(area => ({
    name: area,
    value: filteredParticipants.filter(p => p.area === area).length,
  })).filter(d => d.value > 0);

  // === Engagement radar (per turma) ===
  const radarData = useMemo(() => {
    return turmaStats.filter(t => t.total > 0).slice(0, 5).map(t => ({
      turma: t.turma_name.length > 12 ? t.turma_name.substring(0, 12) + "…" : t.turma_name,
      Engajamento: t.engagementRate,
      Presença: t.attendanceRate,
      Devocionais: t.devotionalRate,
      Progresso: t.avgProgress,
    }));
  }, [turmaStats]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-montserrat font-black text-foreground text-lg">Dashboard Global</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-3 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-inter text-muted-foreground">
          <Filter className="w-3.5 h-3.5" /> Filtros
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-all ${
                period === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={selectedTurmaId}
          onChange={e => setSelectedTurmaId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todas as turmas</option>
          {turmas.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.area})</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard icon={<Users className="w-5 h-5" />} label="Total Discípulos" value={totalParticipants} bgClass="bg-primary/10" textClass="text-primary" />
        <KPICard icon={<Activity className="w-5 h-5" />} label="Taxa Engajamento" value={`${engagementRate}%`} bgClass="bg-chart-2/10" textClass="text-chart-2" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Engajados" value={engagedUsers} bgClass="bg-chart-3/10" textClass="text-chart-3" />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Sem Atividade" value={inactiveCount} bgClass="bg-destructive/10" textClass="text-destructive" />
      </div>

      {/* Engagement breakdown */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <p className="font-montserrat font-bold text-foreground text-sm mb-1">📈 Detalhamento do Engajamento</p>
        <p className="text-muted-foreground font-inter text-[10px] mb-3">Percentual de discípulos ativos em cada dimensão</p>
        <div className="space-y-2.5">
          <EngagementBar label="Presença em Encontros" value={totalParticipants > 0 ? Math.round((usersWithPresence / totalParticipants) * 100) : 0} color="hsl(var(--primary))" />
          <EngagementBar label="Devocionais Concluídos" value={totalParticipants > 0 ? Math.round((usersWithDev / totalParticipants) * 100) : 0} color="hsl(var(--chart-2))" />
          <EngagementBar label="Lições Respondidas" value={totalParticipants > 0 ? Math.round((usersWithLesson / totalParticipants) * 100) : 0} color="hsl(var(--chart-3))" />
        </div>
      </div>

      {/* Turma comparison */}
      {turmaStats.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm mb-1">📊 Comparativo entre Turmas</p>
          <p className="text-muted-foreground font-inter text-[10px] mb-3">Taxa de engajamento e progresso por turma</p>
          <ResponsiveContainer width="100%" height={Math.max(160, turmaStats.length * 40)}>
            <BarChart data={turmaStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
              <YAxis dataKey="turma_name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="engagementRate" name="Engajamento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="avgProgress" name="Progresso" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Radar chart for turma comparison */}
      {radarData.length >= 2 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm mb-1">🎯 Perfil de Engajamento por Turma</p>
          <p className="text-muted-foreground font-inter text-[10px] mb-3">Visão multidimensional do desempenho</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="turma" tick={{ fontSize: 9 }} />
              <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
              <Radar name="Engajamento" dataKey="Engajamento" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
              <Radar name="Presença" dataKey="Presença" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
              <Radar name="Devocionais" dataKey="Devocionais" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly trends */}
      {monthlyTrend.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm mb-1">📅 Tendências Mensais</p>
          <p className="text-muted-foreground font-inter text-[10px] mb-3">Evolução do engajamento ao longo do tempo</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mês" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="presenças" name="Presenças" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="devocionais" name="Devocionais" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="lições" name="Lições" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Area + turma summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-xs mb-2">Distribuição por Área</p>
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={areaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={22}>
                {areaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {areaData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1 text-[9px] font-inter text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-xs mb-2">Ranking de Turmas</p>
          <div className="space-y-1.5">
            {[...turmaStats].sort((a, b) => b.engagementRate - a.engagementRate).map((t, i) => (
              <div key={t.turma_id} className="flex items-center gap-1.5">
                <span className="text-[10px] font-inter font-bold text-muted-foreground w-4">{i + 1}.</span>
                <span className="text-[10px] font-inter text-foreground truncate flex-1">{t.turma_name}</span>
                <span className={`text-[10px] font-inter font-bold ${
                  t.engagementRate >= 70 ? "text-chart-2" : t.engagementRate >= 40 ? "text-primary" : "text-destructive"
                }`}>{t.engagementRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, bgClass, textClass }: {
  icon: React.ReactNode; label: string; value: string | number; bgClass: string; textClass: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-3 shadow-sm">
      <div className={`w-8 h-8 rounded-xl ${bgClass} flex items-center justify-center ${textClass} mb-2`}>
        {icon}
      </div>
      <p className="font-montserrat font-black text-foreground text-lg">{value}</p>
      <p className="text-muted-foreground font-inter text-[10px]">{label}</p>
    </div>
  );
}

function EngagementBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-inter text-foreground">{label}</span>
        <span className="text-xs font-inter font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
