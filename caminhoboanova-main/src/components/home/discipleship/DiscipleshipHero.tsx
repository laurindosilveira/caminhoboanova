import { HealthBadge } from "./shared";

type Props = {
  fullName?: string;
  community?: string;
  healthStatus: string;
};

export default function DiscipleshipHero({ fullName, community, healthStatus }: Props) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-6 translate-x-6 pointer-events-none" />
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl border border-white/20">
          🕊️
        </div>
        <div>
          <p className="text-primary-foreground/60 font-inter text-xs">Minha caminhada espiritual</p>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg leading-tight">
            {fullName?.split(" ")[0] ?? "Discípulo"}
          </h2>
          <p className="text-primary-foreground/70 text-xs font-inter">{community}</p>
        </div>
      </div>
      <HealthBadge status={healthStatus} />
      <p className="text-primary-foreground/80 font-inter text-xs mt-2 italic">
        {healthStatus === "saudavel"
          ? "🔥 Continue firme! Sua caminhada está inspirando outros!"
          : healthStatus === "atencao"
          ? "💛 Deus está com você. Um passo de cada vez!"
          : "🙏 Não desista. O Senhor é sua força nos dias difíceis."}
      </p>
    </div>
  );
}
