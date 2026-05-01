import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AUTOMATED_SYSTEM_UPDATES } from "@/data/systemUpdates";
import { isAuthorizedSystemAdmin } from "@/lib/systemAdminAccess";
import {
  ArrowLeft,
  CheckCircle2,
  Church,
  Clock,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface ChurchSubscription {
  id: string;
  church_name: string;
  church_email: string;
  pastor_name: string;
  pastor_phone: string;
  member_count: string;
  recommended_plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending_checkout: { label: "Aguardando checkout", color: "bg-warning/10 text-warning border-warning/30", icon: Clock },
  trial: { label: "Em trial (30 dias)", color: "bg-brand-green/10 text-brand-green border-brand-green/30", icon: Clock },
  active: { label: "Ativo", color: "bg-brand-green/10 text-brand-green border-brand-green/30", icon: CheckCircle2 },
  canceled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  blocked: { label: "Bloqueado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: ShieldAlert },
};

const PLAN_LABELS: Record<string, { label: string; emoji: string }> = {
  comunidade: { label: "Comunidade", emoji: "Comunidade" },
  crescimento: { label: "Crescimento", emoji: "Crescimento" },
  pastoral: { label: "Pastoral", emoji: "Pastoral" },
};

const UPDATE_TYPE_OPTIONS = [
  { value: "nova_funcionalidade", label: "Nova funcionalidade", color: "bg-brand-green/10 text-brand-green border-brand-green/30" },
  { value: "melhoria", label: "Melhoria", color: "bg-primary/10 text-primary border-primary/30" },
  { value: "correcao", label: "Correcao", color: "bg-warning/10 text-warning border-warning/30" },
  { value: "comunicado", label: "Comunicado", color: "bg-muted text-muted-foreground border-border" },
];

export default function AdminSistema() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [churches, setChurches] = useState<ChurchSubscription[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [systemAdminChecked, setSystemAdminChecked] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    let isMounted = true;

    async function checkSystemAdmin() {
      if (!user?.email) {
        setIsSystemAdmin(false);
        setSystemAdminChecked(true);
        setChurchesLoading(false);
        return;
      }

      setSystemAdminChecked(false);
      const allowed = await isAuthorizedSystemAdmin();
      if (!isMounted) return;

      setIsSystemAdmin(allowed);
      setSystemAdminChecked(true);
      if (allowed) {
        fetchChurches();
      } else {
        setChurches([]);
        setChurchesLoading(false);
      }
    }

    if (!authLoading) checkSystemAdmin();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.email]);

  async function fetchChurches() {
    setChurchesLoading(true);
    const { data, error } = await supabase
      .from("church_subscriptions" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Erro ao carregar igrejas", variant: "destructive" });
    } else {
      setChurches((data as any) ?? []);
    }

    setChurchesLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("church_subscriptions" as any)
      .update({ subscription_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
      return;
    }

    toast({ title: `Status atualizado para "${STATUS_MAP[newStatus]?.label ?? newStatus}"` });
    fetchChurches();
  }

  const filteredChurches = churches.filter((church) => {
    const matchesSearch =
      church.church_name.toLowerCase().includes(search.toLowerCase()) ||
      church.pastor_name.toLowerCase().includes(search.toLowerCase()) ||
      church.church_email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || church.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const churchStats = {
    total: churches.length,
    trial: churches.filter((church) => church.subscription_status === "trial" || church.subscription_status === "pending_checkout").length,
    active: churches.filter((church) => church.subscription_status === "active").length,
    canceled: churches.filter((church) => church.subscription_status === "canceled" || church.subscription_status === "blocked").length,
  };

  const latestAutomatedUpdate = AUTOMATED_SYSTEM_UPDATES[0] ?? null;
  const selectedUpdate = AUTOMATED_SYSTEM_UPDATES.find((item) => item.id === selectedUpdateId) ?? null;

  if (authLoading) return null;
  if (!systemAdminChecked) return null;
  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <CardTitle className="font-montserrat text-xl font-black text-foreground">Acesso restrito</CardTitle>
            <CardDescription>Seu usuario nao esta autorizado a acessar esta area.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full rounded-xl" onClick={() => navigate("/")}>Voltar para o app</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--gradient-hero)" }}>
            <Church className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-montserrat text-lg font-black text-foreground">Administracao do Sistema</h1>
            <p className="text-xs text-muted-foreground">Gestao de igrejas, assinaturas e atualizacoes automaticas do app</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="igrejas" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-muted/60 p-2">
            <TabsTrigger value="igrejas" className="rounded-xl px-4 py-2">Igrejas</TabsTrigger>
            <TabsTrigger value="atualizacoes" className="rounded-xl px-4 py-2">Atualizacoes do app</TabsTrigger>
          </TabsList>

          <TabsContent value="igrejas" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Total", value: churchStats.total, icon: Church, color: "text-primary" },
                { label: "Em trial", value: churchStats.trial, icon: Clock, color: "text-warning" },
                { label: "Ativos", value: churchStats.active, icon: CheckCircle2, color: "text-brand-green" },
                { label: "Cancelados", value: churchStats.canceled, icon: XCircle, color: "text-destructive" },
              ].map((stat) => (
                <Card key={stat.label} className="border-border">
                  <CardContent className="flex items-center gap-3 p-4">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <div>
                      <p className="font-montserrat text-2xl font-black text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, pastor ou email..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="rounded-xl pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {["all", "pending_checkout", "trial", "active", "canceled", "blocked"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="rounded-xl text-xs"
                  >
                    {status === "all" ? "Todos" : STATUS_MAP[status]?.label ?? status}
                  </Button>
                ))}
              </div>
              <Button variant="outline" size="icon" onClick={fetchChurches} className="rounded-xl">
                <RefreshCw className={`h-4 w-4 ${churchesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {churchesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : filteredChurches.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <Church className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-montserrat font-bold text-foreground">Nenhuma igreja encontrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {search ? "Tente buscar com outros termos." : "As igrejas aparecerao aqui apos o cadastro via onboarding."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredChurches.map((church) => {
                  const status = STATUS_MAP[church.subscription_status] ?? STATUS_MAP.pending_checkout;
                  const plan = PLAN_LABELS[church.recommended_plan] ?? { label: church.recommended_plan, emoji: "Plano" };
                  const StatusIcon = status.icon;
                  const trialDaysLeft = church.trial_ends_at
                    ? Math.max(0, Math.ceil((new Date(church.trial_ends_at).getTime() - Date.now()) / 86400000))
                    : null;

                  return (
                    <Card key={church.id} className="border-border transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className="truncate font-montserrat font-bold text-foreground">{church.church_name}</h3>
                              <Badge variant="outline" className={`border text-[10px] ${status.color}`}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-4">
                              <span>Pastor: {church.pastor_name}</span>
                              <span>Email: {church.church_email}</span>
                              <span>Membros: {church.member_count || "-"}</span>
                              <span>{plan.emoji} {plan.label}</span>
                            </div>

                            {trialDaysLeft !== null && church.subscription_status !== "active" && (
                              <p className={`mt-1.5 text-xs ${trialDaysLeft <= 5 ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                                {trialDaysLeft > 0 ? `${trialDaysLeft} dias restantes no trial` : "Trial expirado"}
                              </p>
                            )}

                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Cadastrado em {new Date(church.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            {church.subscription_status !== "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-brand-green/30 text-xs text-brand-green hover:bg-brand-green/10"
                                onClick={() => updateStatus(church.id, "active")}
                              >
                                Ativar
                              </Button>
                            )}
                            {church.subscription_status !== "blocked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => updateStatus(church.id, "blocked")}
                              >
                                Bloquear
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="atualizacoes" className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-montserrat text-xl font-black">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Preenchimento automatico
                  </CardTitle>
                  <CardDescription>
                    Esta area agora recebe as informacoes das atualizacoes automaticamente a partir do proprio projeto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">Como funciona agora</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O painel mostra a versao atual publicada no build e o historico versionado das entregas sem depender de formulario manual no app.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Versao atual</p>
                      <p className="mt-1 font-montserrat text-2xl font-black text-foreground">
                        {latestAutomatedUpdate?.version ?? "Sem versao"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Build atual</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {latestAutomatedUpdate ? new Date(latestAutomatedUpdate.createdAt).toLocaleString("pt-BR") : "Nao disponivel"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Origem das informacoes</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O historico desta aba e lido diretamente do projeto e exibido automaticamente no admin do sistema sempre que houver novo deploy.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-montserrat text-xl font-black">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Visao geral
                  </CardTitle>
                  <CardDescription>Resumo rapido do historico automatico desta versao do app.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="mt-1 font-montserrat text-3xl font-black text-foreground">{AUTOMATED_SYSTEM_UPDATES.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultima publicacao</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {latestAutomatedUpdate ? new Date(latestAutomatedUpdate.createdAt).toLocaleDateString("pt-BR") : "Nenhuma ainda"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">Beneficio principal</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Voce nao precisa mais abrir o app para cadastrar a atualizacao manualmente. O painel recebe esse conteudo sozinho a partir do codigo publicado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-montserrat text-xl font-black text-foreground">Historico de atualizacoes</h2>
                <p className="text-sm text-muted-foreground">Entradas automaticas exibidas pelo admin do sistema.</p>
              </div>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-xl">
                <RefreshCw className="mr-2 h-4 w-4" />
                Recarregar painel
              </Button>
            </div>

            {AUTOMATED_SYSTEM_UPDATES.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-montserrat font-bold text-foreground">Nenhuma atualizacao automatica encontrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assim que houver uma nova versao publicada, ela aparecera automaticamente aqui.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {AUTOMATED_SYSTEM_UPDATES.map((item) => {
                  const typeConfig = UPDATE_TYPE_OPTIONS.find((option) => option.value === item.updateType) ?? UPDATE_TYPE_OPTIONS[1];

                  return (
                    <Card
                      key={item.id}
                      className="cursor-pointer border-border transition-all hover:-translate-y-0.5 hover:shadow-md"
                      onClick={() => setSelectedUpdateId(item.id)}
                    >
                      <CardContent className="p-5">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-montserrat text-lg font-black text-foreground">{item.title}</h3>
                            <Badge variant="outline" className={`border ${typeConfig.color}`}>
                              {typeConfig.label}
                            </Badge>
                            {item.version && (
                              <Badge variant="secondary" className="rounded-full">
                                {item.version}
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>

                          {item.details && (
                            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-6 text-foreground">
                              {item.details}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Registrado em {new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                            <span>Por {item.authorName || "Sistema"}</span>
                          </div>

                          <p className="text-xs font-medium text-primary">
                            Clique para ver o que foi modificado no codigo
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedUpdate} onOpenChange={(open) => setSelectedUpdateId(open ? selectedUpdateId : null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          {selectedUpdate && (
            <>
              <DialogHeader>
                <DialogTitle className="font-montserrat text-2xl font-black text-foreground">
                  {selectedUpdate.title}
                </DialogTitle>
                <DialogDescription>
                  Detalhamento tecnico do que foi alterado no codigo nesta atualizacao.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`border ${UPDATE_TYPE_OPTIONS.find((option) => option.value === selectedUpdate.updateType)?.color ?? ""}`}>
                    {UPDATE_TYPE_OPTIONS.find((option) => option.value === selectedUpdate.updateType)?.label ?? selectedUpdate.updateType}
                  </Badge>
                  {selectedUpdate.version && (
                    <Badge variant="secondary" className="rounded-full">
                      {selectedUpdate.version}
                    </Badge>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-semibold text-foreground">Resumo</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedUpdate.summary}</p>
                </div>

                {selectedUpdate.details && (
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Contexto</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedUpdate.details}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">O que foi modificado no codigo</p>
                  <div className="mt-3 space-y-3">
                    {selectedUpdate.codeChanges.map((change) => (
                      <div key={`${selectedUpdate.id}-${change.area}`} className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="font-mono text-xs font-semibold text-foreground">{change.area}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{change.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Registrado em {new Date(selectedUpdate.createdAt).toLocaleString("pt-BR")}</span>
                  <span>Por {selectedUpdate.authorName || "Sistema"}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
