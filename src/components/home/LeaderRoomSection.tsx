import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { Users, CalendarDays, MessageSquare, Bell, ChevronDown, ChevronUp, Clock, BookOpen, BarChart3, GraduationCap, FileText, BookMarked } from "lucide-react";

const AttendanceTab = lazy(() => import("@/components/admin/tabs/AttendanceTab"));
const MessagesTab = lazy(() => import("@/components/admin/tabs/MessagesTab"));
const ParticipantsTab = lazy(() => import("@/components/admin/tabs/ParticipantsTab"));
const AdminPushTab = lazy(() => import("@/components/admin/tabs/AdminPushTab"));
const PushStatusList = lazy(() => import("@/components/admin/tabs/PushStatusList"));
const CourseGuideSubTab = lazy(() => import("@/components/admin/tabs/leader/CourseGuideSubTab"));
const OverviewTab = lazy(() => import("@/components/admin/tabs/OverviewTab"));
const ReportsTab = lazy(() => import("@/components/admin/tabs/ReportsTab"));
const LeaderTurmaManagement = lazy(() => import("@/components/admin/tabs/leader/LeaderTurmaManagement"));
const LeaderGuideContent = lazy(() => import("@/components/home/LeaderGuideContent"));
import LeaderWaitingRoom from "@/components/home/LeaderWaitingRoom";


import { AREA_COMMUNITIES, ALL_COMMUNITIES, getCommunitiesForArea } from "@/config/areas";

type Activity = {
  id: string; type: string; title: string; subtitle: string | null; order_num: number; points: number;
};
type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  confirmation_year?: number | null;
  completed_lesson_count?: number;
  completed_devotional_count?: number;
  completed_event_count?: number;
  faith_points?: number;
};
type PlanInfo = { health_status: string; is_priority: boolean; needs_pastor?: boolean };
type Turma = { id: string; name: string; area: string | null };

type SubTab = "visao" | "alunos" | "encontros" | "roteiros" | "comunicacao" | "push" | "gerencia" | "relatorios" | "guia";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Users }[] = [
  { id: "visao", label: "Visão", icon: BarChart3 },
  { id: "alunos", label: "Discípulos", icon: Users },
  { id: "encontros", label: "Encontros", icon: CalendarDays },
  { id: "roteiros", label: "Roteiros", icon: BookOpen },
  { id: "guia", label: "Guia", icon: BookMarked },
  { id: "relatorios", label: "Relatórios", icon: FileText },
  { id: "comunicacao", label: "Avisos", icon: MessageSquare },
  { id: "push", label: "Push", icon: Bell },
  { id: "gerencia", label: "Confirmação", icon: GraduationCap },
];

export default function LeaderRoomSection({ asTab = false }: { asTab?: boolean }) {
  const { profile, role } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const canView = role === "admin" || role === "lider";

  const [expanded, setExpanded] = useState(asTab);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("visao");
  const [highlightedParticipant, setHighlightedParticipant] = useState<Participant | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();

  const scrollToTab = useCallback((tabId: SubTab) => {
    setActiveSubTab(tabId);
    isProgrammaticScroll.current = true;
    requestAnimationFrame(() => {
      const container = tabsContainerRef.current;
      if (!container) return;
      const idx = SUB_TABS.findIndex(t => t.id === tabId);
      const btn = container.children[idx] as HTMLElement | undefined;
      if (!btn) return;
      const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
      // Release lock after scroll animation completes
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    });
  }, []);

  const handleTabsScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    const container = tabsContainerRef.current;
    if (!container) return;
    // Debounce to avoid excessive updates
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const ctr = tabsContainerRef.current;
      if (!ctr) return;
      const centerX = ctr.scrollLeft + ctr.offsetWidth / 2;
      let closestTab: SubTab = SUB_TABS[0].id;
      let closestDist = Infinity;
      Array.from(ctr.children).forEach((child, i) => {
        const el = child as HTMLElement;
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closestTab = SUB_TABS[i].id;
        }
      });
      setActiveSubTab(closestTab);
    }, 50);
  }, []);

  // Attach passive scroll listener for better scroll performance
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container || !expanded) return;
    container.addEventListener("scroll", handleTabsScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleTabsScroll);
  }, [expanded, handleTabsScroll]);

  // Swipe gesture support for navigating between sub-tabs
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    const currentIdx = SUB_TABS.findIndex(t => t.id === activeSubTab);
    const nextIdx = direction === "left"
      ? Math.min(currentIdx + 1, SUB_TABS.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx !== currentIdx) {
      scrollToTab(SUB_TABS[nextIdx].id);
    }
  }, [activeSubTab, scrollToTab]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !expanded) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;
      // Only trigger if horizontal swipe is dominant and > 50px
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        handleSwipe(dx < 0 ? "left" : "right");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [expanded, handleSwipe]);

  const [loading, setLoading] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plans, setPlans] = useState<Record<string, PlanInfo>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);

  const turmaArea = effectiveArea || profile?.area || "";

  // Fetch waiting room count for the leader's area
  useEffect(() => {
    if (!canView || !turmaArea) return;
    async function fetchWaitingCount() {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, area, enrollment_status")
        .is("turma_id", null)
        .eq("enrollment_status", "pending");
      if (!error && data) {
        const myId = (await supabase.auth.getUser()).data.user?.id;
        const filtered = data.filter(p => p.user_id !== myId && p.area === turmaArea);
        setWaitingCount(filtered.length);
      }
    }
    fetchWaitingCount();
  }, [canView, turmaArea, expanded]);

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

  async function fetchData() {
    // Admins can view any area even without a turma_id
    const isAdmin = role === "admin";
    if (!profile?.turma_id && !isAdmin) return;
    setLoading(true);

    let profilesQuery = supabase.from("profiles").select("user_id, full_name, community, area, birth_date, phone, turma_id, confirmation_year, avatar_url, father_name, mother_name, father_phone, mother_phone, address");
    
    if (isAdmin) {
      // Admin: fetch all profiles from the effective area
      profilesQuery = profilesQuery.eq("area", turmaArea as any);
    } else {
      // Leader: fetch only their turma
      profilesQuery = profilesQuery.eq("turma_id", profile!.turma_id!);
    }

    const [
      { data: activitiesData },
      { data: profilesData },
      userResult,
      { data: turmasData },
    ] = await Promise.all([
      supabase.from("activities").select("*").order("order_num"),
      profilesQuery,
      supabase.auth.getUser(),
      supabase.from("turmas").select("id, name, area").eq("is_active", true),
    ]);

    const myId = userResult.data.user?.id ?? "";
    const profilesList = (profilesData ?? []).filter(p => p.user_id !== myId);

    const userIds = profilesList.map(p => p.user_id);
    const communitiesInScope = [...new Set(profilesList.map(p => p.community).filter(Boolean))];
    const [
      { data: progressData },
      { data: lessonResponsesData },
      { data: devotionalProgressData },
      { data: attendanceData },
      rankingResponses,
    ] = userIds.length > 0
      ? await Promise.all([
          supabase.from("user_progress").select("user_id, activity_id").in("user_id", userIds),
          supabase.from("lesson_responses").select("user_id, lesson_id").in("user_id", userIds),
          supabase.from("devotional_progress").select("user_id, devotional_id, completed_at").in("user_id", userIds),
          supabase.from("attendance").select("user_id, status").in("user_id", userIds).eq("status", "presente"),
          Promise.all(
            communitiesInScope.map((community) =>
              supabase.rpc("get_community_ranking" as any, { _community: community as any })
            )
          ),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, [] as any];

    const rankingMap = new Map<string, number>();
    const rankingFailedCommunities = new Set<string>();
    (rankingResponses ?? []).forEach((response: any, index: number) => {
      const community = communitiesInScope[index];
      if (response?.error) {
        if (community) rankingFailedCommunities.add(community);
        return;
      }
      (response.data ?? []).forEach((item: any) => {
        rankingMap.set(item.user_id, Number(item.faith_points ?? 0));
      });
    });

    const participantList: Participant[] = profilesList.map((p) => {
      const userProgress = (progressData ?? []).filter((pr) => pr.user_id === p.user_id);
      const lessonCount = new Set(
        (lessonResponsesData ?? [])
          .filter((response) => response.user_id === p.user_id)
          .map((response) => response.lesson_id)
      ).size;
      const devotionals = (devotionalProgressData ?? []).filter((progress) => progress.user_id === p.user_id);
      const devotionalCount = devotionals.length;
      const completedActivityIds = userProgress.map((pr) => pr.activity_id);
      const completedEventCount = (attendanceData ?? []).filter(a => a.user_id === p.user_id).length;

      return {
        ...p,
        completed_count: userProgress.length + lessonCount + devotionalCount,
        completed_activity_ids: completedActivityIds,
        completed_lesson_count: lessonCount,
        completed_devotional_count: devotionalCount,
        completed_event_count: completedEventCount,
        faith_points: rankingFailedCommunities.has(p.community)
          ? undefined
          : rankingMap.get(p.user_id),
        turma_id: p.turma_id,
      } as any;
    });

    setActivities(activitiesData ?? []);
    setParticipants(participantList);
    setTurmas(turmasData ?? []);
    await fetchPlans(participantList.map(p => p.user_id));
    setLoading(false);
    setDataLoaded(true);
  }

  // Re-fetch when area changes (admin switching) or on first expand
  useEffect(() => {
    if (expanded && canView) {
      setDataLoaded(false);
      fetchData();
    }
  }, [expanded, canView, turmaArea]);

  useEffect(() => {
    if (expanded && !dataLoaded && canView) {
      fetchData();
    }
  }, [expanded, dataLoaded, canView]);

  if (!canView) return null;

  const communities = getCommunitiesForArea(turmaArea ?? "");

  return (
    <div className={asTab ? "px-5" : "mx-5"}>
      {/* Collapsible header - hidden in tab mode */}
      {!asTab && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-sm hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ background: "var(--gradient-hero)" }}>
              <span className="text-lg">📋</span>
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {waitingCount}
                </span>
              )}
            </div>
            <div className="text-left">
              <p className="font-montserrat font-bold text-foreground text-sm">Sala do Discipulador</p>
              <p className="text-muted-foreground text-xs font-inter">
                {waitingCount > 0 && !expanded
                  ? `${waitingCount} pessoa${waitingCount !== 1 ? "s" : ""} na sala de espera`
                  : expanded ? "Toque para fechar" : "Gerencie sua turma"}
              </p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>
      )}

      {/* Waiting room alert banner */}
      {expanded && waitingCount > 0 && (
        <button
          onClick={() => setActiveSubTab("alunos")}
          className={`w-full ${asTab ? "" : "mt-2"} flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl p-3 hover:bg-destructive/15 transition-colors`}
        >
          <Clock className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-destructive font-inter text-xs font-semibold text-left">
            {waitingCount} pessoa{waitingCount !== 1 ? "s" : ""} aguardando na sala de espera da sua área
          </p>
        </button>
      )}

      {expanded && (
        <div className={`${asTab ? "mt-2" : "mt-3"} animate-in slide-in-from-top-2 duration-200`}>
          {/* Sub-tab navigation */}
          <div className="relative">
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-1 scrollbar-hide" ref={tabsContainerRef}>
              {SUB_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                const showBadge = tab.id === "alunos" && waitingCount > 0;
                return (
                  <button
                    key={tab.id}
                    onClick={() => scrollToTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-inter font-semibold whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]"
                        : "bg-card border border-border text-muted-foreground hover:bg-muted/50 hover:scale-[1.01]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? "scale-110" : ""}`} />
                    {tab.label}
                    {showBadge && (
                      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        isActive ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground"
                      }`}>
                        {waitingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scroll position indicator */}
            <div className="flex justify-center gap-1 pt-1 pb-2">
              {SUB_TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToTab(tab.id)}
                  className="p-0.5"
                  aria-label={tab.label}
                >
                  <div
                    className={`rounded-full transition-all duration-300 ${
                      activeSubTab === tab.id
                        ? "w-5 h-1.5 bg-primary"
                        : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Content - swipe enabled */}
          <div ref={contentRef} className="touch-pan-y">
          {loading ? (
            <div className="space-y-4 animate-fade-in">
              {/* Skeleton cards mimicking dashboard layout */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" />
                    <div className="h-3 w-1/3 rounded-md bg-muted animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded-md bg-muted animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                      <div className="h-2.5 w-1/4 rounded-md bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Suspense fallback={
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                  <div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-3/4 rounded-md bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded-md bg-muted animate-pulse" />
              </div>
            }>
              <div
                key={activeSubTab}
                className="animate-[tab-slide-in_0.35s_ease-out]"
              >
              {activeSubTab === "visao" && (
                <OverviewTab
                  participants={participants}
                  activities={activities}
                  plans={plans}
                  onSelectParticipant={(p) => {
                    setHighlightedParticipant(p);
                    setActiveSubTab("encontros");
                  }}
                />
              )}

              {activeSubTab === "alunos" && (
                <div className="space-y-4">
                  {waitingCount > 0 && (
                    <LeaderWaitingRoom
                      areaFilter={turmaArea}
                      onAssigned={() => setWaitingCount(prev => Math.max(0, prev - 1))}
                    />
                  )}
                  <ParticipantsTab participants={participants} activities={activities} communities={communities} />
                </div>
              )}

              {activeSubTab === "encontros" && (
                <AttendanceTab
                  participants={participants}
                  activities={activities}
                  communities={communities}
                  adminArea={turmaArea}
                  initialParticipant={highlightedParticipant}
                  onClearInitial={() => setHighlightedParticipant(null)}
                />
              )}

              {activeSubTab === "roteiros" && (
                <CourseGuideSubTab />
              )}

              {activeSubTab === "comunicacao" && (
                <MessagesTab />
              )}

              {activeSubTab === "push" && (
                <div className="space-y-4">
                  <AdminPushTab turmas={turmas} />
                  <div className="border-t border-border pt-4">
                    <PushStatusList adminArea={turmaArea} />
                  </div>
                </div>
              )}

              {activeSubTab === "relatorios" && (
                <ReportsTab />
              )}

              {activeSubTab === "gerencia" && (
                <LeaderTurmaManagement />
              )}

              {activeSubTab === "guia" && (
                <LeaderGuideContent />
              )}
              </div>
            </Suspense>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
