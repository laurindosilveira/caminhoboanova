import { Flame } from "lucide-react";
import { SectionCard, ProgressRing } from "./shared";

type Props = {
  doneDev: number;
  totalDev: number;
  doneForm: number;
  totalForm: number;
  doneEnc: number;
  totalEnc: number;
  completedActs: number;
  totalActs: number;
  pct: number;
};

export default function SpiritualHealthSection({
  doneDev, totalDev, doneForm, totalForm, doneEnc, totalEnc,
  completedActs, totalActs, pct,
}: Props) {
  const segments = [
    { label: "Devocionais", done: doneDev, total: totalDev, color: "#2ECC71" },
    { label: "Formações", done: doneForm, total: totalForm, color: "#1F3C88" },
    { label: "Encontros", done: doneEnc, total: totalEnc, color: "#FF7A00" },
  ];

  return (
    <SectionCard icon={<Flame className="w-4 h-4 text-secondary" />} title="Saúde Espiritual">
      <div className="grid grid-cols-3 gap-3 mb-3">
        {segments.map(({ label, done, total, color }) => {
          const p = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="relative">
                <ProgressRing pct={p} color={color} size={60} />
                <span className="absolute inset-0 flex items-center justify-center font-montserrat font-black text-foreground text-xs">{p}%</span>
              </div>
              <p className="font-inter text-[10px] text-muted-foreground text-center">{label}</p>
              <p className="font-montserrat font-bold text-foreground text-xs">{done}/{total}</p>
            </div>
          );
        })}
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{
          width: `${pct}%`,
          background: pct >= 70 ? "var(--gradient-green)" : pct >= 34 ? "var(--gradient-orange)" : "hsl(var(--destructive))",
        }} />
      </div>
      <p className="text-center text-muted-foreground font-inter text-xs mt-1.5">{completedActs}/{totalActs} atividades concluídas · {pct}%</p>
    </SectionCard>
  );
}
