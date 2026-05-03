import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

import HeroHeader from "@/components/home/HeroHeader";
import AnnouncementsSection from "@/components/home/AnnouncementsSection";
import NextCourseActivityCard from "@/components/home/NextCourseActivityCard";
import JourneyPath from "@/components/home/JourneyPath";
import AchievementsGrid from "@/components/home/AchievementsGrid";
import DiscipleProfile from "@/components/home/DiscipleProfile";
import EditProfileForm from "@/components/home/EditProfileForm";
import CommunityTab from "@/components/home/CommunityTab";
import DiscipleshipTab from "@/components/home/DiscipleshipTab";
import NextMeetingCard from "@/components/home/NextMeetingCard";
import UserAgendaTab from "@/components/home/UserAgendaTab";
import NotificationSettings from "@/components/home/NotificationSettings";
import InstallAppCard from "@/components/home/InstallAppCard";
import TypingMetricsPanel from "@/components/home/TypingMetricsPanel";
import PushActivationBanner from "@/components/home/PushActivationBanner";
import WhatsAppBlockedBanner from "@/components/home/WhatsAppBlockedBanner";
import RemindersSection from "@/components/home/RemindersSection";
import PersonalizedGreeting from "@/components/home/PersonalizedGreeting";
import BirthdayHighlights from "@/components/home/BirthdayHighlights";
import BottomNav, { type Tab } from "@/components/home/BottomNav";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserStats } from "@/hooks/useUserStats";
import { useAppNotifications } from "@/hooks/useAppNotifications";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";

type ProfileSubTab = "meu-perfil" | "minha-jornada" | "configuracoes";
type LessonNavigationMode = "choice" | "devotional";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("jornada");
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [targetLessonMode, setTargetLessonMode] = useState<LessonNavigationMode>("choice");
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("meu-perfil");
  const { profile, role } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const navigate = useNavigate();
  const stats = useUserStats(currentArea);
  useAppNotifications();

  // Listen for lesson navigation from agenda
  useEffect(() => {
    const handler = (e: Event) => {
      const lessonId = (e as CustomEvent).detail?.lessonId;
      const mode = (e as CustomEvent).detail?.mode as LessonNavigationMode | undefined;
      if (lessonId) {
        setTargetLessonId(lessonId);
        setTargetLessonMode(mode === "devotional" ? "devotional" : "choice");
        setActiveTab("discipulado");
      }
    };
    window.addEventListener("navigate-to-lesson", handler);
    return () => window.removeEventListener("navigate-to-lesson", handler);
  }, []);

  // Activity completion is now handled by the real tracking tables
  // (lesson_responses, devotional_progress, attendance, worship_attendance)
  // Not by the legacy user_progress table

  return (
    <div id="main-content" className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative">
      {/* Hero header — always visible */}
      <HeroHeader
        streakDays={stats.streakDays}
        faithPoints={stats.faithPoints}
        faithLevel={stats.faithLevel}
        faithEnergy={stats.faithEnergy}
      />

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-24">

        {/* ===== JORNADA ===== */}
        {activeTab === "jornada" && (
          <>
            {/* Push activation reminder from leader */}
            <PushActivationBanner />

            {/* Avisos do pastor no topo */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="pt-4"
            >
              <AnnouncementsSection />
            </motion.div>

            {/* Personalized greeting based on last activity */}
            <PersonalizedGreeting />

            {/* Aniversariantes do mes em destaque */}
            <BirthdayHighlights area={currentArea} variant="journey" />

            {/* Indicador de impacto espiritual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15, ease: "easeOut" }}
              className="px-5 mb-2"
            >
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const indicators: string[] = [];
                  if (stats.faithLevel >= 3) indicators.push("✨ Você está crescendo");
                  if (stats.streakDays >= 3) indicators.push("✨ Em constância");
                  if (stats.faithEnergy >= 3) indicators.push("✨ Em comunhão");
                  if (indicators.length === 0) indicators.push("🌱 Comece sua jornada!");
                  return indicators.map((text, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary font-inter text-xs font-semibold">
                      {text}
                    </span>
                  ));
                })()}
              </div>
            </motion.div>

            {/* Próximo encontro */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
            >
              <NextMeetingCard onNavigateToAgenda={() => setActiveTab("agenda")} />
            </motion.div>

            {/* Caminho da jornada — posição proeminente */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
            >
              <JourneyPath onSelectLesson={(lessonId) => {
                setTargetLessonId(lessonId);
                setTargetLessonMode("choice");
                setActiveTab("discipulado");
              }} />
            </motion.div>

            {/* Próxima etapa do curso ativo */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            >
              <NextCourseActivityCard onNavigateToDiscipulado={() => setActiveTab("discipulado")} />
            </motion.div>

            {/* Lembretes agrupados — seção colapsável */}
            <RemindersSection
              onNavigateToDiscipulado={() => setActiveTab("discipulado")}
              onNavigateToAgenda={() => setActiveTab("agenda")}
            />
          </>
        )}

        {/* ===== CONQUISTAS ===== */}
        {activeTab === "conquistas" && (
          <div key={`conquistas-${currentArea}`} className="pt-4">
            <ErrorBoundary
              fallback={
                <div className="px-5 py-6">
                  <div className="rounded-2xl border border-border bg-card p-5 text-center">
                    <h2 className="font-montserrat font-black text-foreground text-lg">Conquistas</h2>
                    <p className="mt-2 text-muted-foreground text-sm font-inter">
                      Ocorreu um erro ao carregar esta aba. Atualize a pagina e tente novamente.
                    </p>
                  </div>
                </div>
              }
            >
              <AchievementsGrid
                faithPoints={stats.faithPoints}
                streakDays={stats.streakDays}
                completedCount={stats.completedCount}
              />
              <TypingMetricsPanel />
            </ErrorBoundary>
          </div>
        )}

        {/* ===== AGENDA ===== */}
        {activeTab === "agenda" && <UserAgendaTab key={`agenda-${currentArea}`} />}

        {/* ===== COMUNIDADE ===== */}
        {activeTab === "comunidade" && <CommunityTab key={`comunidade-${currentArea}`} />}

        {/* ===== DISCIPULADO ===== */}
        {activeTab === "discipulado" && (
          <DiscipleshipTab
            key={`discipulado-${currentArea}`}
            targetLessonId={targetLessonId}
            targetLessonMode={targetLessonMode}
            onTargetLessonConsumed={() => {
              setTargetLessonId(null);
              setTargetLessonMode("choice");
            }}
          />
        )}

        {/* ===== PERFIL ===== */}
        {activeTab === "perfil" && (
          <div key={`perfil-${currentArea}`} className="pt-5 pb-4 space-y-4">
            <div className="px-5">
              <h2 className="font-montserrat font-black text-foreground text-xl">👤 Perfil</h2>
            </div>

            <WhatsAppBlockedBanner
              onNavigateToSettings={() => setProfileSubTab("configuracoes")}
            />

            <div className="px-5">
              <Tabs value={profileSubTab} onValueChange={(value) => setProfileSubTab(value as ProfileSubTab)}>
                <TabsList className="grid w-full grid-cols-3 h-11">
                  <TabsTrigger value="meu-perfil" className="text-[11px] sm:text-xs">Meu Perfil</TabsTrigger>
                  <TabsTrigger value="minha-jornada" className="text-[11px] sm:text-xs">Minha Jornada</TabsTrigger>
                  <TabsTrigger value="configuracoes" className="text-[11px] sm:text-xs">Configurações</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {profileSubTab === "meu-perfil" && (
              <>
                <DiscipleProfile
                  faithPoints={stats.faithPoints}
                  faithLevel={stats.faithLevel}
                  streakDays={stats.streakDays}
                  completedCount={stats.completedCount}
                  community={profile?.community}
                  area={effectiveArea || profile?.area}
                />

                {/* Banner instalar app */}
                <InstallAppCard />

                {/* Admin/Líder access */}
                {(role === "admin" || role === "lider") && (
                  <div className="px-5 mt-3">
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                        <ShieldCheck className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="text-left">
                        <p className="font-montserrat font-bold text-foreground text-sm">
                          {role === "admin" ? "Área do Administrador" : "Área do Líder"}
                        </p>
                        <p className="text-muted-foreground text-xs font-inter">
                          {role === "admin" ? "Gerenciar participantes e conteúdo" : "Gerenciar cursos e usuários"}
                        </p>
                      </div>
                      <span className="ml-auto text-muted-foreground text-xs">→</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {profileSubTab === "minha-jornada" && (
              <>
                <NextCourseActivityCard onNavigateToDiscipulado={() => setActiveTab("discipulado")} />
                <JourneyPath onSelectLesson={(lessonId) => {
                  setTargetLessonId(lessonId);
                  setTargetLessonMode("choice");
                  setActiveTab("discipulado");
                }} />
              </>
            )}

            {profileSubTab === "configuracoes" && (
              <>
                <div className="px-5">
                  <button
                    onClick={() => navigate("/exportar-dados")}
                    className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-montserrat font-bold text-foreground text-sm">
                        Privacidade e dados
                      </p>
                      <p className="text-muted-foreground text-xs font-inter">
                        Exportar dados ou registrar solicitacao LGPD
                      </p>
                    </div>
                    <span className="ml-auto text-muted-foreground text-xs">→</span>
                  </button>
                </div>

                {/* Edição de dados pessoais */}
                <EditProfileForm />

                {/* Notificações */}
                <NotificationSettings />
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
