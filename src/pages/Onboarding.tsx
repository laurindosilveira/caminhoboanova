import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PLANS } from "@/lib/stripePlans";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Church, User, Users, ClipboardList, ArrowRight, ArrowLeft,
  CheckCircle2, Sparkles, Star, Phone, Mail, MapPin, Hash,
  Target, Heart, Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
interface ChurchInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface PastorInfo {
  fullName: string;
  role: string;
  phone: string;
  email: string;
}

interface CommunityInfo {
  memberCount: string;
  averageAge: string;
  activities: string;
}

interface QuestionnaireInfo {
  objectives: string;
  needs: string;
  preferences: string;
}

type StepKey = "church" | "pastor" | "community" | "questionnaire" | "recommendation";

const STEPS: { key: StepKey; label: string; icon: typeof Church }[] = [
  { key: "church", label: "Igreja", icon: Church },
  { key: "pastor", label: "Pastor", icon: User },
  { key: "community", label: "Comunidade", icon: Users },
  { key: "questionnaire", label: "Questionário", icon: ClipboardList },
  { key: "recommendation", label: "Recomendação", icon: Star },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

function recommendPlan(community: CommunityInfo, questionnaire: QuestionnaireInfo): "comunidade" | "crescimento" | "pastoral" {
  const members = parseInt(community.memberCount) || 0;
  const needsKeywords = (questionnaire.needs + " " + questionnaire.objectives + " " + questionnaire.preferences).toLowerCase();

  const hasPastoralNeeds = ["pastoral", "acompanhamento", "individual", "múltiplas", "multiplas", "multi", "ilimitado", "termômetro", "crescimento individual"].some(k => needsKeywords.includes(k));
  const hasGrowthNeeds = ["gamificação", "gamificacao", "ranking", "desafio", "turma", "relatório", "relatorio", "engajamento", "notificação", "notificacao"].some(k => needsKeywords.includes(k));

  if (members > 250 || hasPastoralNeeds) return "pastoral";
  if (members > 100 || hasGrowthNeeds) return "crescimento";
  return "comunidade";
}

const PLAN_DETAILS: Record<string, { emoji: string; color: string; members: string; features: string[] }> = {
  comunidade: {
    emoji: "🟢",
    color: "from-[hsl(var(--brand-green))] to-[hsl(160,60%,35%)]",
    members: "Até 100 membros",
    features: ["Trilhas de discipulado", "Devocionais diários", "Agenda da igreja", "Chat comunitário", "Pedidos de oração", "Controle de presença"],
  },
  crescimento: {
    emoji: "🔵",
    color: "from-[hsl(var(--primary))] to-[hsl(250,55%,45%)]",
    members: "Até 250 membros",
    features: ["Tudo do Comunidade", "Gamificação completa", "Relatórios de engajamento", "Gestão de turmas", "Notificações segmentadas"],
  },
  pastoral: {
    emoji: "🟣",
    color: "from-[hsl(270,60%,55%)] to-[hsl(280,55%,45%)]",
    members: "Membros ilimitados",
    features: ["Tudo do Crescimento", "Termômetro espiritual", "Plano de crescimento individual", "Multi-comunidades", "Relatórios pastorais", "Suporte prioritário"],
  },
};

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [church, setChurch] = useState<ChurchInfo>({ name: "", address: "", phone: "", email: "" });
  const [pastor, setPastor] = useState<PastorInfo>({ fullName: "", role: "Pastor", phone: "", email: "" });
  const [community, setCommunity] = useState<CommunityInfo>({ memberCount: "", averageAge: "", activities: "" });
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireInfo>({ objectives: "", needs: "", preferences: "" });

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const canNext = (): boolean => {
    switch (currentStep.key) {
      case "church":
        return !!(church.name.trim() && church.email.trim());
      case "pastor":
        return !!(pastor.fullName.trim() && pastor.phone.trim());
      case "community":
        return !!(community.memberCount.trim());
      case "questionnaire":
        return !!(questionnaire.objectives.trim());
      default:
        return true;
    }
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const [searchParams] = useSearchParams();
  const preselectedPlan = searchParams.get("plano") as "comunidade" | "crescimento" | "pastoral" | null;
  const validPreselected = preselectedPlan && ["comunidade", "crescimento", "pastoral"].includes(preselectedPlan) ? preselectedPlan : null;

  const recommendedPlan = validPreselected || recommendPlan(community, questionnaire);
  const planInfo = STRIPE_PLANS[recommendedPlan];
  const planDetail = PLAN_DETAILS[recommendedPlan];

  const handleCheckout = useCallback(async (priceId: string) => {
    setCheckoutLoading(true);
    try {
      // Save church data to database before checkout
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      const { error: insertError } = await supabase.from("church_subscriptions" as any).insert({
        church_name: church.name,
        church_address: church.address,
        church_phone: church.phone,
        church_email: church.email,
        pastor_name: pastor.fullName,
        pastor_role: pastor.role,
        pastor_phone: pastor.phone,
        pastor_email: pastor.email,
        member_count: community.memberCount,
        average_age: community.averageAge,
        activities: community.activities,
        objectives: questionnaire.objectives,
        needs: questionnaire.needs,
        preferences: questionnaire.preferences,
        recommended_plan: recommendedPlan,
        subscription_status: "pending_checkout",
        trial_ends_at: trialEndsAt.toISOString(),
      });

      if (insertError) console.error("Erro ao salvar dados da igreja:", insertError);

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch {
      toast({ title: "Erro", description: "Não foi possível iniciar o checkout. Tente novamente.", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  }, [church, pastor, community, questionnaire, recommendedPlan]);

  // ─── Field helpers ─────────────────────────────────────
  const inputClass = "bg-card border-border focus:border-primary";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <Church className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-montserrat font-bold text-lg text-foreground">Caminho</h1>
            <p className="text-xs text-muted-foreground font-inter">Cadastro da sua igreja</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? "bg-primary text-primary-foreground"
                : i === step ? "bg-primary/15 text-primary ring-2 ring-primary"
                : "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className="hidden sm:inline text-xs font-inter font-medium text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep.key}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {currentStep.key === "church" && (
              <StepCard icon={Church} title="Informações da Igreja" subtitle="Conte-nos sobre sua comunidade">
                <FieldGroup label="Nome da igreja *" icon={Church}>
                  <Input className={inputClass} placeholder="Ex: Igreja Comunidade da Graça" value={church.name} onChange={e => setChurch({ ...church, name: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Endereço" icon={MapPin}>
                  <Input className={inputClass} placeholder="Rua, número, cidade - UF" value={church.address} onChange={e => setChurch({ ...church, address: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Telefone de contato" icon={Phone}>
                  <Input className={inputClass} type="tel" placeholder="(51) 99999-9999" value={church.phone} onChange={e => setChurch({ ...church, phone: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="E-mail de contato *" icon={Mail}>
                  <Input className={inputClass} type="email" placeholder="contato@suaigreja.com.br" value={church.email} onChange={e => setChurch({ ...church, email: e.target.value })} />
                </FieldGroup>
              </StepCard>
            )}

            {currentStep.key === "pastor" && (
              <StepCard icon={User} title="Dados do Pastor" subtitle="Responsável principal pela conta">
                <FieldGroup label="Nome completo *" icon={User}>
                  <Input className={inputClass} placeholder="Nome do pastor ou líder" value={pastor.fullName} onChange={e => setPastor({ ...pastor, fullName: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Cargo" icon={Star}>
                  <Input className={inputClass} placeholder="Ex: Pastor, Coordenador, Líder" value={pastor.role} onChange={e => setPastor({ ...pastor, role: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Telefone *" icon={Phone}>
                  <Input className={inputClass} type="tel" placeholder="(51) 99999-9999" value={pastor.phone} onChange={e => setPastor({ ...pastor, phone: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="E-mail" icon={Mail}>
                  <Input className={inputClass} type="email" placeholder="pastor@email.com" value={pastor.email} onChange={e => setPastor({ ...pastor, email: e.target.value })} />
                </FieldGroup>
              </StepCard>
            )}

            {currentStep.key === "community" && (
              <StepCard icon={Users} title="Informações da Comunidade" subtitle="Nos ajude a entender seu contexto">
                <FieldGroup label="Número de membros ativos *" icon={Hash}>
                  <Input className={inputClass} type="number" min="1" placeholder="Ex: 80" value={community.memberCount} onChange={e => setCommunity({ ...community, memberCount: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Idade média dos membros" icon={Users}>
                  <Input className={inputClass} placeholder="Ex: 25-35 anos" value={community.averageAge} onChange={e => setCommunity({ ...community, averageAge: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Atividades e ministérios oferecidos" icon={Heart}>
                  <Textarea className={inputClass} placeholder="Ex: Culto dominical, grupo de jovens, escola bíblica, louvor..." rows={3} value={community.activities} onChange={e => setCommunity({ ...community, activities: e.target.value })} />
                </FieldGroup>
              </StepCard>
            )}

            {currentStep.key === "questionnaire" && (
              <StepCard icon={ClipboardList} title="Questionário de Recomendação" subtitle="Para indicarmos o melhor plano">
                <FieldGroup label="Quais os principais objetivos da sua igreja? *" icon={Target}>
                  <Textarea className={inputClass} placeholder="Ex: Engajar jovens, organizar grupos de estudo, acompanhar crescimento espiritual..." rows={3} value={questionnaire.objectives} onChange={e => setQuestionnaire({ ...questionnaire, objectives: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Quais as necessidades específicas da comunidade?" icon={Heart}>
                  <Textarea className={inputClass} placeholder="Ex: Gamificação para jovens, relatórios para liderança, acompanhamento pastoral individual..." rows={3} value={questionnaire.needs} onChange={e => setQuestionnaire({ ...questionnaire, needs: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="Quais funcionalidades são mais importantes para vocês?" icon={Zap}>
                  <Textarea className={inputClass} placeholder="Ex: Chat comunitário, devocionais diários, controle de presença, notificações push..." rows={3} value={questionnaire.preferences} onChange={e => setQuestionnaire({ ...questionnaire, preferences: e.target.value })} />
                </FieldGroup>
              </StepCard>
            )}

            {currentStep.key === "recommendation" && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
                    <Sparkles className="w-8 h-8 text-primary-foreground" />
                  </motion.div>
                  <h2 className="font-montserrat font-black text-2xl text-foreground">Plano Recomendado</h2>
                  <p className="text-muted-foreground font-inter text-sm">
                    Com base nas informações da <strong>{church.name || "sua igreja"}</strong>, recomendamos:
                  </p>
                </div>

                <Card className="border-2 border-primary overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${planDetail.color}`} />
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl mb-1">{planDetail.emoji}</p>
                        <h3 className="font-montserrat font-black text-2xl text-foreground">{planInfo.name}</h3>
                        <p className="text-sm text-muted-foreground font-inter">{planDetail.members}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-montserrat font-black text-3xl text-foreground">{planInfo.price}</p>
                        <p className="text-muted-foreground text-sm">{planInfo.period}</p>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {planDetail.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm font-inter text-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handleCheckout(planInfo.price_id)}
                      disabled={checkoutLoading}
                      className="w-full h-14 text-lg font-montserrat font-bold rounded-xl text-primary-foreground"
                      style={{ background: "var(--gradient-hero)" }}
                    >
                      {checkoutLoading ? "Redirecionando..." : "Começar com teste grátis de 30 dias"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Other plans */}
                <p className="text-center text-xs text-muted-foreground font-inter">
                  Prefere outro plano?{" "}
                  <a href="/apresentacao#planos" className="text-primary underline hover:no-underline">Ver todos os planos</a>
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer navigation */}
      {currentStep.key !== "recommendation" && (
        <div className="sticky bottom-0 bg-background border-t border-border">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={goBack} disabled={step === 0} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground font-inter">
              {step + 1} de {STEPS.length}
            </span>
            <Button
              onClick={goNext}
              disabled={!canNext()}
              className="gap-2 text-primary-foreground"
              style={{ background: "var(--gradient-hero)" }}
            >
              {step === STEPS.length - 2 ? "Ver recomendação" : "Próximo"} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable sub-components ─────────────────────────────
function StepCard({ icon: Icon, title, subtitle, children }: { icon: typeof Church; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="font-montserrat font-bold text-xl text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground font-inter">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function FieldGroup({ label, icon: Icon, children }: { label: string; icon: typeof Church; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm font-inter font-medium text-foreground">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        {label}
      </Label>
      {children}
    </div>
  );
}
