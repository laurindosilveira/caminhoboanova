import { useState } from "react";
import { BookOpen, Calendar, FileEdit, UserCheck, LayoutDashboard } from "lucide-react";
import CourseGuideSubTab from "./leader/CourseGuideSubTab";

type LeaderSubTab = "dashboard" | "guide" | "agenda" | "notes" | "attendance";

const SUB_TABS: { id: LeaderSubTab; label: string; icon: typeof BookOpen; emoji: string }[] = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard, emoji: "📊" },
  { id: "guide", label: "Roteiros", icon: BookOpen, emoji: "📋" },
  { id: "agenda", label: "Agenda", icon: Calendar, emoji: "📅" },
  { id: "notes", label: "Pastoral", icon: FileEdit, emoji: "📝" },
  { id: "attendance", label: "Presença", icon: UserCheck, emoji: "✅" },
];

export default function LeaderGuideTab() {
  const [activeSubTab, setActiveSubTab] = useState<LeaderSubTab>("guide");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="px-1">
        <h2 className="font-montserrat font-black text-foreground text-lg">👤 Área do Líder</h2>
        <p className="text-muted-foreground font-inter text-xs mt-1">
          Ferramentas para conduzir sua turma com excelência
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-inter text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="text-sm">{tab.emoji}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeSubTab === "guide" && <CourseGuideSubTab />}
      {activeSubTab === "dashboard" && <PlaceholderTab emoji="📊" title="Painel da Turma" description="Resumo visual com estatísticas de progresso, presença e alertas dos participantes da sua turma." />}
      {activeSubTab === "agenda" && <PlaceholderTab emoji="📅" title="Agenda de Encontros" description="Crie e gerencie os encontros presenciais da sua turma com datas, horários e locais." />}
      {activeSubTab === "notes" && <PlaceholderTab emoji="📝" title="Anotações Pastorais" description="Registre notas privadas de acompanhamento individual sobre cada participante." />}
      {activeSubTab === "attendance" && <PlaceholderTab emoji="✅" title="Presença Rápida" description="Marque a presença dos participantes de forma simplificada durante os encontros." />}
    </div>
  );
}

function PlaceholderTab({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <span className="text-3xl">{emoji}</span>
      </div>
      <h3 className="font-montserrat font-bold text-foreground text-base mb-2">{title}</h3>
      <p className="text-muted-foreground font-inter text-sm max-w-xs">{description}</p>
      <div className="mt-4 px-4 py-2 rounded-xl bg-primary/10 text-primary font-inter text-xs font-medium">
        Em breve
      </div>
    </div>
  );
}
