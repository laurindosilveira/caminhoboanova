import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { STRIPE_PLANS, getPlanByProductId, type PlanKey } from "@/lib/stripePlans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, FileText, ExternalLink, RefreshCw, Church, Download, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: string;
  pdf: string | null;
  hosted_url: string | null;
}

interface SubData {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  invoices: Invoice[];
}

export default function MinhaIgreja() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [subData, setSubData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubData(data);
    } catch (err: any) {
      console.error("Error checking subscription:", err);
      toast({ title: "Erro", description: "Não foi possível verificar a assinatura. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) fetchSubscription();
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, fetchSubscription, navigate]);

  const planKey = subData?.product_id ? getPlanByProductId(subData.product_id) : null;
  const planInfo = planKey ? STRIPE_PLANS[planKey] : null;

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Erro", description: "Não foi possível abrir o portal de pagamentos.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur border-2 border-white/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Church className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="text-primary-foreground font-inter text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Voltar" className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-montserrat font-black text-xl text-foreground">⛪ Minha Igreja</h1>
          <p className="text-muted-foreground text-xs font-inter">Gerencie sua assinatura e recibos</p>
        </div>
        <button onClick={fetchSubscription} aria-label="Atualizar status da assinatura" className="ml-auto w-10 h-10 rounded-xl flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Subscription Status */}
      <div className="px-5 mb-4">
        <Card className="border-2" style={subData?.subscribed ? { borderColor: "hsl(var(--brand-green))" } : undefined}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-montserrat text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Assinatura
              </CardTitle>
              {subData?.subscribed ? (
                <Badge className="bg-[hsl(var(--brand-green))]/15 text-[hsl(var(--brand-green))] border-[hsl(var(--brand-green))]/30 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ativa
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-semibold">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Inativa
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {subData?.subscribed && planInfo ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-montserrat font-black text-2xl text-foreground">{planInfo.name}</span>
                  <span className="text-muted-foreground text-sm font-inter">{planInfo.price}{planInfo.period}</span>
                </div>
                {subData.subscription_end && (
                  <p className="text-muted-foreground text-sm font-inter flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    Próxima cobrança: {formatDate(subData.subscription_end)}
                  </p>
                )}
                <Button onClick={handleManageSubscription} disabled={portalLoading} variant="outline" className="w-full mt-2">
                  {portalLoading ? "Abrindo..." : "Gerenciar assinatura"}
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground font-inter text-sm mb-4">Você ainda não possui uma assinatura ativa.</p>
                <Button onClick={() => navigate("/apresentacao#planos")} style={{ background: "var(--gradient-hero)" }} className="text-primary-foreground">
                  Ver planos disponíveis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices / Receipts */}
      <div className="px-5">
        <h2 className="font-montserrat font-bold text-base text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Recibos e Faturas
        </h2>

        {subData?.invoices && subData.invoices.length > 0 ? (
          <div className="space-y-2">
            {subData.invoices.map((inv) => (
              <Card key={inv.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    inv.status === "paid" ? "bg-[hsl(var(--brand-green))]/15" : "bg-muted"
                  }`}>
                    <FileText className={`w-5 h-5 ${inv.status === "paid" ? "text-[hsl(var(--brand-green))]" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-sm text-foreground truncate">
                      {inv.number || inv.id.slice(0, 12)}
                    </p>
                    <p className="text-muted-foreground text-xs font-inter">{formatDate(inv.created)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-montserrat font-bold text-sm text-foreground">{formatCurrency(inv.amount, inv.currency)}</p>
                    <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                      {inv.status === "paid" ? "Pago" : inv.status === "open" ? "Aberto" : inv.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {inv.pdf && (
                      <a href={inv.pdf} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors" title="Baixar PDF">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                    {inv.hosted_url && (
                      <a href={inv.hosted_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors" title="Ver online">
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground font-inter text-sm">Nenhuma fatura encontrada.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
