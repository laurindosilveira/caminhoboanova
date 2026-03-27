import { Sparkles } from "lucide-react";
import { SectionCard } from "./shared";

type Reward = {
  icon: string;
  title: string;
  subtitle: string;
  earned: boolean;
  bg: string;
};

type Props = {
  rewards: Reward[];
};

export default function RewardsSection({ rewards }: Props) {
  if (rewards.length === 0) return null;

  return (
    <SectionCard icon={<Sparkles className="w-4 h-4 text-accent-foreground" />} title="Recompensas Espirituais">
      <p className="text-muted-foreground font-inter text-[10px] mb-3 text-center">
        Reconhecimento pela sua dedicação — não é competição, é celebração! 🎉
      </p>
      <div className="grid grid-cols-2 gap-2">
        {rewards.map((reward, i) => (
          <div
            key={i}
            className={`rounded-xl p-3 text-center transition-all ${
              reward.earned
                ? `${reward.bg} border border-transparent`
                : "bg-muted/30 border border-dashed border-border opacity-60"
            }`}
          >
            <span className={`text-2xl ${reward.earned ? "" : "grayscale opacity-40"}`}>{reward.icon}</span>
            <p className={`font-montserrat font-bold text-xs mt-1 ${reward.earned ? "text-foreground" : "text-muted-foreground"}`}>
              {reward.title}
            </p>
            <p className="font-inter text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {reward.subtitle}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
