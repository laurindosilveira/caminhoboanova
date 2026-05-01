import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type LogEntry = {
  id: string;
  reminder_type: string;
  phone: string;
  status: string;
  error_detail: string | null;
  blocked_reason_code: string | null;
  sent_at: string;
  is_resent: boolean;
};

const TYPE_META: Record<string, { label: string; emoji: string }> = {
  devocional_late: { label: "Devocional",   emoji: "📖" },
  desafio_late:    { label: "Desafio",      emoji: "💪" },
  checkin_late:    { label: "Check-in",     emoji: "📋" },
};

const STATUS_CFG: Record<string, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  sent:    { label: "Enviado",   color: "text-brand-green",      Icon: CheckCircle2 },
  failed:  { label: "Falhou",    color: "text-destructive",      Icon: AlertCircle  },
  blocked: { label: "Bloqueado", color: "text-amber-500",        Icon: XCircle      },
  pending: { label: "Pendente",  color: "text-muted-foreground", Icon: Clock        },
  skipped: { label: "Ignorado",  color: "text-muted-foreground", Icon: Clock        },
};

const REASON_LABELS: Record<string, string> = {
  no_number:      "Sem número cadastrado",
  invalid_size:   "Tamanho inválido (muito curto ou longo)",
  invalid_ddd:    "DDD inexistente",
  invalid_format: "Formato inválido (9º dígito)",
  api_error:      "Erro no provedor de envio",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function MyNotificationLogs() {
  const { user } = useAuth();
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchLogs() {
    if (!user || loaded) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_reminder_log")
      .select("id, reminder_type, phone, status, error_detail, blocked_reason_code, sent_at, is_resent")
      .eq("user_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(30);
    setLogs(data ?? []);
    setLoaded(true);
    setLoading(false);
  }

  function handleToggle() {
    if (!expanded && !loaded) fetchLogs();
    setExpanded(o => !o);
  }

  const sentCount    = logs.filter(l => l.status === "sent").length;
  const blockedCount = logs.filter(l => l.status === "blocked").length;
  const failedCount  = logs.filter(l => l.status === "failed").length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left flex-1">
          <p className="font-montserrat font-bold text-foreground text-sm">
            Histórico de lembretes por WhatsApp
          </p>
          <p className="text-muted-foreground text-xs font-inter">
            {loaded
              ? logs.length === 0
                ? "Nenhum registro encontrado"
                : `${logs.length} registro${logs.length > 1 ? "s" : ""} · ${sentCount} enviado${sentCount !== 1 ? "s" : ""}${blockedCount > 0 ? ` · ${blockedCount} bloqueado${blockedCount !== 1 ? "s" : ""}` : ""}${failedCount > 0 ? ` · ${failedCount} falha${failedCount !== 1 ? "s" : ""}` : ""}`
              : "Clique para ver seu histórico de envios"}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
          {loading ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground font-inter text-sm py-8">
              Nenhum lembrete enviado ainda.
            </p>
          ) : (
            <div>
              {logs.map((log) => {
                const typeMeta = TYPE_META[log.reminder_type] ?? { label: log.reminder_type, emoji: "📨" };
                const stCfg    = STATUS_CFG[log.status] ?? STATUS_CFG.pending;
                const { Icon } = stCfg;
                const isExpanded = expandedId === log.id;
                const hasDetail  = !!log.error_detail || !!log.blocked_reason_code;

                return (
                  <div
                    key={log.id}
                    className="border-b border-border last:border-b-0"
                  >
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      {/* Type emoji */}
                      <span className="text-base w-6 text-center flex-shrink-0">
                        {typeMeta.emoji}
                      </span>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-inter text-xs font-semibold text-foreground">
                            {typeMeta.label}
                          </span>
                          {log.is_resent && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-inter font-bold">
                              REENVIO
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {log.phone}
                        </p>
                      </div>

                      {/* Status + time */}
                      <div className="text-right flex-shrink-0">
                        <div className={`flex items-center gap-1 justify-end ${stCfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-inter font-bold">{stCfg.label}</span>
                        </div>
                        <p className="text-[10px] font-inter text-muted-foreground mt-0.5">
                          {formatDate(log.sent_at)}
                        </p>
                      </div>

                      {/* Expand indicator */}
                      {hasDetail && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      )}
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && hasDetail && (
                      <div className="px-4 pb-3 pt-0 animate-in slide-in-from-top-1 duration-150">
                        <div className="ml-9 p-2.5 rounded-xl bg-muted/50 border border-border space-y-1.5">
                          {log.blocked_reason_code && (
                            <div>
                              <p className="text-[10px] font-inter font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                                Motivo do bloqueio
                              </p>
                              <p className="text-[11px] font-inter text-amber-600 dark:text-amber-400">
                                {REASON_LABELS[log.blocked_reason_code] ?? log.blocked_reason_code}
                              </p>
                            </div>
                          )}
                          {log.error_detail && (
                            <div>
                              <p className="text-[10px] font-inter font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                                Detalhe do erro
                              </p>
                              <p className="text-[11px] font-inter text-destructive break-all">
                                {log.error_detail}
                              </p>
                            </div>
                          )}
                          {!log.error_detail && !log.blocked_reason_code && log.status === "failed" && (
                            <p className="text-[11px] font-inter text-muted-foreground">
                              Falha sem detalhe registrado.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
