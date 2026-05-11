import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Heart, ChevronLeft, AlertCircle, Star, Search, Filter, LayoutGrid, List, Users, Lock, Unlock, GraduationCap, Info
} from "lucide-react";
import ParticipantSheet, { HealthBadge } from "./ParticipantSheet";
import type { Participant, Activity } from "./ParticipantSheet";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const HEALTH_CFG = {
  saudavel: { label: "Saudavel", bg: "bg-brand-green/10", text: "text-brand-green" },
  atencao:  { label: "Atencao", bg: "bg-accent/20", text: "text-accent-foreground" },
  critico:  { label: "Necessita cuidado", bg: "bg-destructive/10", text: "text-destructive" },
};

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

type Props = {
  participants: Participant[];
  activities: Activity[];
  initialParticipant?: Participant | null;
  onClearInitial?: () => void;
};

type ViewMode = "list" | "table";
type StatusFilter = "all" | "saudavel" | "atencao" | "critico" | "pastor" | "priority";

export default function AdminDiscipleshipTab({ participants, activities, initialParticipant, onClearInitial }: Props) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<Participant | null>(initialParticipant ?? null);
  const [plans, setPlans] = useState<Record<string, { health_status: string; needs_pastor?: boolean; is_priority?: boolean }>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { present: number; total: number }>>({});
  const [courses, setCourses] = useState<{ id: string; title: string; order_num: number }[]>([]);
  const [unlockedCourseIds, setUnlockedCourseIds] = useState<Set<string>>(new Set());
  const [unlockLoading, setUnlockLoading] = useState<string | null>(null);

  const myArea = profile?.area ?? "";

  useEffect(() => {
    fetchCourseUnlocks();
  }, [myArea]);

  async function fetchCourseUnlocks() {
    const [{ data: coursesData, error: coursesError }, { data: unlocksData, error: unlocksError }] = await Promise.all([
      supabase.from("courses").select("id, title, order_num").order("order_num"),
      supabase.from("course_unlocks").select("course_id, area").eq("area", myArea),
    ]);
    if (coursesError || unlocksError) {
      toast.error(coursesError?.message ?? unlocksError?.message ?? "Nao foi possivel carregar os cursos.");
    }
    setCourses(coursesData ?? []);
    setUnlockedCourseIds(new Set((unlocksData ?? []).map((u: any) => u.course_id)));
  }

  async function toggleCourseUnlock(courseId: string) {
    setUnlockLoading(courseId);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Nao foi possivel identificar o lider.");
      setUnlockLoading(null);
      return;
    }

    if (unlockedCourseIds.has(courseId)) {
      const { error } = await supabase
        .from("course_unlocks")
        .delete()
        .eq("course_id", courseId)
        .eq("area", myArea);
      if (error) {
        toast.error("Nao foi possivel bloquear o curso");
        setUnlockLoading(null);
        return;
      }
      setUnlockedCourseIds(prev => { const n = new Set(prev); n.delete(courseId); return n; });
    } else {
      const { error } = await supabase
        .from("course_unlocks")
        .insert({ course_id: courseId, area: myArea, unlocked_by: user.id } as any);
      if (error) {
        toast.error("Nao foi possivel liberar o curso");
        setUnlockLoading(null);
        return;
      }
      setUnlockedCourseIds(prev => new Set(prev).add(courseId));
    }
    setUnlockLoading(null);
  }

  useEffect(() => {
    if (initialParticipant) { setSelected(initialParticipant); onClearInitial?.(); }
  }, [initialParticipant]);

  useEffect(() => {
    if (participants.length === 0) return;
    async function fetchPlans() {
      const ids = participants.map(p => p.user_id);
      const [
        { data: plansData, error: plansError },
        { data: assessData, error: assessError },
        { data: attendanceData, error: attendanceError },
      ] = await Promise.all([
        supabase.from("discipleship_plans").select("user_id, health_status, is_priority").in("user_id", ids),
        supabase.from("spiritual_assessments").select("user_id, needs_pastor")
          .in("user_id", ids).eq("month", new Date().getMonth() + 1).eq("year", new Date().getFullYear()),
        supabase.from("attendance").select("user_id, status").in("user_id", ids),
      ]);
      if (plansError || assessError || attendanceError) {
        toast.error(plansError?.message ?? assessError?.message ?? attendanceError?.message ?? "Nao foi possivel carregar o acompanhamento.");
      }
      const map: Record<string, { health_status: string; needs_pastor?: boolean; is_priority?: boolean }> = {};
      (plansData ?? []).forEach(pl => { map[pl.user_id] = { health_status: pl.health_status, is_priority: pl.is_priority }; });
      (assessData ?? []).forEach(a => {
        if (!map[a.user_id]) map[a.user_id] = { health_status: "atencao" };
        map[a.user_id].needs_pastor = a.needs_pastor;
      });
      setPlans(map);

      // Build attendance map
      const attMap: Record<string, { present: number; total: number }> = {};
      (attendanceData ?? []).forEach(a => {
        const normalizedStatus = normalizeAttendanceStatus(a.status);
        if (!["presente", "faltou", "justificou"].includes(normalizedStatus)) return;
        if (!attMap[a.user_id]) attMap[a.user_id] = { present: 0, total: 0 };
        attMap[a.user_id].total++;
        if (normalizedStatus === "presente") attMap[a.user_id].present++;
      });
      setAttendanceMap(attMap);
    }
    fetchPlans();
  }, [participants]);

  if (selected) {
    return <ParticipantSheet participant={selected} activities={activities} onBack={() => setSelected(null)} />;
  }

  // Derived data
  const communities = [...new Set(participants.map(p => p.community))].sort();

  const filtered = participants.filter(p => {
    const planInfo = plans[p.user_id];
    const status = planInfo?.health_status ?? "atencao";

    // Search
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false;

    // Community filter
    if (communityFilter !== "all" && p.community !== communityFilter) return false;

    // Status filter
    if (statusFilter === "saudavel" && status !== "saudavel") return false;
    if (statusFilter === "atencao" && status !== "atencao") return false;
    if (statusFilter === "critico" && status !== "critico") return false;
    if (statusFilter === "pastor" && !planInfo?.needs_pastor) return false;
    if (statusFilter === "priority" && !planInfo?.is_priority) return false;

    return true;
  });

  const withPastor = participants.filter(p => plans[p.user_id]?.needs_pastor);
  const criticos = participants.filter(p => plans[p.user_id]?.health_status === "critico");
  const priorities = participants.filter(p => plans[p.user_id]?.is_priority);
  const saudaveis = participants.filter(p => plans[p.user_id]?.health_status === "saudavel");

  return (
    <div className="space-y-4">
      {/* Course Unlock Management */}
      {courses.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="w-4 h-4 text-secondary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Liberacao de cursos</p>
          </div>
          <p className="font-inter text-xs text-muted-foreground mb-2">
            Libere os cursos que sua turma podera acessar. Cursos bloqueados ficam visiveis, mas inacessiveis.
          </p>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-secondary/5 border border-secondary/20 mb-3">
            <Info className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
            <p className="font-inter text-[10px] text-secondary leading-relaxed">
              <strong>Como funciona:</strong> Liberar um curso e o <strong>primeiro passo</strong>. Cada licao so ficara disponivel para o aluno quando houver um <strong>evento na Agenda</strong> vinculado a ela. Sem evento agendado, a licao permanece com "Aguardando programacao".
            </p>
          </div>
          <div className="space-y-2">
            {courses.map(c => {
              const isUnlocked = unlockedCourseIds.has(c.id);
              const loading = unlockLoading === c.id;
              return (
                <div key={c.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                  isUnlocked ? "border-brand-green/30 bg-brand-green/5" : "border-border bg-muted/30"
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isUnlocked ? "bg-brand-green/15" : "bg-muted"
                    }`}>
                      {isUnlocked
                        ? <Unlock className="w-4 h-4 text-brand-green" />
                        : <Lock className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-montserrat font-bold text-foreground text-sm">Curso {c.order_num} - {c.title}</p>
                      <p className="font-inter text-[10px] text-muted-foreground">
                        {isUnlocked ? "Liberado para a turma" : "Bloqueado"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCourseUnlock(c.id)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg font-inter text-xs font-semibold transition-colors flex-shrink-0 ${
                      isUnlocked
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                    } disabled:opacity-40`}
                  >
                    {loading ? "..." : isUnlocked ? "Bloquear" : "Liberar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Saudaveis", value: saudaveis.length, color: "text-brand-green", bg: "bg-brand-green/10", filter: "saudavel" as StatusFilter },
          { label: "Atencao", value: participants.length - saudaveis.length - criticos.length, color: "text-accent-foreground", bg: "bg-accent/20", filter: "atencao" as StatusFilter },
          { label: "Criticos", value: criticos.length, color: "text-destructive", bg: "bg-destructive/10", filter: "critico" as StatusFilter },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(prev => prev === s.filter ? "all" : s.filter)}
            className={`rounded-2xl p-3 text-center transition-all ${s.bg} ${statusFilter === s.filter ? "ring-2 ring-primary" : ""}`}>
            <p className={`font-montserrat font-black text-2xl ${s.color}`}>{s.value}</p>
            <p className={`font-inter text-[10px] ${s.color} opacity-80 mt-0.5`}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Alerts */}
      {(withPastor.length > 0 || priorities.length > 0) && (
        <div className="space-y-2">
          {withPastor.length > 0 && (
            <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                <p className="font-montserrat font-bold text-primary text-sm">Pediram conversa pastoral ({withPastor.length})</p>
              </div>
              <div className="space-y-1">
                {withPastor.map(p => (
                  <button key={p.user_id} onClick={() => setSelected(p)}
                    className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-primary/10 transition-colors">
                    <span className="font-inter text-sm text-foreground">{p.full_name}</span>
                    <span className="text-muted-foreground font-inter text-xs ml-auto">- {p.community} {"->"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {priorities.length > 0 && (
            <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-accent-foreground" />
                <p className="font-montserrat font-bold text-accent-foreground text-sm">Prioridade pastoral ({priorities.length})</p>
              </div>
              <div className="space-y-1">
                {priorities.map(p => (
                  <button key={p.user_id} onClick={() => setSelected(p)}
                    className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-accent/10 transition-colors">
                    <span className="font-inter text-sm text-foreground">{p.full_name}</span>
                    <span className="text-muted-foreground font-inter text-xs ml-auto">- {p.community} {"->"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar participante..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={communityFilter}
            onChange={e => setCommunityFilter(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            <option value="all">Todas comunidades</option>
            {communities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            <option value="all">Todos status</option>
            <option value="saudavel">Saudaveis</option>
            <option value="atencao">Atencao</option>
            <option value="critico">Criticos</option>
            <option value="pastor">Pediu conversa</option>
            <option value="priority">Prioridade</option>
          </select>
          <div className="flex bg-muted rounded-xl p-0.5">
            <button onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-card shadow-sm" : ""}`}>
              <List className={`w-4 h-4 ${viewMode === "list" ? "text-foreground" : "text-muted-foreground"}`} />
            </button>
            <button onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-card shadow-sm" : ""}`}>
              <LayoutGrid className={`w-4 h-4 ${viewMode === "table" ? "text-foreground" : "text-muted-foreground"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="font-inter text-xs text-muted-foreground">
          {filtered.length} de {participants.length} participantes
          {search && ` - "${search}"`}
        </p>
      </div>

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</th>
                  <th className="text-left px-3 py-2.5 font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comunidade</th>
                  <th className="text-center px-3 py-2.5 font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Progresso</th>
                  <th className="text-center px-3 py-2.5 font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Presenca</th>
                  <th className="text-center px-3 py-2.5 font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const planInfo = plans[p.user_id];
                  const status = planInfo?.health_status ?? "atencao";
                  const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
                  const att = attendanceMap[p.user_id];
                  const attPct = att ? Math.round((att.present / att.total) * 100) : 0;
                  return (
                    <tr key={p.user_id} onClick={() => setSelected(p)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="font-montserrat font-bold text-primary text-xs">{p.full_name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-inter text-xs font-medium text-foreground truncate">{p.full_name}</p>
                            {planInfo?.is_priority && <span className="text-[9px] text-accent-foreground">⭐</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-inter text-xs text-muted-foreground">{p.community}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${pct}%`,
                              background: pct >= 70 ? "var(--gradient-green)" : pct >= 34 ? "var(--gradient-orange)" : "hsl(var(--destructive))"
                            }} />
                          </div>
                          <span className="font-inter text-[10px] font-medium text-foreground">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-inter text-[10px] font-medium ${
                          att ? (attPct >= 70 ? "text-brand-green" : attPct >= 40 ? "text-accent-foreground" : "text-destructive") : "text-muted-foreground"
                        }`}>
                          {att ? `${attPct}%` : "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <HealthBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <>
          <p className="font-montserrat font-bold text-foreground text-sm">
            {statusFilter !== "all" || communityFilter !== "all" || search ? "Resultados" : "Todos os participantes"}
          </p>
          <div className="space-y-2">
            {filtered.map(p => {
              const planInfo = plans[p.user_id];
              const status = planInfo?.health_status ?? "atencao";
              const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
              const att = attendanceMap[p.user_id];
              const attPct = att ? Math.round((att.present / att.total) * 100) : 0;
              return (
                <button key={p.user_id} onClick={() => setSelected(p)}
                  className="w-full text-left bg-card rounded-2xl border border-border p-3 flex items-center gap-3 hover:border-primary/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-montserrat font-black text-primary text-base">{p.full_name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-montserrat font-bold text-foreground text-sm truncate">{p.full_name}</p>
                      {planInfo?.is_priority && <Star className="w-3 h-3 text-accent flex-shrink-0" style={{ fill: "hsl(var(--accent))" }} />}
                    </div>
                    <p className="text-muted-foreground font-inter text-xs">
                      {p.community} - {pct}% jornada
                      {att ? ` - ${attPct}% presenca` : ""}
                    </p>
                  </div>
                  <HealthBadge status={status} />
                  <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-10 text-muted-foreground font-inter text-sm">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Nenhum participante encontrado.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
