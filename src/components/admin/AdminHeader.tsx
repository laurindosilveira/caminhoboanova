import { LogOut, ChevronLeft, RefreshCw } from "lucide-react";
import TurmaReportPDF from "./TurmaReportPDF";

type Stats = {
  total: number;
  avancados: number;
  semAtividade: number;
  mediaProgresso: number;
};

type Props = {
  areaName: string;
  subtitle?: string | null;
  stats: Stats;
  onSignOut: () => void;
  onBackToUser: () => void;
  selectedCommunity?: string | null;
  onChangeCommunity?: () => void;
  participants?: any[];
  activities?: any[];
  turmaLabel?: string;
};

export default function AdminHeader({ areaName, subtitle, stats, onSignOut, onBackToUser, selectedCommunity, onChangeCommunity, participants, activities, turmaLabel }: Props) {
  return (
    <header className="px-4 pt-8 pb-5" style={{ background: "var(--gradient-hero)" }}>
      <div className="max-w-2xl mx-auto">
        {/* Back to user area button */}
        <button
          onClick={onBackToUser}
          className="flex items-center gap-1.5 text-primary-foreground/70 font-inter text-xs mb-3 hover:text-primary-foreground transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Voltar para área geral
        </button>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center">
              <span className="text-xl">✝️</span>
            </div>
            <div>
              <p className="text-primary-foreground/60 font-inter text-xs">Painel do Administrador</p>
              <h1 className="font-montserrat font-black text-primary-foreground text-lg">{areaName}</h1>
              {subtitle && <p className="text-primary-foreground/60 font-inter text-xs mt-0.5">📍 {subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {participants && activities && participants.length > 0 && (
              <TurmaReportPDF
                participants={participants}
                activities={activities}
                turmaName={turmaLabel || areaName}
              />
            )}
            {selectedCommunity && onChangeCommunity && (
              <button
                onClick={onChangeCommunity}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
                title="Trocar turma"
              >
                <RefreshCw className="w-4.5 h-4.5 text-primary-foreground" style={{ width: 18, height: 18 }} />
              </button>
            )}
            <button
              onClick={onSignOut}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
              title="Sair"
            >
              <LogOut className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Participantes", value: stats.total, icon: "👥" },
            { label: "Avançados", value: stats.avancados, icon: "🏆" },
            { label: "Sem atividade", value: stats.semAtividade, icon: "⚠️" },
            { label: "Progresso médio", value: `${stats.mediaProgresso}%`, icon: "📊" },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 backdrop-blur rounded-2xl p-2.5 text-center">
              <span className="text-lg">{s.icon}</span>
              <p className="font-montserrat font-black text-primary-foreground text-lg leading-none mt-1">{s.value}</p>
              <p className="text-primary-foreground/50 text-[10px] font-inter mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
