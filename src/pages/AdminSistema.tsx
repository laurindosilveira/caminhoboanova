import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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

interface SystemUpdateItem {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  version: string | null;
  update_type: string;
  created_at: string;
  created_by: string | null;
  author_name: string | null;
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

const EMPTY_UPDATE_FORM = {
  title: "",
  version: "",
  update_type: "melhoria",
  summary: "",
  details: "",
};

export default function AdminSistema() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [churches, setChurches] = useState<ChurchSubscription[]>([]);
  const [churchesLoading, setChurchesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [updates, setUpdates] = useState<SystemUpdateItem[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(true);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updateForm, setUpdateForm] = useState(EMPTY_UPDATE_FORM);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (user) {
      fetchChurches();
      fetchUpdates();
    }
  }, [user]);

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

  async function fetchUpdates() {
    setUpdatesLoading(true);
    const { data, error } = await supabase
      .from("system_update_log" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Erro ao carregar atualizacoes", variant: "destructive" });
      setUpdatesLoading(false);
      return;
    }

    const rawItems = ((data as any[]) ?? []) as Array<SystemUpdateItem & { created_by?: string | null }>;
    const authorIds = Array.from(new Set(rawItems.map((item) => item.created_by).filter(Boolean)));

    let profileMap = new Map<string, string>();

    if (authorIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);

      profileMap = new Map((profileData ?? []).map((entry) => [entry.user_id, entry.full_name]));
    }

    setUpdates(
      rawItems.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        details: item.details,
        version: item.version,
        update_type: item.update_type,
        created_at: item.created_at,
        created_by: item.created_by ?? null,
        author_name: item.created_by ? profileMap.get(item.created_by) ?? null : null,
      })),
    );
    setUpdatesLoading(false);
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

  async function createUpdate() {
    if (!updateForm.title.trim() || !updateForm.summary.trim()) {
      toast({
        title: "Preencha os campos obrigatorios",
        description: "Informe pelo menos o titulo e o resumo da atualizacao.",
        variant: "destructive",
      });
      return;
    }

    setSavingUpdate(true);

    const payload = {
      title: updateForm.title.trim(),
      version: updateForm.version.trim() || null,
      update_type: updateForm.update_type,
      summary: updateForm.summary.trim(),
      details: updateForm.details.trim() || null,
      created_by: user?.id ?? null,
    };

    const { error } = await supabase.from("system_update_log" as any).insert(payload as any);

    if (error) {
      console.error(error);
      toast({ title: "Erro ao salvar atualizacao", variant: "destructive" });
      setSavingUpdate(false);
      return;
    }

    toast({ title: "Atualizacao registrada", description: "O historico do app foi atualizado com sucesso." });
    setUpdateForm(EMPTY_UPDATE_FORM);
    setSavingUpdate(false);
    fetchUpdates();
  }

  async function deleteUpdate(updateId: string) {
    const { error } = await supabase.from("system_update_log" as any).delete().eq("id", updateId);

    if (error) {
      console.error(error);
      toast({ title: "Erro ao remover atualizacao", variant: "destructive" });
      return;
    }

    toast({ title: "Atualizacao removida" });
    fetchUpdates();
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

  if (authLoading) return null;

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
            <p className="text-xs text-muted-foreground">Gestao de igrejas, assinaturas e atualizacoes do app</p>
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
                    Registrar nova atualizacao
                  </CardTitle>
                  <CardDescription>
                    Cadastre aqui as melhorias, correcoes e comunicados importantes do app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="update-title" className="text-sm font-medium text-foreground">Titulo</label>
                      <Input
                        id="update-title"
                        value={updateForm.title}
                        onChange={(event) => setUpdateForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Ex: Nova area de acompanhamento"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="update-version" className="text-sm font-medium text-foreground">Versao</label>
                      <Input
                        id="update-version"
                        value={updateForm.version}
                        onChange={(event) => setUpdateForm((current) => ({ ...current, version: event.target.value }))}
                        placeholder="Ex: v2.3.0"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Tipo da atualizacao</p>
                    <div className="flex flex-wrap gap-2">
                      {UPDATE_TYPE_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={updateForm.update_type === option.value ? "default" : "outline"}
                          className="rounded-xl"
                          onClick={() => setUpdateForm((current) => ({ ...current, update_type: option.value }))}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="update-summary" className="text-sm font-medium text-foreground">Resumo</label>
                    <Textarea
                      id="update-summary"
                      value={updateForm.summary}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, summary: event.target.value }))}
                      placeholder="Descreva em poucas linhas o que mudou."
                      className="min-h-[110px] rounded-2xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="update-details" className="text-sm font-medium text-foreground">Detalhes adicionais</label>
                    <Textarea
                      id="update-details"
                      value={updateForm.details}
                      onChange={(event) => setUpdateForm((current) => ({ ...current, details: event.target.value }))}
                      placeholder="Opcional: explique impacto, uso ou observacoes internas."
                      className="min-h-[150px] rounded-2xl"
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Responsavel pelo registro</p>
                      <p className="text-xs text-muted-foreground">{profile?.full_name || user?.email || "Administrador do sistema"}</p>
                    </div>
                    <Button onClick={createUpdate} disabled={savingUpdate} className="rounded-xl">
                      {savingUpdate ? "Salvando..." : "Publicar atualizacao"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-montserrat text-xl font-black">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Visao geral
                  </CardTitle>
                  <CardDescription>Resumo rapido do historico cadastrado nesta area.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="mt-1 font-montserrat text-3xl font-black text-foreground">{updates.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultima publicacao</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {updates[0] ? new Date(updates[0].created_at).toLocaleDateString("pt-BR") : "Nenhuma ainda"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold text-foreground">Como usar esta area</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use esta aba para manter um registro oficial das alteracoes do app, facilitando comunicados internos e controle de versao.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-montserrat text-xl font-black text-foreground">Historico de atualizacoes</h2>
                <p className="text-sm text-muted-foreground">Entradas registradas no sistema administrativo.</p>
              </div>
              <Button variant="outline" onClick={fetchUpdates} className="rounded-xl">
                <RefreshCw className={`mr-2 h-4 w-4 ${updatesLoading ? "animate-spin" : ""}`} />
                Atualizar lista
              </Button>
            </div>

            {updatesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-36 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : updates.length === 0 ? (
              <Card className="border-border">
                <CardContent className="p-8 text-center">
                  <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-montserrat font-bold text-foreground">Nenhuma atualizacao cadastrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Publique a primeira entrada acima para iniciar o historico do app.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {updates.map((item) => {
                  const typeConfig = UPDATE_TYPE_OPTIONS.find((option) => option.value === item.update_type) ?? UPDATE_TYPE_OPTIONS[1];

                  return (
                    <Card key={item.id} className="border-border">
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                              <span>Registrado em {new Date(item.created_at).toLocaleString("pt-BR")}</span>
                              <span>Por {item.author_name || "Administrador do sistema"}</span>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteUpdate(item.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
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
    </div>
  );
}
