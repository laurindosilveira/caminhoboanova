import { BarChart3, BookOpen, Shield, Megaphone, Settings, AlertTriangle, Crown } from "lucide-react";

export type AdminTab = "overview" | "alerts" | "courses" | "leaders" | "push" | "users" | "settings";

type TabDef = { id: AdminTab; label: string; icon: typeof BarChart3 };

const ALL_TABS: TabDef[] = [
  { id: "overview", label: "Visão", icon: BarChart3 },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
  { id: "courses", label: "Cursos", icon: BookOpen },
  { id: "leaders", label: "Líderes", icon: Crown },
  { id: "push", label: "Push", icon: Megaphone },
  { id: "users", label: "Usuários", icon: Shield },
  { id: "settings", label: "Config", icon: Settings },
];

const LIDER_TABS: AdminTab[] = ["courses", "push", "users"];

type Props = { active: AdminTab; onChange: (tab: AdminTab) => void; userRole?: "admin" | "lider" | null };

export default function AdminBottomNav({ active, onChange, userRole }: Props) {
  const tabs = userRole === "lider" ? ALL_TABS.filter(t => LIDER_TABS.includes(t.id)) : ALL_TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      aria-label="Navegação do painel administrativo"
      role="tablist"
    >
      <div className="max-w-2xl mx-auto flex overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => onChange(tab.id)}
              className="flex-1 min-w-[60px] flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] font-inter font-medium leading-none ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
