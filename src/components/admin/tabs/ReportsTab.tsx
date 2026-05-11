import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { FileText, Download, TrendingUp, Users, BookOpen, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportType = "geral" | "presenca" | "devocionais" | "licoes";

const REPORT_OPTIONS: { id: ReportType; label: string; icon: typeof Users }[] = [
  { id: "geral", label: "Visao Geral", icon: TrendingUp },
  { id: "presenca", label: "Presenca", icon: Users },
  { id: "devocionais", label: "Devocionais", icon: Flame },
  { id: "licoes", label: "Licoes", icon: BookOpen },
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

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeCsvCell(value: string | number) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

function isFinalAttendanceStatus(status: string) {
  return ["presente", "faltou", "justificou"].includes(normalizeAttendanceStatus(status));
}

export default function ReportsTab() {
  const { profile, role } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const [reportType, setReportType] = useState<ReportType>("geral");
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [devProgressData, setDevProgressData] = useState<any[]>([]);
  const [lessonData, setLessonData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!profile?.turma_id && !isAdmin) return;
    fetchReportData();
  }, [profile?.turma_id, effectiveArea, isAdmin]);

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

    const [profilesResult, attendanceResult, devProgressResult, lessonsResult, lessonResponsesResult, eventsResult] = await Promise.all([
      profilesQuery,
      supabase.from("attendance").select("user_id, event_id, status, created_at"),
      supabase.from("devotional_progress").select("user_id, completed_at"),
      supabase.from("lessons").select("id, title, course_id, order_num").order("order_num"),
      supabase.from("lesson_responses").select("user_id, lesson_id"),
      supabase.from("events").select("id, title, event_date, type").order("event_date", { ascending: false }).limit(20),
    ]);

    const turmaProfiles = (profilesResult.data ?? []).filter((participant) => participant.user_id !== myId);
    const turmaUserIds = new Set(turmaProfiles.map((participant) => participant.user_id));

    setParticipants(turmaProfiles);
    setAttendanceData((attendanceResult.data ?? []).filter((item) => turmaUserIds.has(item.user_id) && isFinalAttendanceStatus(item.status)));
    setDevProgressData((devProgressResult.data ?? []).filter((item) => turmaUserIds.has(item.user_id)));
    setLessonData({
      lessons: lessonsResult.data ?? [],
      responses: (lessonResponsesResult.data ?? []).filter((item) => turmaUserIds.has(item.user_id)),
    } as any);
    setEvents(eventsResult.data ?? []);
    setLoading(false);
  }

  const generalStats = useMemo(() => {
    const totalStudents = participants.length;
    const totalDevotionals = devProgressData.length;
    const totalAttendances = attendanceData.filter((item) => item.status === "presente").length;
    const lessonInfo = lessonData as any;
    const totalLessonsDone = lessonInfo?.responses
      ? new Set(lessonInfo.responses.map((response: any) => `${response.user_id}-${response.lesson_id}`)).size
      : 0;

    return [
      { name: "Alunos", value: totalStudents, icon: "👥" },
      { name: "Devocionais", value: totalDevotionals, icon: "🔥" },
      { name: "Presencas", value: totalAttendances, icon: "✅" },
      { name: "Licoes feitas", value: totalLessonsDone, icon: "📖" },
    ];
  }, [participants, devProgressData, attendanceData, lessonData]);

  const attendanceChartData = useMemo(() => {
    const byEvent: Record<string, { presente: number; ausente: number; justificado: number; title: string }> = {};
    const eventMap = new Map(events.map((event) => [event.id, event.title]));

    attendanceData.forEach((item) => {
      const title = eventMap.get(item.event_id) ?? item.event_id.slice(0, 8);
      if (!byEvent[item.event_id]) byEvent[item.event_id] = { presente: 0, ausente: 0, justificado: 0, title };
      const normalizedStatus = normalizeAttendanceStatus(item.status);
      if (normalizedStatus === "presente") byEvent[item.event_id].presente++;
      else if (normalizedStatus === "justificou") byEvent[item.event_id].justificado++;
      else if (normalizedStatus === "faltou") byEvent[item.event_id].ausente++;
    });

    return Object.values(byEvent).slice(0, 10);
  }, [attendanceData, events]);

  const devChartData = useMemo(() => {
    const byWeek: Record<string, number> = {};

    devProgressData.forEach((item) => {
      const date = new Date(item.completed_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = formatDateKey(weekStart);
      byWeek[key] = (byWeek[key] ?? 0) + 1;
    });

    return Object.entries(byWeek)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-8)
      .map(([week, count]) => ({
        semana: new Date(`${week}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        devocionais: count,
      }));
  }, [devProgressData]);

  const lessonChartData = useMemo(() => {
    const info = lessonData as any;
    if (!info?.lessons || !info?.responses) return [];

    const responsesByLesson: Record<string, Set<string>> = {};
    info.responses.forEach((response: any) => {
      if (!responsesByLesson[response.lesson_id]) responsesByLesson[response.lesson_id] = new Set();
      responsesByLesson[response.lesson_id].add(response.user_id);
    });

    return info.lessons.slice(0, 12).map((lesson: any) => ({
      name: lesson.title.length > 15 ? `${lesson.title.slice(0, 15)}...` : lesson.title,
      alunos: responsesByLesson[lesson.id]?.size ?? 0,
    }));
  }, [lessonData]);

  const communityPieData = useMemo(() => {
    const byCommunity: Record<string, number> = {};
    participants.forEach((participant) => {
      const key = participant.community ?? "Sem comunidade";
      byCommunity[key] = (byCommunity[key] ?? 0) + 1;
    });
    return Object.entries(byCommunity).map(([name, value]) => ({ name, value }));
  }, [participants]);

  function exportCSV() {
    const rows = [[
      escapeCsvCell("Nome"),
      escapeCsvCell("Comunidade"),
      escapeCsvCell("Devocionais"),
      escapeCsvCell("Presencas"),
      escapeCsvCell("Licoes"),
    ].join(",")];

    const info = lessonData as any;
    participants.forEach((participant) => {
      const devCount = devProgressData.filter((item) => item.user_id === participant.user_id).length;
      const attendanceCount = attendanceData.filter((item) => item.user_id === participant.user_id && item.status === "presente").length;
      const lessonCount = info?.responses
        ? new Set(info.responses.filter((response: any) => response.user_id === participant.user_id).map((response: any) => response.lesson_id)).size
        : 0;

      rows.push([
        escapeCsvCell(participant.full_name),
        escapeCsvCell(participant.community ?? ""),
        escapeCsvCell(devCount),
        escapeCsvCell(attendanceCount),
        escapeCsvCell(lessonCount),
      ].join(","));
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-turma-${formatDateKey(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-card border border-border rounded-2xl p-5">
            <div className="h-6 w-1/3 bg-muted rounded-lg animate-pulse mb-4" />
            <div className="h-40 bg-muted rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-montserrat font-bold text-foreground text-sm">Relatorios</h3>
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

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {REPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = reportType === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setReportType(option.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-inter font-semibold whitespace-nowrap transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {reportType === "geral" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {generalStats.map((stat) => (
              <div key={stat.name} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <p className="font-montserrat font-black text-foreground text-lg">{stat.value}</p>
                  <p className="text-muted-foreground text-xs font-inter">{stat.name}</p>
                </div>
              </div>
            ))}
          </div>

          {communityPieData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Distribuicao por Comunidade</h4>
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
                    {communityPieData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {reportType === "presenca" && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Presenca por Encontro</h4>
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
                  tickFormatter={(value: string) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="presente" name="Presente" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="justificado" name="Justificado" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="ausente" name="Ausente" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de presenca disponivel</p>
          )}

          <div className="mt-4 space-y-2">
            <h5 className="font-inter font-semibold text-foreground text-xs">Resumo por aluno</h5>
            {participants.map((participant) => {
              const present = attendanceData.filter((item) => item.user_id === participant.user_id && item.status === "presente").length;
              const total = attendanceData.filter((item) => item.user_id === participant.user_id && isFinalAttendanceStatus(item.status)).length;
              const percent = total > 0 ? Math.round((present / total) * 100) : 0;

              return (
                <div key={participant.user_id} className="flex items-center gap-2">
                  <span className="text-xs font-inter text-foreground truncate w-28">{participant.full_name.split(" ")[0]}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: "hsl(var(--primary))" }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">{present}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de devocional disponivel</p>
          )}

          <div className="mt-4 space-y-2">
            <h5 className="font-inter font-semibold text-foreground text-xs">Total por aluno</h5>
            {participants
              .map((participant) => ({ ...participant, count: devProgressData.filter((item) => item.user_id === participant.user_id).length }))
              .sort((left, right) => right.count - left.count)
              .map((participant) => (
                <div key={participant.user_id} className="flex items-center justify-between">
                  <span className="text-xs font-inter text-foreground truncate">{participant.full_name.split(" ")[0]}</span>
                  <span className="text-xs font-montserrat font-bold text-secondary">{participant.count} 🔥</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {reportType === "licoes" && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h4 className="font-montserrat font-bold text-foreground text-sm mb-3">Progresso nas Licoes</h4>
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
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum dado de licoes disponivel</p>
          )}
        </div>
      )}
    </div>
  );
}
