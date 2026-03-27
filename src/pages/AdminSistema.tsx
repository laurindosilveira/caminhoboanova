import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Church, ArrowLeft, Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  Search, Filter, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  blocked: { label: "Bloqueado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

const PLAN_LABELS: Record<string, { label: string; emoji: string }> = {
  comunidade: { label: "Comunidade", emoji: "🟢" },
  crescimento: { label: "Crescimento", emoji: "🔵" },
  pastoral: { label: "Pastoral", emoji: "🟣" },
};

export default function AdminSistema() {
  const { user, isSuper, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [churches, setChurches] = useState<ChurchSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const ALLOWED_EMAILS = ["laurindosilveira@gmail.com"];
  const isAllowed = isSuper && user?.email && ALLOWED_EMAILS.includes(user.email);

  useEffect(() => {
    if (!authLoading && (!user || !isAllowed)) {
      navigate("/", { replace: true });
    }
  }, [user, isAllowed, authLoading, navigate]);

  useEffect(() => {
    if (user && isAllowed) fetchChurches();
  }, [user, isAllowed]);

  async function fetchChurches() {
    setLoading(true);
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
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("church_subscriptions" as any)
      .update({ subscription_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: `Status atualizado para "${STATUS_MAP[newStatus]?.label ?? newStatus}"` });
      fetchChurches();
    }
  }

  const filtered = churches.filter((c) => {
    const matchesSearch =
      c.church_name.toLowerCase().includes(search.toLowerCase()) ||
      c.pastor_name.toLowerCase().includes(search.toLowerCase()) ||
      c.church_email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: churches.length,
    trial: churches.filter((c) => c.subscription_status === "trial" || c.subscription_status === "pending_checkout").length,
    active: churches.filter((c) => c.subscription_status === "active").length,
    canceled: churches.filter((c) => c.subscription_status === "canceled" || c.subscription_status === "blocked").length,
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="rounded-xl">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
            <Church className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-montserrat font-black text-lg text-foreground">Administração do Sistema</h1>
            <p className="text-xs text-muted-foreground font-inter">Gestão de igrejas e assinaturas</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Church, color: "text-primary" },
            { label: "Em trial", value: stats.trial, icon: Clock, color: "text-warning" },
            { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "text-brand-green" },
            { label: "Cancelados", value: stats.canceled, icon: XCircle, color: "text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="font-montserrat font-black text-2xl text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground font-inter">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, pastor ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            {["all", "pending_checkout", "trial", "active", "canceled", "blocked"].map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="rounded-xl text-xs"
              >
                {s === "all" ? "Todos" : STATUS_MAP[s]?.label ?? s}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={fetchChurches} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Church list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <Church className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-montserrat font-bold text-foreground">Nenhuma igreja encontrada</p>
              <p className="text-sm text-muted-foreground font-inter mt-1">
                {search ? "Tente buscar com outros termos." : "As igrejas aparecerão aqui após o cadastro via onboarding."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => {
              const status = STATUS_MAP[c.subscription_status] ?? STATUS_MAP.pending_checkout;
              const plan = PLAN_LABELS[c.recommended_plan] ?? { label: c.recommended_plan, emoji: "📌" };
              const StatusIcon = status.icon;
              const trialDaysLeft = c.trial_ends_at
                ? Math.max(0, Math.ceil((new Date(c.trial_ends_at).getTime() - Date.now()) / 86400000))
                : null;

              return (
                <Card key={c.id} className="border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-montserrat font-bold text-foreground truncate">{c.church_name}</h3>
                          <Badge variant="outline" className={`text-[10px] ${status.color} border`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground font-inter mt-2">
                          <span>👤 {c.pastor_name}</span>
                          <span>📧 {c.church_email}</span>
                          <span>👥 {c.member_count || "—"} membros</span>
                          <span>{plan.emoji} Plano {plan.label}</span>
                        </div>

                        {trialDaysLeft !== null && c.subscription_status !== "active" && (
                          <p className={`text-xs font-inter mt-1.5 ${trialDaysLeft <= 5 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                            ⏱ {trialDaysLeft > 0 ? `${trialDaysLeft} dias restantes no trial` : "Trial expirado"}
                          </p>
                        )}

                        <p className="text-[10px] text-muted-foreground font-inter mt-1">
                          Cadastrado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {c.subscription_status !== "active" && (
                          <Button size="sm" variant="outline" className="text-xs rounded-lg text-brand-green border-brand-green/30 hover:bg-brand-green/10" onClick={() => updateStatus(c.id, "active")}>
                            Ativar
                          </Button>
                        )}
                        {c.subscription_status !== "blocked" && (
                          <Button size="sm" variant="outline" className="text-xs rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateStatus(c.id, "blocked")}>
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
      </div>
    </div>
  );
}
