import { useState, useEffect } from "react";
import { Send, Users, MapPin, Building, Megaphone, CheckCircle, AlertCircle, CalendarClock, History, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AREAS = ["Área 1", "Área 2"];
const COMMUNITIES = [
  "Martim Lutero", "Bom Pastor", "Rincão Fundo", "Rincão Frente",
  "Linha Brasil", "Iriá Pira 1", "Iriá Pira 2",
];

type TargetType = "all" | "area" | "community" | "turma";

interface Props {
  turmas?: Array<{ id: string; name: string; area: string | null }>;
}

export default function AdminPushTab({ turmas = [] }: Props) {
  const { isSuper, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<TargetType>("all");
  const [targetValue, setTargetValue] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState("");

  const canSendToAll = isSuper;

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError("Preencha o título e a mensagem.");
      return;
    }
    if (target !== "all" && !targetValue) {
      setError("Selecione o destino.");
      return;
    }

    setSending(true);
    setError("");
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-push", {
        body: { title, body, target, targetValue: target === "all" ? undefined : targetValue },
      });

      if (fnError) throw fnError;
      setResult({ sent: data.sent, failed: data.failed });
      if (data.sent > 0) {
        setTitle("");
        setBody("");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar notificações.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
          <Megaphone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-montserrat font-bold text-foreground text-base">Enviar Push</h2>
          <p className="text-muted-foreground font-inter text-xs">Envie avisos instantâneos aos participantes</p>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Encontro cancelado amanhã"
          maxLength={80}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-muted-foreground text-[10px] font-inter mt-1 text-right">{title.length}/80</p>
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Mensagem</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva a mensagem que será enviada..."
          maxLength={200}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <p className="text-muted-foreground text-[10px] font-inter mt-1 text-right">{body.length}/200</p>
      </div>

      {/* Target selector */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Enviar para</label>
        <div className="grid grid-cols-2 gap-2">
          {canSendToAll && (
            <button
              onClick={() => { setTarget("all"); setTargetValue(""); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
                target === "all" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Users className="w-4 h-4" />
              Todos
            </button>
          )}
          <button
            onClick={() => { setTarget("area"); setTargetValue(""); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
              target === "area" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Por Área
          </button>
          <button
            onClick={() => { setTarget("community"); setTargetValue(""); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
              target === "community" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Building className="w-4 h-4" />
            Comunidade
          </button>
          {turmas.length > 0 && (
            <button
              onClick={() => { setTarget("turma"); setTargetValue(""); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
                target === "turma" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Users className="w-4 h-4" />
              Turma
            </button>
          )}
        </div>
      </div>

      {/* Target value selector */}
      {target === "area" && (
        <select
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a área...</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      {target === "community" && (
        <select
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a comunidade...</option>
          {COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {target === "turma" && (
        <select
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a turma...</option>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.name}{t.area ? ` (${t.area})` : ""}</option>)}
        </select>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-destructive text-xs font-inter">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-green/10 border border-brand-green/20">
          <CheckCircle className="w-4 h-4 text-brand-green flex-shrink-0" />
          <p className="text-brand-green text-xs font-inter font-bold">
            {result.sent > 0
              ? `✅ Enviado para ${result.sent} dispositivo${result.sent !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} falha${result.failed !== 1 ? "s" : ""})` : ""}`
              : "Nenhum dispositivo encontrado com push ativo para esse destino."}
          </p>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={sending || !title.trim() || !body.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-inter font-bold text-sm text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--gradient-hero)" }}
      >
        {sending ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Enviar Notificação Push
          </>
        )}
      </button>

      <p className="text-muted-foreground text-[10px] font-inter text-center">
        Apenas usuários com notificações de mensagens ativas receberão o aviso.
      </p>

      {/* Event Reminders Manual Trigger */}
      <EventRemindersTrigger />

      {/* Push Log History */}
      <PushLogHistory />
    </div>
  );
}

function EventRemindersTrigger() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; upcomingEvents: number; pastEvents: number } | null>(null);
  const [error, setError] = useState("");

  async function handleTrigger() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("event-reminders", { body: {} });
      if (fnError) throw fnError;
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Erro ao disparar lembretes.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h3 className="font-montserrat font-bold text-foreground text-sm">Lembretes de Eventos</h3>
          <p className="text-muted-foreground font-inter text-[10px]">Dispara automático às 8h · Eventos +2 dias e -1 dia</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-destructive text-xs font-inter">{error}</p>
        </div>
      )}

      {result && (
        <div className="p-3 rounded-xl bg-brand-green/10 border border-brand-green/20 space-y-1">
          <p className="text-brand-green text-xs font-inter font-bold flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            {result.sent > 0 ? `${result.sent} notificação(ões) enviada(s)` : "Nenhuma notificação para enviar"}
          </p>
          <p className="text-muted-foreground text-[10px] font-inter">
            📅 {result.upcomingEvents} evento(s) em 2 dias · 📋 {result.pastEvents} evento(s) de ontem
            {result.failed > 0 && ` · ❌ ${result.failed} falha(s)`}
          </p>
        </div>
      )}

      <button
        onClick={handleTrigger}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-secondary/30 bg-secondary/5 text-secondary hover:bg-secondary/10 transition-colors font-inter font-bold text-sm disabled:opacity-50"
      >
        {sending ? (
          <>
            <div className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
            Disparando...
          </>
        ) : (
          <>
            <CalendarClock className="w-4 h-4" />
            Disparar Lembretes Agora
          </>
        )}
      </button>
    </div>
  );
}

interface LogEntry {
  id: string;
  type: string;
  title: string;
  body: string;
  target: string;
  target_value: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

function PushLogHistory() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from("push_notification_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data as any as LogEntry[]) ?? []);
    setLoading(false);
  }

  const typeLabels: Record<string, { label: string; emoji: string }> = {
    manual: { label: "Push Manual", emoji: "📢" },
    event_reminder: { label: "Lembrete de Evento", emoji: "🔔" },
    attendance_reminder: { label: "Presença", emoji: "📋" },
  };

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function targetLabel(log: LogEntry) {
    if (log.target === "all") return "Todos";
    if (log.target === "auto") return "Automático";
    if (log.target_value) return log.target_value;
    return log.target;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <History className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-montserrat font-bold text-foreground text-sm">Histórico de Disparos</h3>
          <p className="text-muted-foreground font-inter text-[10px]">Últimos 20 envios registrados</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-xs font-inter text-center py-4">Nenhum disparo registrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const typeInfo = typeLabels[log.type] || { label: log.type, emoji: "📨" };
            return (
              <div key={log.id} className="p-3 rounded-xl border border-border bg-card space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-inter font-bold text-foreground">
                    {typeInfo.emoji} {typeInfo.label}
                  </span>
                  <span className="text-[10px] font-inter text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(log.created_at)}
                  </span>
                </div>
                <p className="text-xs font-inter text-foreground font-medium truncate">{log.title}</p>
                <p className="text-[10px] font-inter text-muted-foreground truncate">{log.body}</p>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-inter text-muted-foreground">
                    🎯 {targetLabel(log)}
                  </span>
                  <span className="text-[10px] font-inter text-brand-green font-bold">
                    ✅ {log.sent_count}
                  </span>
                  {log.failed_count > 0 && (
                    <span className="text-[10px] font-inter text-destructive font-bold">
                      ❌ {log.failed_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
