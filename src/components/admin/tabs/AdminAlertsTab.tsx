import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Heart, TrendingDown, UserX, ChevronDown, ChevronUp, Clock, Phone } from "lucide-react";

type Alert = {
  user_id: string;
  full_name: string;
  community: string;
  phone: string;
  type: "consecutive_absences" | "needs_pastor" | "no_activity" | "priority";
  detail: string;
  severity: "high" | "medium" | "low";
};

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

export default function AdminAlertsTab({ participants }: { participants: any[] }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchAlerts();
  }, [participants]);

  async function fetchAlerts() {
    setLoading(true);
    const userIds = participants.map(p => p.user_id);
    if (userIds.length === 0) { setAlerts([]); setLoading(false); return; }

    const [{ data: attData }, { data: plansData }, { data: assessData }, { data: progressData }] = await Promise.all([
      supabase.from("attendance").select("user_id, status, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
      supabase.from("discipleship_plans").select("user_id, health_status, is_priority").in("user_id", userIds),
      supabase.from("spiritual_assessments").select("user_id, needs_pastor, notes, month, year")
        .in("user_id", userIds).eq("needs_pastor", true),
      supabase.from("user_progress").select("user_id, completed_at").in("user_id", userIds),
    ]);

    const alertsList: Alert[] = [];

    // 1. Consecutive absences (3+)
    const userAttendance: Record<string, string[]> = {};
    (attData ?? []).forEach(a => {
      if (!userAttendance[a.user_id]) userAttendance[a.user_id] = [];
      userAttendance[a.user_id].push(a.status);
    });
    Object.entries(userAttendance).forEach(([userId, statuses]) => {
      let consecutive = 0;
      for (const s of statuses) {
        if (normalizeAttendanceStatus(s) === "faltou") consecutive++;
        else break;
      }
      if (consecutive >= 3) {
        const p = participants.find(pr => pr.user_id === userId);
        if (p) {
          alertsList.push({
            user_id: userId,
            full_name: p.full_name,
            community: p.community,
            phone: p.phone,
            type: "consecutive_absences",
            detail: `${consecutive} faltas consecutivas recentes`,
            severity: consecutive >= 5 ? "high" : "medium",
          });
        }
      }
    });

    // 2. Needs pastor
    (assessData ?? []).forEach(a => {
      const p = participants.find(pr => pr.user_id === a.user_id);
      if (p) {
        alertsList.push({
          user_id: a.user_id,
          full_name: p.full_name,
          community: p.community,
          phone: p.phone,
          type: "needs_pastor",
          detail: `Solicitou acompanhamento pastoral${a.notes ? `: "${a.notes.substring(0, 60)}..."` : ""}`,
          severity: "high",
        });
      }
    });

    // 3. Priority disciples
    (plansData ?? []).filter(pl => pl.is_priority).forEach(pl => {
      const p = participants.find(pr => pr.user_id === pl.user_id);
      if (p && !alertsList.some(a => a.user_id === pl.user_id && a.type === "needs_pastor")) {
        alertsList.push({
          user_id: pl.user_id,
          full_name: p.full_name,
          community: p.community,
          phone: p.phone,
          type: "priority",
          detail: `Marcado como prioridade pastoral (status: ${pl.health_status})`,
          severity: "medium",
        });
      }
    });

    // 4. No activity in 30+ days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentProgress: Record<string, Date> = {};
    (progressData ?? []).forEach(pr => {
      const d = new Date(pr.completed_at);
      if (!recentProgress[pr.user_id] || d > recentProgress[pr.user_id]) {
        recentProgress[pr.user_id] = d;
      }
    });
    participants.forEach(p => {
      const lastActivity = recentProgress[p.user_id];
      if (!lastActivity || lastActivity < thirtyDaysAgo) {
        if (!alertsList.some(a => a.user_id === p.user_id)) {
          const days = lastActivity
            ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          alertsList.push({
            user_id: p.user_id,
            full_name: p.full_name,
            community: p.community,
            phone: p.phone,
            type: "no_activity",
            detail: days ? `Sem atividade há ${days} dias` : "Nenhuma atividade registrada",
            severity: "low",
          });
        }
      }
    });

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    alertsList.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    setAlerts(alertsList);
    setLoading(false);
  }

  const ALERT_CONFIG: Record<string, { icon: typeof AlertTriangle; label: string; badgeClass: string }> = {
    consecutive_absences: { icon: UserX, label: "Faltas Consecutivas", badgeClass: "bg-destructive/10 text-destructive" },
    needs_pastor: { icon: Heart, label: "Precisa do Pastor", badgeClass: "bg-primary/10 text-primary" },
    priority: { icon: AlertTriangle, label: "Prioridade Pastoral", badgeClass: "bg-amber-500/10 text-amber-600" },
    no_activity: { icon: TrendingDown, label: "Sem Atividade", badgeClass: "bg-muted text-muted-foreground" },
  };

  const SEVERITY_COLORS = {
    high: "border-l-destructive",
    medium: "border-l-amber-500",
    low: "border-l-muted-foreground/30",
  };

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.type === filter);
  const highCount = alerts.filter(a => a.severity === "high").length;
  const medCount = alerts.filter(a => a.severity === "medium").length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive" />
        <h2 className="font-montserrat font-black text-foreground text-lg">Central de Alertas</h2>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-xs font-inter font-bold bg-destructive/10 text-destructive">
          🔴 {highCount} urgente{highCount !== 1 ? "s" : ""}
        </span>
        <span className="px-3 py-1.5 rounded-full text-xs font-inter font-bold bg-amber-500/10 text-amber-600">
          🟡 {medCount} atenção
        </span>
        <span className="px-3 py-1.5 rounded-full text-xs font-inter font-bold bg-muted text-muted-foreground">
          Total: {alerts.length} alerta{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "all", label: "Todos" },
          { id: "consecutive_absences", label: "Faltas" },
          { id: "needs_pastor", label: "Pastor" },
          { id: "priority", label: "Prioridade" },
          { id: "no_activity", label: "Inativos" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium whitespace-nowrap transition-all ${
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-10 h-10 text-brand-green mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground text-sm">Nenhum alerta encontrado</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Todos os discípulos estão bem! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert, i) => {
            const config = ALERT_CONFIG[alert.type];
            const Icon = config.icon;
            const isExpanded = expandedAlert === `${alert.user_id}-${alert.type}`;

            return (
              <div
                key={`${alert.user_id}-${alert.type}-${i}`}
                className={`bg-card rounded-xl border border-border border-l-4 ${SEVERITY_COLORS[alert.severity]} shadow-sm overflow-hidden`}
              >
                <button
                  onClick={() => setExpandedAlert(isExpanded ? null : `${alert.user_id}-${alert.type}`)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.badgeClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-xs">{alert.full_name}</p>
                    <p className="text-muted-foreground font-inter text-[10px] mt-0.5">{alert.detail}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-inter font-semibold ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border mt-0 space-y-2">
                    <div className="flex items-center gap-4 text-xs font-inter text-muted-foreground mt-2">
                      <span>📍 {alert.community}</span>
                      {alert.phone && (
                        <a href={`tel:${alert.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="w-3 h-3" /> {alert.phone}
                        </a>
                      )}
                    </div>
                    <a
                      href={`https://wa.me/55${alert.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/10 text-brand-green text-xs font-inter font-medium hover:bg-brand-green/20 transition-colors"
                    >
                      💬 Enviar WhatsApp
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
