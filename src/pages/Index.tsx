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
import RemindersSection from "@/components/home/RemindersSection";
import PersonalizedGreeting from "@/components/home/PersonalizedGreeting";
import BottomNav, { type Tab } from "@/components/home/BottomNav";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserStats } from "@/hooks/useUserStats";
import { useAppNotifications } from "@/hooks/useAppNotifications";

type ProfileSubTab = "meu-perfil" | "minha-jornada" | "configuracoes";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("jornada");
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>("meu-perfil");
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  const stats = useUserStats();
  useAppNotifications();

  // Listen for lesson navigation from agenda
  useEffect(() => {
    const handler = (e: Event) => {
      const lessonId = (e as CustomEvent).detail?.lessonId;
      if (lessonId) {
        setTargetLessonId(lessonId);
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
              <JourneyPath />
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
          <div className="pt-4">
            <AchievementsGrid
              faithPoints={stats.faithPoints}
              streakDays={stats.streakDays}
              completedCount={stats.completedCount}
            />
            <TypingMetricsPanel />
          </div>
        )}

        {/* ===== AGENDA ===== */}
        {activeTab === "agenda" && <UserAgendaTab />}

        {/* ===== COMUNIDADE ===== */}
        {activeTab === "comunidade" && <CommunityTab />}

        {/* ===== DISCIPULADO ===== */}
        {activeTab === "discipulado" && (
          <DiscipleshipTab
            targetLessonId={targetLessonId}
            onTargetLessonConsumed={() => setTargetLessonId(null)}
          />
        )}

        {/* ===== PERFIL ===== */}
        {activeTab === "perfil" && (
          <div className="pt-5 pb-4 space-y-4">
            <div className="px-5">
              <h2 className="font-montserrat font-black text-foreground text-xl">👤 Perfil</h2>
            </div>

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
                  area={profile?.area}
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
                <JourneyPath />
              </>
            )}

            {profileSubTab === "configuracoes" && (
              <>
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
