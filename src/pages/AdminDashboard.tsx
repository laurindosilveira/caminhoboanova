import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import AdminHeader from "@/components/admin/AdminHeader";
import AdminBottomNav, { AdminTab } from "@/components/admin/AdminBottomNav";

// Lazy-loaded tab components
const CoursesTab = lazy(() => import("@/components/admin/tabs/CoursesTab"));
const AttendanceTab = lazy(() => import("@/components/admin/tabs/AttendanceTab"));
const UsersTab = lazy(() => import("@/components/admin/tabs/UsersTab"));
const AdminPushTab = lazy(() => import("@/components/admin/tabs/AdminPushTab"));
const AdminOverviewTab = lazy(() => import("@/components/admin/tabs/AdminOverviewTab"));
const AdminAlertsTab = lazy(() => import("@/components/admin/tabs/AdminAlertsTab"));
const AdminLeadersTab = lazy(() => import("@/components/admin/tabs/AdminLeadersTab"));

const AREA_1_COMMUNITIES = ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"];
const AREA_2_COMMUNITIES = ["Martim Lutero", "Linha Brasil", "Iriá Pira 2"];
const ALL_COMMUNITIES = [...AREA_1_COMMUNITIES, ...AREA_2_COMMUNITIES];

type Activity = {
  id: string; type: string; title: string; subtitle: string | null; order_num: number; points: number;
};
type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  confirmation_year?: number | null;
};
type PlanInfo = { health_status: string; is_priority: boolean; needs_pastor?: boolean };
type Turma = { id: string; name: string; area: string | null; year: number; is_active: boolean; description: string | null };

function TabSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
        <span className="text-2xl">✝️</span>
      </div>
      <p className="text-muted-foreground font-inter text-sm">Carregando...</p>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, role, isSuper, signOut } = useAuth();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>(role === "lider" ? "courses" : "overview");

  // Turma selection state
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<Turma | null>(null);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [turmaSearch, setTurmaSearch] = useState("");

  useEffect(() => {
    if (role !== "admin" && role !== "lider") { navigate("/"); return; }
    fetchData();
  }, [role]);

  // For leaders, auto-select their turma
  useEffect(() => {
    if (role === "lider" && profile?.turma_id && turmas.length > 0 && !selectedTurma) {
      const myTurma = turmas.find(t => t.id === profile.turma_id);
      if (myTurma) setSelectedTurma(myTurma);
    }
  }, [role, profile, turmas, selectedTurma]);

  const fetchPlans = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const [{ data: plansData }, { data: assessData }] = await Promise.all([
      supabase.from("discipleship_plans").select("user_id, health_status, is_priority").in("user_id", ids),
      supabase.from("spiritual_assessments").select("user_id, needs_pastor")
        .in("user_id", ids)
        .eq("month", new Date().getMonth() + 1)
        .eq("year", new Date().getFullYear()),
    ]);
    const map: Record<string, PlanInfo> = {};
    (plansData ?? []).forEach(pl => {
      map[pl.user_id] = { health_status: pl.health_status, is_priority: pl.is_priority ?? false };
    });
    (assessData ?? []).forEach(a => {
      if (!map[a.user_id]) map[a.user_id] = { health_status: "atencao", is_priority: false };
      map[a.user_id].needs_pastor = a.needs_pastor;
    });
    setPlans(map);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: activitiesData }, { data: profilesData }, userResult, { data: turmasData }] = await Promise.all([
      supabase.from("activities").select("*").order("order_num"),
      supabase.from("profiles").select("user_id, full_name, community, area, birth_date, phone, turma_id, confirmation_year, avatar_url, father_name, mother_name, father_phone, mother_phone, address, email"),
      supabase.auth.getUser(),
      supabase.from("turmas").select("*").eq("is_active", true).order("area").order("name"),
    ]);

    const myId = userResult.data.user?.id ?? "";
    const profilesList = (profilesData ?? []).filter(p => p.user_id !== myId);
    const { data: progressData } = await supabase.from("user_progress").select("user_id, activity_id");

    const participantList: Participant[] = profilesList.map((p) => {
      const userProgress = (progressData ?? []).filter((pr) => pr.user_id === p.user_id);
      return {
        ...p,
        completed_count: userProgress.length,
        completed_activity_ids: userProgress.map((pr) => pr.activity_id),
        turma_id: p.turma_id,
      } as any;
    });

    setActivities(activitiesData ?? []);
    setParticipants(participantList);
    setTurmas(turmasData ?? []);
    await fetchPlans(participantList.map(p => p.user_id));
    setLoading(false);
  }, [fetchPlans]);

  // Memoized filtered participants
  const filteredParticipants = useMemo(() =>
    selectedTurma
      ? participants.filter(p => (p as any).turma_id === selectedTurma.id)
      : participants,
    [selectedTurma, participants]
  );

  const communities = useMemo(() =>
    selectedTurma?.area
      ? (selectedTurma.area === "Área 1" ? AREA_1_COMMUNITIES : AREA_2_COMMUNITIES)
      : ALL_COMMUNITIES,
    [selectedTurma]
  );

  const stats = useMemo(() => ({
    total: filteredParticipants.length,
    avancados: filteredParticipants.filter(p => activities.length > 0 && p.completed_count / activities.length >= 0.7).length,
    semAtividade: filteredParticipants.filter(p => p.completed_count === 0).length,
    mediaProgresso: filteredParticipants.length > 0
      ? Math.round(filteredParticipants.reduce((s, p) => s + (activities.length > 0 ? (p.completed_count / activities.length) * 100 : 0), 0) / filteredParticipants.length)
      : 0,
  }), [filteredParticipants, activities]);

  const handleChangeCommunity = useCallback(() => {
    if (role === "lider") {
      navigate("/");
    } else {
      setSelectedTurma(null);
      setExpandedArea(null);
    }
  }, [role, navigate]);

  const handleSelectTurmaFromUsers = useCallback((turma: { area: string }) => {
    const found = turmas.find(t => t.area === turma.area);
    if (found) {
      setSelectedTurma(found);
      setActiveTab("overview");
    }
  }, [turmas]);

  // ===== TURMA SELECTOR SCREEN =====
  if (!selectedTurma) {
    return (
      <TurmaSelector
        loading={loading}
        turmas={turmas}
        participants={participants}
        isSuper={isSuper}
        adminArea={profile?.area ?? ""}
        expandedArea={expandedArea}
        setExpandedArea={setExpandedArea}
        turmaSearch={turmaSearch}
        setTurmaSearch={setTurmaSearch}
        onSelectTurma={setSelectedTurma}
        onBack={() => navigate("/")}
      />
    );
  }

  // ===== MAIN DASHBOARD =====
  const turmaName = selectedTurma.name;
  const displayTurma = isSuper ? `👑 ${turmaName}` : turmaName;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        areaName={displayTurma}
        subtitle={selectedTurma.area}
        stats={stats}
        onSignOut={signOut}
        onBackToUser={() => navigate("/")}
        selectedCommunity={selectedTurma.id}
        participants={filteredParticipants}
        activities={activities}
        turmaLabel={turmaName}
        onChangeCommunity={handleChangeCommunity}
      />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {loading ? (
          <TabSkeleton />
        ) : (
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === "overview" && (
              <AdminOverviewTab
                participants={filteredParticipants}
                activities={activities}
                turmas={turmas}
              />
            )}
            {activeTab === "alerts" && (
              <AdminAlertsTab participants={filteredParticipants} />
            )}
            {activeTab === "settings" && (
              <AttendanceTab
                participants={filteredParticipants}
                activities={activities}
                communities={communities}
                adminArea={selectedTurma.area ?? profile?.area ?? ""}
              />
            )}
            {activeTab === "courses" && <CoursesTab />}
            {activeTab === "leaders" && <AdminLeadersTab turmas={turmas} />}
            {activeTab === "push" && <AdminPushTab turmas={turmas} />}
            {activeTab === "users" && <UsersTab onSelectTurma={handleSelectTurmaFromUsers} />}
          </Suspense>
        )}
      </main>

      <AdminBottomNav active={activeTab} onChange={setActiveTab} userRole={role as "admin" | "lider" | null} />
    </div>
  );
}

// ===== Turma Selector extracted component =====
function TurmaSelector({
  loading, turmas, participants, isSuper, adminArea,
  expandedArea, setExpandedArea, turmaSearch, setTurmaSearch,
  onSelectTurma, onBack,
}: {
  loading: boolean;
  turmas: Turma[];
  participants: Participant[];
  isSuper: boolean;
  adminArea: string;
  expandedArea: string | null;
  setExpandedArea: (a: string | null) => void;
  turmaSearch: string;
  setTurmaSearch: (s: string) => void;
  onSelectTurma: (t: Turma) => void;
  onBack: () => void;
}) {
  const area1Turmas = turmas.filter(t => t.area === "Área 1");
  const area2Turmas = turmas.filter(t => t.area === "Área 2");

  const areasToShow = isSuper
    ? [{ name: "Área 1", turmas: area1Turmas, communities: AREA_1_COMMUNITIES, icon: "⛪" },
       { name: "Área 2", turmas: area2Turmas, communities: AREA_2_COMMUNITIES, icon: "✝️" }]
    : adminArea === "Área 1"
      ? [{ name: "Área 1", turmas: area1Turmas, communities: AREA_1_COMMUNITIES, icon: "⛪" }]
      : [{ name: "Área 2", turmas: area2Turmas, communities: AREA_2_COMMUNITIES, icon: "✝️" }];

  // Filter turmas by search
  const searchLower = turmaSearch.toLowerCase().trim();
  const filteredAreas = areasToShow.map(areaInfo => ({
    ...areaInfo,
    turmas: searchLower
      ? areaInfo.turmas.filter(t =>
          t.name.toLowerCase().includes(searchLower) ||
          (t.description ?? "").toLowerCase().includes(searchLower)
        )
      : areaInfo.turmas,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-8 pb-6" style={{ background: "var(--gradient-hero)" }}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-primary-foreground/70 font-inter text-xs mb-3 hover:text-primary-foreground transition-colors"
          >
            <span className="text-sm">←</span> Voltar para área geral
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center">
              <span className="text-xl">{isSuper ? "👑" : "✝️"}</span>
            </div>
            <div>
              <p className="text-primary-foreground/60 font-inter text-xs">
                {isSuper ? "Super Administrador" : "Painel do Administrador"}
              </p>
              <h1 className="font-montserrat font-black text-primary-foreground text-lg">Selecione a Turma</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <TabSkeleton />
        ) : (
          <>
            <p className="text-center text-muted-foreground font-inter text-xs">
              Escolha uma turma para gerenciar
            </p>

            {/* Search bar for turmas */}
            {turmas.length > 3 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar turma..."
                  value={turmaSearch}
                  onChange={e => setTurmaSearch(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-inter"
                />
                {turmaSearch && (
                  <button
                    onClick={() => setTurmaSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {filteredAreas.map(areaInfo => {
              const isExpanded = expandedArea === areaInfo.name || !!searchLower;
              const areaParticipants = participants.filter(p => p.area === areaInfo.name);

              return (
                <div key={areaInfo.name} className="space-y-2">
                  <button
                    onClick={() => setExpandedArea(isExpanded && !searchLower ? null : areaInfo.name)}
                    className={`w-full flex items-center gap-4 p-4 bg-card rounded-2xl border-2 shadow-sm transition-all ${
                      isExpanded ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <span className="text-2xl">{areaInfo.icon}</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-montserrat font-bold text-foreground text-sm">{areaInfo.name}</p>
                      <p className="text-muted-foreground font-inter text-[11px] mt-0.5 leading-snug">
                        {areaInfo.communities.join(", ")}
                      </p>
                      <p className="text-muted-foreground font-inter text-[10px] mt-1">
                        {areaParticipants.length} participante{areaParticipants.length !== 1 ? "s" : ""} · {areaInfo.turmas.length} turma{areaInfo.turmas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {!searchLower && (
                      isExpanded
                        ? <ChevronUp className="w-5 h-5 text-primary" />
                        : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="pl-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
                      {areaInfo.turmas.length === 0 ? (
                        <p className="text-muted-foreground font-inter text-xs py-3 text-center">
                          {searchLower ? "Nenhuma turma encontrada." : "Nenhuma turma ativa nesta área."}
                        </p>
                      ) : (
                        areaInfo.turmas.map(turma => {
                          const turmaParticipants = participants.filter(p => (p as any).turma_id === turma.id);
                          return (
                            <button
                              key={turma.id}
                              onClick={() => onSelectTurma(turma)}
                              className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-all"
                            >
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                                <span className="text-base">📚</span>
                              </div>
                              <div className="text-left flex-1">
                                <p className="font-montserrat font-bold text-foreground text-xs">{turma.name}</p>
                                {turma.description && (
                                  <p className="text-muted-foreground font-inter text-[10px] mt-0.5">{turma.description}</p>
                                )}
                                <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
                                  {turmaParticipants.length} participante{turmaParticipants.length !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <span className="text-muted-foreground text-sm">→</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
