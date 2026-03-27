import { Sparkles } from "lucide-react";
import { SectionCard } from "./shared";

type Dimension = {
  label: string;
  emoji: string;
  score: number;
  color: string;
  bg: string;
};

type Props = {
  dimensions: Dimension[];
};

export default function ThermometerSection({ dimensions }: Props) {
  return (
    <SectionCard icon={<Sparkles className="w-4 h-4 text-secondary" />} title="Termômetro do Discipulado">
      <div className="space-y-3">
        {dimensions.map(({ label, emoji, score, color }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{emoji}</span>
                <span className="font-montserrat font-bold text-foreground text-sm">{label}</span>
              </div>
              <span className="font-montserrat font-bold text-xs" style={{ color }}>{score}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${score}%`, backgroundColor: color }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground font-inter text-[10px] mt-3 text-center">
        Baseado na sua autoavaliação, presença, estudos e atividades
      </p>
    </SectionCard>
  );
}
