import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { FileText, Download, Filter, TrendingUp, Users, BookOpen, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ReportType = "geral" | "presenca" | "devocionais" | "licoes";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Users }[] = [
  { id: "geral", label: "Visão Geral", icon: TrendingUp },
  { id: "presenca", label: "Presença", icon: Users },
  { id: "devocionais", label: "Devocionais", icon: Flame },
  { id: "licoes", label: "Lições", icon: BookOpen },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--brand-green, 142 71% 45%))",
  "hsl(var(--destructive))",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
];

export default function ReportsTab() {
  const { profile, role } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const [reportType, setReportType] = useState<ReportType>("geral");
  const [loading, setLoading] = useState(true);

  // Data states
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [devProgressData, setDevProgressData] = useState<any[]>([]);
  const [lessonData, setLessonData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!profile?.turma_id && !isAdmin) return;
    fetchReportData();
  }, [profile?.turma_id, effectiveArea]);

  async function fetchReportData() {
    if (!profile?.turma_id && !isAdmin) return;
    setLoading(true);

    const userResult = await supabase.auth.getUser();
    const myId = userResult.data.user?.id ?? "";

    let profilesQuery = supabase.from("profiles").select("user_id, full_name, community, area");
    if (isAdmin) {
      profilesQuery = profilesQuery.eq("area", effectiveArea as any);
    } else {
      profilesQuery = profilesQuery.eq("turma_id", profile!.turma_id!);
    }

    const [
      { data: profiles },
      { data: attendance },
      { data: devProgress },
      { data: lessons },
      { data: lessonResponses },
      { data: eventsData },
    ] = await Promise.all([
      profilesQuery,
      supabase.from("attendance").select("user_id, event_id, status, created_at"),
      supabase.from("devotional_progress").select("user_id, completed_at"),
      supabase.from("lessons").select("id, title, course_id, order_num").order("order_num"),
      supabase.from("lesson_responses").select("user_id, lesson_id"),
      supabase.from("events").select("id, title, event_date, type").order("event_date", { ascending: false }).limit(20),
    ]);

    const turmaProfiles = (profiles ?? []).filter(p => p.user_id !== myId);
    const turmaUserIds = new Set(turmaProfiles.map(p => p.user_id));

    setParticipants(turmaProfiles);
    setAttendanceData((attendance ?? []).filter(a => turmaUserIds.has(a.user_id)));
    setDevProgressData((devProgress ?? []).filter(d => turmaUserIds.has(d.user_id)));
    setLessonData({
      lessons: lessons ?? [],
      responses: (lessonResponses ?? []).filter(r => turmaUserIds.has(r.user_id)),
    } as any);
    setEvents(eventsData ?? []);
    setLoading(false);
  }

  // === Chart data computations ===

  const generalStats = useMemo(() => {
    const totalStudents = participants.length;
    const totalDevotionals = devProgressData.length;
    const totalAttendances = attendanceData.filter(a => a.status === "presente").length;
    const lessonInfo = lessonData as any;
    const totalLessonsDone = lessonInfo?.responses ? new Set(lessonInfo.responses.map((r: any) => `${r.user_id}-${r.lesson_id}`)).size : 0;

    return [
      { name: "Alunos", value: totalStudents, icon: "👥" },
      { name: "Devocionais", value: totalDevotionals, icon: "🔥" },
      { name: "Presenças", value: totalAttendances, icon: "✅" },
      { name: "Lições feitas", value: totalLessonsDone, icon: "📖" },
    ];
  }, [participants, devProgressData, attendanceData, lessonData]);

  const attendanceChartData = useMemo(() => {
    const byEvent: Record<string, { presente: number; ausente: number; justificado: number; title: string }> = {};
    const eventMap = new Map(events.map(e => [e.id, e.title]));

    attendanceData.forEach(a => {
      const title = eventMap.get(a.event_id) ?? a.event_id.slice(0, 8);
      if (!byEvent[a.event_id]) byEvent[a.event_id] = { presente: 0, ausente: 0, justificado: 0, title };
      if (a.status === "presente") byEvent[a.event_id].presente++;
      else if (a.status === "justificado") byEvent[a.event_id].justificado++;
      else byEvent[a.event_id].ausente++;
    });

    return Object.values(byEvent).slice(0, 10);
  }, [attendanceData, events]);

  const devChartData = useMemo(() => {
    const byWeek: Record<string, number> = {};
    devProgressData.forEach(d => {
      const date = new Date(d.completed_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split("T")[0];
      byWeek[key] = (byWeek[key] ?? 0) + 1;
    });

    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, count]) => ({
        semana: new Date(week).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        devocionais: count,
      }));
  }, [devProgressData]);

  const lessonChartData = useMemo(() => {
    const info = lessonData as any;
    if (!info?.lessons || !info?.responses) return [];

    const responsesByLesson: Record<string, Set<string>> = {};
    info.responses.forEach((r: any) => {
      if (!responsesByLesson[r.lesson_id]) responsesByLesson[r.lesson_id] = new Set();
      responsesByLesson[r.lesson_id].add(r.user_id);
    });

    return info.lessons.slice(0, 12).map((l: any) => ({
      name: l.title.length > 15 ? l.title.slice(0, 15) + "…" : l.title,
      alunos: responsesByLesson[l.id]?.size ?? 0,
    }));
  }, [lessonData]);

  const communityPieData = useMemo(() => {
    const byCommunity: Record<string, number> = {};
    participants.forEach(p => {
      byCommunity[p.community] = (byCommunity[p.community] ?? 0) + 1;
    });
    return Object.entries(byCommunity).map(([name, value]) => ({ name, value }));
  }, [participants]);

  // === Export functions ===

  function exportCSV() {
    const rows = [["Nome", "Comunidade", "Devocionais", "Presenças", "Lições"].join(",")];
    const info = lessonData as any;

    participants.forEach(p => {
      const devCount = devProgressData.filter(d => d.user_id === p.user_id).length;
      const attCount = attendanceData.filter(a => a.user_id === p.user_id && a.status === "presente").length;
      const lessonCount = info?.responses ? new Set(info.responses.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.lesson_id)).size : 0;
      rows.push([`"${p.full_name}"`, `"${p.community}"`, devCount, attCount, lessonCount].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-turma-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5">
            <div className="h-6 w-1/3 bg-muted rounded-lg animate-pulse mb-4" />
            <div className="h-40 bg-muted rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-montserrat font-bold text-foreground text-sm">Relatórios</h3>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Excel/CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printReport} className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
          </div>
        </div>

        {/* Report type selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {REPORT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = reportType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-inter font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* General Overview */}
      {reportType === "geral" && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {generalStats.map(stat => (
              <div key={stat.name} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="font-montserrat font-black text-foreground text-lg">{stat.value}</p>
                  <p className="text-muted-foreground text-xs font-inter">{stat.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Community distribution pie */}
          {communityPieData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Distribuição por Comunidade</h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={communityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {communityPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Attendance report */}
      {reportType === "presenca" && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Presença por Encontro</h4>
          {attendanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={attendanceChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={90}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="presente" name="Presente" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="justificado" name="Justificado" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="ausente" name="Ausente" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de presença disponível</p>
          )}

          {/* Per-student attendance summary */}
          <div className="mt-4 space-y-2">
            <h5 className="font-inter font-semibold text-foreground text-xs">Resumo por Aluno</h5>
            {participants.map(p => {
              const present = attendanceData.filter(a => a.user_id === p.user_id && a.status === "presente").length;
              const total = attendanceData.filter(a => a.user_id === p.user_id).length;
              const pct = total > 0 ? Math.round((present / total) * 100) : 0;
              return (
                <div key={p.user_id} className="flex items-center gap-2">
                  <span className="text-xs font-inter text-foreground truncate w-28">{p.full_name.split(" ")[0]}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: "hsl(var(--primary))" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{present}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Devotionals report */}
      {reportType === "devocionais" && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Devocionais por Semana</h4>
          {devChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={devChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="devocionais"
                  name="Devocionais"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--secondary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de devocional disponível</p>
          )}

          {/* Per-student devotional count */}
          <div className="mt-4 space-y-2">
            <h5 className="font-inter font-semibold text-foreground text-xs">Total por Aluno</h5>
            {participants
              .map(p => ({ ...p, count: devProgressData.filter(d => d.user_id === p.user_id).length }))
              .sort((a, b) => b.count - a.count)
              .map(p => (
                <div key={p.user_id} className="flex items-center justify-between">
                  <span className="text-xs font-inter text-foreground truncate">{p.full_name.split(" ")[0]}</span>
                  <span className="text-xs font-montserrat font-bold text-secondary">{p.count} 🔥</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Lessons report */}
      {reportType === "licoes" && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Progresso nas Lições</h4>
          {lessonChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={lessonChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="alunos" name="Alunos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de lições disponível</p>
          )}
        </div>
      )}
    </div>
  );
}
