import { useState, useEffect, useCallback } from "react";
import {
  Search, RefreshCw, ChevronDown, ChevronRight, CheckCircle2,
  AlertCircle, XCircle, Clock, Send, Filter, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type LogRow = {
  id: string;
  user_id: string;
  full_name: string;
  community: string;
  phone: string;
  message: string;
  reminder_type: string;
  status: "sent" | "failed" | "blocked" | "skipped" | "pending";
  error_detail: string | null;
  blocked_reason_code: string | null;
  is_resent: boolean;
  sent_at: string;
  reference_id: string | null;
  // Campos opcionais de whatsapp_number/validation do perfil
  whatsapp_number: string | null;
  whatsapp_validation_status: string | null;
};

// ─── Constantes de UI ─────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  sent:    { label: "Enviado",  color: "text-brand-green bg-brand-green/10 border-brand-green/30", Icon: CheckCircle2 },
  failed:  { label: "Falhou",   color: "text-destructive bg-destructive/10 border-destructive/30",  Icon: XCircle },
  blocked: { label: "Bloqueado",color: "text-yellow-600 bg-yellow-50 border-yellow-300",            Icon: AlertCircle },
  skipped: { label: "Ignorado", color: "text-muted-foreground bg-muted border-border",              Icon: Clock },
  pending: { label: "Pendente", color: "text-primary bg-primary/10 border-primary/30",              Icon: Clock },
};

const REASON_LABELS: Record<string, { label: string; fix: string }> = {
  no_number:     { label: "Sem número",      fix: "Cadastre o WhatsApp no perfil do usuário" },
  invalid_size:  { label: "Tamanho inválido",fix: "O número deve ter 10 ou 11 dígitos (DDD + número)" },
  invalid_ddd:   { label: "DDD inválido",    fix: "Verifique os 2 primeiros dígitos (ex: 47, 51, 11)" },
  invalid_format:{ label: "Formato inválido",fix: "Celular BR deve ter 9 como primeiro dígito após o DDD" },
  missing_ddi:   { label: "Sem DDI",         fix: "O sistema adiciona +55 automaticamente — verifique o DDD" },
  api_error:     { label: "Erro da API",     fix: "Verifique a configuração do provider WhatsApp" },
  whatsapp_disabled: { label: "WA desativado", fix: "Usuário desativou os lembretes por WhatsApp" },
  unknown:       { label: "Desconhecido",    fix: "Verifique o número e tente novamente" },
};

const REMINDER_LABELS: Record<string, string> = {
  devocional_late: "📖 Devocional",
  desafio_late:    "💪 Desafio",
  checkin_late:    "📋 Check-in",
};

const ALL_STATUSES = ["sent", "failed", "blocked", "skipped", "pending"] as const;
const ALL_CODES    = Object.keys(REASON_LABELS);

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WhatsAppAuditTab() {
  const { toast } = useToast();

  const [rows, setRows]           = useState<LogRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sending, setSending]     = useState<string | null>(null); // log id em processo de reenvio

  // Filtros
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("blocked");
  const [filterCode, setFilterCode] = useState<string>("");
  const [filterCommunity, setFilterCommunity] = useState<string>("");
  const [communities, setCommunities] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_reminder_log")
      .select(`
        id, user_id, reminder_type, phone, message, status,
        error_detail, blocked_reason_code, is_resent, sent_at, reference_id
      `)
      .order("sent_at", { ascending: false })
      .limit(300);

    if (error) {
      toast({ title: "Erro ao carregar auditoria", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Buscar perfis para nome/comunidade
    const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, community, whatsapp_number, whatsapp_validation_status")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const comms = [...new Set((profiles ?? []).map((p: any) => p.community))].sort();
    setCommunities(comms);

    const merged: LogRow[] = (data ?? []).map((r: any) => {
      const p = profileMap.get(r.user_id) ?? {};
      return {
        ...r,
        full_name: p.full_name ?? "(usuário removido)",
        community: p.community ?? "",
        whatsapp_number: p.whatsapp_number ?? null,
        whatsapp_validation_status: p.whatsapp_validation_status ?? null,
      };
    });

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── Filtros aplicados ───────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterCode && r.blocked_reason_code !== filterCode) return false;
    if (filterCommunity && r.community !== filterCommunity) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.full_name.toLowerCase().includes(q) &&
        !r.phone.toLowerCase().includes(q) &&
        !r.community.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // ── Reenvio via RPC ─────────────────────────────────────────────────────────
  async function handleResend(row: LogRow) {
    setSending(row.id);

    // 1. Prepara (valida número no banco e cria log pendente)
    const { data, error } = await supabase.rpc("prepare_whatsapp_resend", {
      _target_user_id: row.user_id,
      _reminder_type:  row.reminder_type,
      _reference_id:   row.reference_id ?? null,
    });

    if (error || !data) {
      toast({ title: "Erro ao preparar reenvio", description: error?.message, variant: "destructive" });
      setSending(null);
      return;
    }

    if (!data.can_send) {
      toast({
        title: "Número ainda inválido",
        description: `${data.reason_code}: ${data.reason_text}`,
        variant: "destructive",
      });
      setSending(null);
      // Atualiza linha localmente
      setRows(prev => prev.map(r => r.id === row.id
        ? { ...r, blocked_reason_code: data.reason_code }
        : r
      ));
      return;
    }

    // 2. Tenta enviar via Supabase Edge Function (webhook genérico para reenvio manual)
    const { data: resendResult, error: fnErr } = await supabase.functions.invoke("send-whatsapp-reminders", {
      body: {
        single_resend: true,
        user_id:       row.user_id,
        phone:         data.e164,
        message:       row.message,
        log_id:        data.log_id,
      },
    });
    const resendOk = !fnErr && resendResult?.ok !== false;

    // 3. Confirma o resultado no log
    await supabase.rpc("confirm_whatsapp_resend", {
      _log_id:  data.log_id,
      _success: resendOk,
      _error:   fnErr?.message ?? resendResult?.error ?? null,
    });

    if (!resendOk) {
      toast({ title: "Reenvio falhou", description: fnErr?.message ?? resendResult?.error, variant: "destructive" });
    } else {
      toast({ title: "✅ Reenviado", description: `Mensagem enviada para ${data.e164}` });
    }

    setSending(null);
    fetchLogs();
  }

  // ── Contadores de resumo ────────────────────────────────────────────────────
  const counts = { sent: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
  rows.forEach((r) => { if (r.status in counts) (counts as any)[r.status]++; });

  return (
    <div className="space-y-4">
      {/* Resumo rápido */}
      <div className="grid grid-cols-4 gap-2">
        {([
          ["sent",    "Enviados",  "text-brand-green"],
          ["blocked", "Bloqueados","text-yellow-600"],
          ["failed",  "Falhou",   "text-destructive"],
          ["skipped", "Ignorados","text-muted-foreground"],
        ] as const).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? "" : key)}
            className={`rounded-xl border p-2.5 text-center transition-all ${
              filterStatus === key ? "bg-muted border-primary" : "bg-card border-border hover:bg-muted/50"
            }`}
          >
            <p className={`font-montserrat font-black text-xl ${color}`}>{counts[key]}</p>
            <p className="text-[10px] font-inter text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou comunidade..."
            className="pl-9 rounded-xl text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Filtro: comunidade */}
          <select
            value={filterCommunity}
            onChange={(e) => setFilterCommunity(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            <option value="">Todas as comunidades</option>
            {communities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Filtro: código de bloqueio */}
          <select
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
          >
            <option value="">Todos os motivos</option>
            {ALL_CODES.map((c) => (
              <option key={c} value={c}>{REASON_LABELS[c]?.label ?? c}</option>
            ))}
          </select>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-inter text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabela / Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Carregando logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground font-inter text-sm">
          Nenhum registro encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {filtered.map((row, idx) => {
            const cfg     = STATUS_CFG[row.status] ?? STATUS_CFG.skipped;
            const reason  = REASON_LABELS[row.blocked_reason_code ?? ""] ?? null;
            const isOpen  = expandedId === row.id;
            const isSending = sending === row.id;

            return (
              <div
                key={row.id}
                className={`${idx > 0 ? "border-t border-border" : ""}`}
              >
                {/* Linha principal */}
                <button
                  onClick={() => setExpandedId(isOpen ? null : row.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  {/* Status badge */}
                  <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-inter font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                    <cfg.Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>

                  {/* Nome + telefone */}
                  <div className="flex-1 min-w-0">
                    <p className="font-inter font-semibold text-foreground text-sm truncate">{row.full_name}</p>
                    <p className="text-[11px] font-inter text-muted-foreground">
                      {row.phone || "—"} · {row.community} · {REMINDER_LABELS[row.reminder_type] ?? row.reminder_type}
                    </p>
                  </div>

                  {/* Data + chevron */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-[10px] font-inter text-muted-foreground">
                      {new Date(row.sent_at).toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>

                {/* Painel expandido */}
                {isOpen && (
                  <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Número normalizado */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-inter">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Número enviado</p>
                        <p className="font-mono font-semibold text-foreground">{row.phone || "(vazio)"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">WhatsApp no perfil</p>
                        <p className="font-mono font-semibold text-foreground">
                          {row.whatsapp_number || "(usa phone)"}
                        </p>
                      </div>
                    </div>

                    {/* Motivo do bloqueio */}
                    {row.blocked_reason_code && (
                      <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 p-3 space-y-1">
                        <p className="text-xs font-inter font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {reason?.label ?? row.blocked_reason_code}
                        </p>
                        {row.error_detail && (
                          <p className="text-[11px] font-inter text-yellow-700 dark:text-yellow-400 font-mono break-all">
                            {row.error_detail}
                          </p>
                        )}
                        {reason?.fix && (
                          <p className="text-[11px] font-inter text-yellow-600 dark:text-yellow-500 mt-1">
                            💡 {reason.fix}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Erro de API */}
                    {row.status === "failed" && row.error_detail && !row.blocked_reason_code && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                        <p className="text-[11px] font-inter text-destructive font-mono break-all">{row.error_detail}</p>
                      </div>
                    )}

                    {/* Botão de reenvio */}
                    {(row.status === "blocked" || row.status === "failed") && (
                      <button
                        onClick={() => handleResend(row)}
                        disabled={isSending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-montserrat font-bold border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 transition-all disabled:opacity-40"
                      >
                        {isSending ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Reenviando...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Reenviar Lembrete</>
                        )}
                      </button>
                    )}

                    {row.is_resent && (
                      <p className="text-[10px] font-inter text-muted-foreground text-center">
                        ↩ Reenvio manual
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-[11px] font-inter text-muted-foreground">
          {filtered.length} de {rows.length} registros
        </p>
      )}
    </div>
  );
}
