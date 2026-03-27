import { BookOpen, CheckCircle2, Sparkles } from "lucide-react";
import { SectionCard, type Plan } from "./shared";

type Props = {
  plan: Plan | null;
};

export default function GrowthPlanSection({ plan }: Props) {
  return (
    <SectionCard icon={<Sparkles className="w-4 h-4 text-accent-foreground" />} title="Plano de Crescimento Espiritual">
      {plan ? (
        <div className="space-y-3">
          {plan.objectives && (
            <div>
              <p className="font-inter text-xs font-bold text-foreground mb-1">🎯 Objetivos espirituais</p>
              <p className="font-inter text-xs text-muted-foreground leading-relaxed">{plan.objectives}</p>
            </div>
          )}
          {plan.next_steps && (
            <div>
              <p className="font-inter text-xs font-bold text-foreground mb-1">➡️ Próximos passos</p>
              <div className="space-y-1">
                {plan.next_steps.split("\n").filter(Boolean).map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand-green flex-shrink-0 mt-0.5" />
                    <p className="font-inter text-xs text-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {plan.challenges && (
            <div>
              <p className="font-inter text-xs font-bold text-foreground mb-1">⚡ Desafios propostos</p>
              <p className="font-inter text-xs text-muted-foreground leading-relaxed">{plan.challenges}</p>
            </div>
          )}
          {plan.recommendations && (
            <div>
              <p className="font-inter text-xs font-bold text-foreground mb-1">🙏 Recomendações pastorais</p>
              <p className="font-inter text-xs text-muted-foreground italic leading-relaxed">{plan.recommendations}</p>
            </div>
          )}
          {!plan.objectives && !plan.next_steps && !plan.challenges && (
            <p className="text-center text-muted-foreground font-inter text-sm py-2">Seu pastor ainda não criou seu plano. Fique de olho!</p>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="font-montserrat font-bold text-foreground text-sm">Plano ainda não criado</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Seu pastor irá criar seu plano de discipulado em breve.</p>
        </div>
      )}
    </SectionCard>
  );
}
