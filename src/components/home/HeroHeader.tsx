import { Flame, Star, Heart, LogOut, ArrowLeftRight } from "lucide-react";
import { AREAS } from "@/config/areas";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { toast } from "sonner";

interface HeroHeaderProps {
  streakDays: number;
  faithPoints: number;
  faithLevel: number;
  faithEnergy: number;
}

export default function HeroHeader({ streakDays, faithPoints, faithLevel, faithEnergy }: HeroHeaderProps) {
  const { profile, role, signOut } = useAuth();
  const { effectiveArea, setEffectiveArea, isOverriding } = useAreaSwitch();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Bem-vindo";
  const isAdmin = role === "admin";

  return (
    <div style={{ background: "var(--gradient-hero)" }}>
      <header className="px-5 pt-6 pb-5" role="banner">
        {/* Top row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30" aria-hidden="true">
              <span className="text-xl">✝️</span>
            </div>
            <div>
              <p className="text-primary-foreground/70 text-xs font-inter">Olá, {firstName}!</p>
              <p className="text-primary-foreground font-montserrat font-bold text-sm">
                {profile?.community ?? "Confirmatório Boa Nova"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Area switcher for admins */}
            {isAdmin && (
              <div className="relative">
                <label htmlFor="area-switcher" className="sr-only">Selecionar área</label>
                <select
                  id="area-switcher"
                  value={effectiveArea}
                  onChange={async (e) => {
                    try {
                      await setEffectiveArea(e.target.value);
                    } catch {
                      toast.error("Nao foi possivel trocar a area agora.");
                    }
                  }}
                  aria-label="Selecionar área de visualização"
                  className="appearance-none bg-white/15 backdrop-blur border border-white/30 text-primary-foreground rounded-full pl-3 pr-7 py-1.5 text-xs font-inter font-semibold focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
                >
                  {AREAS.map(a => <option key={a} value={a} className="text-foreground">{a}</option>)}
                </select>
                <ArrowLeftRight className="w-3 h-3 text-primary-foreground/70 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              </div>
            )}
            <button
              onClick={signOut}
              aria-label="Sair da conta"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Area override indicator */}
        {isOverriding && (
          <div className="mb-3 bg-white/15 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2" role="status" aria-live="polite">
            <ArrowLeftRight className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
            <span className="text-primary-foreground/90 text-xs font-inter">
              Visualizando como <strong>{effectiveArea}</strong>
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Estatísticas de progresso">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 flex flex-col items-center gap-1" aria-label={`${streakDays} dias seguidos`}>
            <div className="flex items-center gap-1">
              <Flame className="w-5 h-5 text-secondary" style={{ fill: "hsl(var(--secondary))" }} aria-hidden="true" />
              <span className="font-montserrat font-black text-primary-foreground text-xl">{streakDays}</span>
            </div>
            <span className="text-primary-foreground/60 text-xs font-inter">dias seguidos</span>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 flex flex-col items-center gap-1" aria-label={`${faithPoints} pontos da fé`}>
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-accent" style={{ fill: "hsl(var(--accent))" }} aria-hidden="true" />
              <span className="font-montserrat font-black text-primary-foreground text-xl">{faithPoints}</span>
            </div>
            <span className="text-primary-foreground/60 text-xs font-inter">pontos da fé</span>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 flex flex-col items-center gap-1" aria-label={`Nível da fé: ${faithLevel}`}>
            <div className="flex items-center gap-1">
              <Heart className="w-5 h-5" style={{ fill: "hsl(0 80% 70%)", color: "hsl(0 80% 70%)" }} aria-hidden="true" />
              <span className="font-montserrat font-black text-primary-foreground text-xl">{faithLevel}</span>
            </div>
            <span className="text-primary-foreground/60 text-xs font-inter">nível da fé</span>
          </div>
        </div>

        {/* Spiritual energy — flame icons */}
        <div className="mt-3 bg-white/10 rounded-2xl p-3" role="meter" aria-label="Energia espiritual" aria-valuenow={faithEnergy} aria-valuemin={0} aria-valuemax={5}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-primary-foreground/80 text-xs font-inter font-medium">Energia espiritual</span>
            <span className="text-primary-foreground/60 text-xs">{faithEnergy}/5</span>
          </div>
          <div className="flex gap-2 justify-center" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-2xl transition-all duration-300 ${i < faithEnergy ? "drop-shadow-[0_0_6px_hsl(29_100%_50%_/_0.8)]" : "opacity-30 grayscale"}`}
                style={{ filter: i < faithEnergy ? "drop-shadow(0 0 4px hsl(29 100% 50% / 0.9))" : undefined }}
              >
                🔥
              </span>
            ))}
          </div>
        </div>
      </header>
    </div>
  );
}
