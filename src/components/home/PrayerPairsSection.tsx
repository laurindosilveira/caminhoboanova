import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, Check, Send, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrayerPair {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_a_name: string;
  user_b_name: string;
  user_a_confirmed: boolean;
  user_b_confirmed: boolean;
  user_a_testimony: string | null;
  user_b_testimony: string | null;
  week_start: string;
}

export default function PrayerPairsSection() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const [pair, setPair] = useState<PrayerPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [testimony, setTestimony] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isManager = role === "admin" || role === "lider";

  useEffect(() => {
    if (profile) fetchPair();
  }, [profile]);

  async function fetchPair() {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data } = await supabase
      .from("prayer_pairs")
      .select("*")
      .eq("week_start", weekStartStr)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .limit(1);

    setPair((data?.[0] as PrayerPair) ?? null);
    setLoading(false);
  }

  async function confirmPrayer() {
    if (!pair || !user || !profile) return;
    setSubmitting(true);

    const isA = pair.user_a_id === user.id;
    const updateData: any = isA
      ? { user_a_confirmed: true, user_a_testimony: testimony.trim() || null }
      : { user_b_confirmed: true, user_b_testimony: testimony.trim() || null };

    const { error } = await supabase
      .from("prayer_pairs")
      .update(updateData)
      .eq("id", pair.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🙏 Confirmado!", description: "Obrigado por orar pela sua dupla!" });
      setPair(prev => prev ? { ...prev, ...updateData } : null);
      setTestimony("");

      // Send push notification to partner (fire-and-forget)
      const partnerId = isA ? pair.user_b_id : pair.user_a_id;
      supabase.functions.invoke("notify-prayer-confirm", {
        body: {
          partner_user_id: partnerId,
          sender_name: profile.full_name,
        },
      }).catch(() => {});
    }
    setSubmitting(false);
  }

  async function generatePairsNow() {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("prayer-pairs");
      if (error) throw error;
      toast({ title: "✅ Duplas geradas!", description: "As duplas da semana foram criadas." });
      fetchPair();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setGenerating(false);
  }

  if (loading) {
    return <div className="bg-muted rounded-2xl h-28 animate-pulse" />;
  }

  const isA = pair?.user_a_id === user?.id;
  const partnerName = pair ? (isA ? pair.user_b_name : pair.user_a_name) : null;
  const myConfirmed = pair ? (isA ? pair.user_a_confirmed : pair.user_b_confirmed) : false;
  const partnerConfirmed = pair ? (isA ? pair.user_b_confirmed : pair.user_a_confirmed) : false;
  const partnerTestimony = pair ? (isA ? pair.user_b_testimony : pair.user_a_testimony) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-secondary" />
          <span className="font-montserrat font-bold text-foreground text-sm">🙏 Dupla de Oração</span>
        </div>
        {isManager && (
          <button
            onClick={generatePairsNow}
            disabled={generating}
            className="flex items-center gap-1 text-xs font-inter font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Gerando..." : "Gerar Duplas"}
          </button>
        )}
      </div>

      {!pair ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center shadow-sm">
          <Heart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm font-inter">
            Nenhuma dupla de oração esta semana.
          </p>
          <p className="text-muted-foreground text-xs font-inter mt-1">
            As duplas são sorteadas toda segunda-feira.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
          {/* Partner info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-montserrat font-black text-primary-foreground">
                {partnerName?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-montserrat font-bold text-foreground text-sm">Sua dupla desta semana:</p>
              <p className="font-montserrat font-black text-primary text-base truncate">{partnerName}</p>
            </div>
            {partnerConfirmed && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-brand-green/10">
                <Check className="w-3 h-3 text-brand-green" />
                <span className="text-[10px] font-inter font-semibold text-brand-green">Orou por você</span>
              </div>
            )}
          </div>

          {/* Partner's testimony */}
          {partnerTestimony && (
            <div className="bg-muted/50 rounded-xl p-3 border-l-2 border-secondary">
              <p className="text-xs font-inter text-muted-foreground mb-0.5">
                {partnerName?.split(" ")[0]} compartilhou:
              </p>
              <p className="text-sm font-inter text-foreground italic">"{partnerTestimony}"</p>
            </div>
          )}

          {/* Confirmation */}
          {myConfirmed ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-green/10">
              <Check className="w-4 h-4 text-brand-green" />
              <span className="font-inter text-sm font-semibold text-brand-green">
                Você confirmou que orou por {partnerName?.split(" ")[0]} 🙏
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={testimony}
                onChange={e => setTestimony(e.target.value)}
                placeholder="Compartilhe como foi a oração (opcional)..."
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                maxLength={300}
              />
              <button
                onClick={confirmPrayer}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-inter font-semibold text-primary-foreground transition-all disabled:opacity-50"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Heart className="w-4 h-4" />
                {submitting ? "Confirmando..." : `Confirmar que orei por ${partnerName?.split(" ")[0]}`}
              </button>
            </div>
          )}

          {/* Week info */}
          <p className="text-[10px] text-muted-foreground font-inter text-center">
            Semana de {new Date(pair.week_start + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </p>
        </div>
      )}
    </div>
  );
}
