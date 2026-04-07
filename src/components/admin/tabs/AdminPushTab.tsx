import { useState, useEffect } from "react";
import {
  Send, Users, MapPin, Building, Megaphone, CheckCircle, AlertCircle,
  CalendarClock, History, Clock, Bell, Calendar, Edit2, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { AREAS, ALL_COMMUNITIES as COMMUNITIES } from "@/config/areas";

type TargetType = "all" | "area" | "community" | "turma";
type SendMode   = "agora" | "agendar";
type SubTab     = "enviar" | "automacoes" | "historico";

interface Props {
  turmas?: Array<{ id: string; name: string; area: string | null }>;
}

interface AutomationConfig {
  key:         string;
  title:       string;
  body:        string;
  enabled:     boolean;
  description: string;
}

interface ScheduledPush {
  id:           string;
  title:        string;
  body:         string;
  target:       string;
  target_value: string | null;
  scheduled_at: string;
  sent:         boolean;
  created_at:   string;
}

const AUTOMATION_LABELS: Record<string, string> = {
  devotional_reminder: "Lembrete de devocional",
  streak_risk:         "Sequencia em risco",
  pastor_message:      "Mensagem do pastor",
  event_upcoming:      "Evento em 2 dias",
  event_attendance:    "Confirmar presenca",
  prayer_pairs:        "Dupla de oracao",
};

// ─── Root component ────────────────────────────────────────────────────────────

export default function AdminPushTab({ turmas = [] }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("enviar");

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 bg-muted rounded-2xl p-1">
        {[
          { id: "enviar",     label: "Enviar"     },
          { id: "automacoes", label: "Automações" },
          { id: "historico",  label: "Histórico"  },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as SubTab)}
            className={`flex-1 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
              subTab === tab.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "enviar"     && <SendSection turmas={turmas} />}
      {subTab === "automacoes" && <AutomationsSection />}
      {subTab === "historico"  && (
        <>
          <EventRemindersTrigger />
          <PushLogHistory />
        </>
      )}
    </div>
  );
}

// ─── Send Section ──────────────────────────────────────────────────────────────

function SendSection({ turmas }: { turmas: Array<{ id: string; name: string; area: string | null }> }) {
  const { isSuper } = useAuth();
  const [mode, setMode]               = useState<SendMode>("agora");
  const [title, setTitle]             = useState("");
  const [body, setBody]               = useState("");
  const [target, setTarget]           = useState<TargetType>("all");
  const [targetValue, setTargetValue] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending]         = useState(false);
  const [result, setResult]           = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError]             = useState("");
  const [scheduledList, setScheduledList]   = useState<ScheduledPush[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  const canSendToAll = isSuper;

  useEffect(() => {
    if (mode === "agendar") loadScheduled();
  }, [mode]);

  async function loadScheduled() {
    setLoadingScheduled(true);
    const { data, error } = await supabase.rpc("get_push_scheduled_pending" as any);
    if (error) {
      setError(error.message);
      setScheduledList([]);
    } else {
      setScheduledList((data as any as ScheduledPush[]) ?? []);
    }
    setLoadingScheduled(false);
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError("Preencha o titulo e a mensagem."); return;
    }
    if (target !== "all" && !targetValue) {
      setError("Selecione o destino."); return;
    }
    if (mode === "agendar") {
      if (!scheduledAt) { setError("Escolha a data e hora do envio."); return; }
      if (new Date(scheduledAt) <= new Date()) { setError("O horario deve ser no futuro."); return; }
    }

    setSending(true); setError(""); setResult(null);

    if (mode === "agora") {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("admin-push", {
          body: { title, body, target, targetValue: target === "all" ? undefined : targetValue },
        });
        if (fnError) throw fnError;
        setResult({ sent: data.sent, failed: data.failed });
        if (data.sent > 0) { setTitle(""); setBody(""); }
      } catch (err: any) {
        setError(err.message || "Erro ao enviar.");
      }
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError(userError?.message ?? "Nao foi possivel identificar o lider.");
        setSending(false);
        return;
      }
      const { error: insertError } = await supabase.rpc("insert_push_scheduled" as any, {
        _title:        title,
        _body:         body,
        _target:       target,
        _target_value: target === "all" ? null : targetValue,
        _scheduled_at: new Date(scheduledAt).toISOString(),
        _created_by:   user.id,
      });
      if (insertError) {
        setError(insertError.message);
      } else {
        toast.success("Notificacao agendada.");
        setTitle(""); setBody(""); setScheduledAt("");
        loadScheduled();
      }
    }

    setSending(false);
  }

  async function cancelScheduled(id: string) {
    const { error } = await supabase.rpc("delete_push_scheduled" as any, { _id: id });
    if (error) {
      toast.error("Erro ao cancelar: " + error.message);
      return;
    }
    setScheduledList(prev => prev.filter(s => s.id !== id));
    toast.success("Agendamento cancelado.");
  }

  const targetLabel = (s: ScheduledPush) => {
    if (s.target === "all") return "Todos";
    return s.target_value || s.target;
  };

  // Min datetime for the datetime-local input
  const minDatetime = new Date(Date.now() + 5 * 60 * 1000)
    .toISOString().slice(0, 16);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
          <Megaphone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-montserrat font-bold text-foreground text-base">Enviar Push</h2>
          <p className="text-muted-foreground font-inter text-xs">Avisos instantaneos ou agendados para os participantes</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {([
          { id: "agora",   label: "Enviar Agora" },
          { id: "agendar", label: "Agendar" },
        ] as { id: SendMode; label: string }[]).map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError(""); setResult(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-inter font-bold border transition-colors ${
              mode === m.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Titulo</label>
        <input
          type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Encontro cancelado amanha" maxLength={80}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-muted-foreground text-[10px] font-inter mt-1 text-right">{title.length}/80</p>
      </div>

      {/* Body */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Mensagem</label>
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder="Escreva a mensagem que sera enviada..." maxLength={200} rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <p className="text-muted-foreground text-[10px] font-inter mt-1 text-right">{body.length}/200</p>
      </div>

      {/* Schedule datetime */}
      {mode === "agendar" && (
        <div>
          <label className="block text-xs font-inter font-bold text-foreground mb-1.5">
            <Calendar className="w-3.5 h-3.5 inline mr-1" />
            Data e hora do envio
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            min={minDatetime}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-muted-foreground text-[10px] font-inter mt-1">
            O envio ocorre no ciclo do cron seguinte (ate 1h de tolerancia).
          </p>
        </div>
      )}

      {/* Target selector */}
      <div>
        <label className="block text-xs font-inter font-bold text-foreground mb-1.5">Enviar para</label>
        <div className="grid grid-cols-2 gap-2">
          {canSendToAll && (
            <button
              onClick={() => { setTarget("all"); setTargetValue(""); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
                target === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Users className="w-4 h-4" /> Todos
            </button>
          )}
          <button
            onClick={() => { setTarget("area"); setTargetValue(""); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
              target === "area"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <MapPin className="w-4 h-4" /> Por area
          </button>
          <button
            onClick={() => { setTarget("community"); setTargetValue(""); }}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
              target === "community"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Building className="w-4 h-4" /> Comunidade
          </button>
          {turmas.length > 0 && (
            <button
              onClick={() => { setTarget("turma"); setTargetValue(""); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-inter font-bold transition-colors ${
                target === "turma"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <Users className="w-4 h-4" /> Turma
            </button>
          )}
        </div>
      </div>

      {target === "area" && (
        <select
          value={targetValue} onChange={e => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a area...</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
      {target === "community" && (
        <select
          value={targetValue} onChange={e => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a comunidade...</option>
          {COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {target === "turma" && (
        <select
          value={targetValue} onChange={e => setTargetValue(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecione a turma...</option>
          {turmas.map(t => <option key={t.id} value={t.id}>{t.name}{t.area ? ` (${t.area})` : ""}</option>)}
        </select>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-destructive text-xs font-inter">{error}</p>
        </div>
      )}

      {result && mode === "agora" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-green/10 border border-brand-green/20">
          <CheckCircle className="w-4 h-4 text-brand-green flex-shrink-0" />
          <p className="text-brand-green text-xs font-inter font-bold">
            {result.sent > 0
              ? `Enviado para ${result.sent} dispositivo${result.sent !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} falha${result.failed !== 1 ? "s" : ""})` : ""}`
              : "Nenhum dispositivo com push ativo encontrado para esse destino."}
          </p>
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={sending || !title.trim() || !body.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-inter font-bold text-sm text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--gradient-hero)" }}
      >
        {sending ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Processando...
          </>
        ) : mode === "agora" ? (
          <><Send className="w-4 h-4" /> Enviar Agora</>
        ) : (
          <><Calendar className="w-4 h-4" /> Agendar notificacao</>
        )}
      </button>

      <p className="text-muted-foreground text-[10px] font-inter text-center">
        Apenas usuarios com notificacoes de mensagens ativas receberao o aviso.
      </p>

      {/* Pending scheduled list */}
      {mode === "agendar" && (
        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-montserrat font-bold text-foreground text-sm">Agendadas pendentes</p>
            <button onClick={loadScheduled} className="text-[10px] font-inter text-primary hover:underline">
              Atualizar
            </button>
          </div>
          {loadingScheduled ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : scheduledList.length === 0 ? (
            <p className="text-muted-foreground text-xs font-inter text-center py-3">
              Nenhuma notificacao agendada.
            </p>
          ) : (
            <div className="space-y-2">
              {scheduledList.map(s => (
                <div key={s.id} className="p-3 rounded-xl border border-border bg-card space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-inter font-bold text-foreground text-xs truncate flex-1">{s.title}</p>
                    <button
                      onClick={() => cancelScheduled(s.id)}
                      className="p-1 text-destructive/60 hover:text-destructive transition-colors flex-shrink-0"
                      title="Cancelar agendamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] font-inter text-muted-foreground truncate">{s.body}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-inter text-primary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(s.scheduled_at), "d/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-[10px] font-inter text-muted-foreground">Destino: {targetLabel(s)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Automations Section ───────────────────────────────────────────────────────

function AutomationsSection() {
  const [configs, setConfigs]       = useState<AutomationConfig[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTitle, setEditTitle]   = useState("");
  const [editBody, setEditBody]     = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => { loadConfigs(); }, []);

  async function loadConfigs() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_push_automation_config" as any);
    if (error) {
      toast.error("Erro ao carregar automacoes: " + error.message);
      setConfigs([]);
    } else {
      setConfigs((data as any as AutomationConfig[]) ?? []);
    }
    setLoading(false);
  }

  async function toggleEnabled(key: string, current: boolean) {
    const cfg = configs.find(c => c.key === key);
    if (!cfg) return;
    const { error } = await supabase.rpc("update_push_automation_config" as any, {
      _key:     key,
      _title:   cfg.title,
      _body:    cfg.body,
      _enabled: !current,
    });
    if (error) { toast.error("Erro ao atualizar."); return; }
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, enabled: !current } : c));
    toast.success(!current ? "Automacao ativada." : "Automacao desativada.");
  }

  function startEdit(cfg: AutomationConfig) {
    setEditingKey(cfg.key);
    setEditTitle(cfg.title);
    setEditBody(cfg.body);
  }

  async function saveEdit(key: string) {
    if (!editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    const cfg = configs.find(c => c.key === key);
    const { error } = await supabase.rpc("update_push_automation_config" as any, {
      _key:     key,
      _title:   editTitle.trim(),
      _body:    editBody.trim(),
      _enabled: cfg?.enabled ?? true,
    });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setConfigs(prev => prev.map(c =>
        c.key === key ? { ...c, title: editTitle.trim(), body: editBody.trim() } : c
      ));
      setEditingKey(null);
      toast.success("Automacao atualizada.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h2 className="font-montserrat font-bold text-foreground text-base">Automacoes de push</h2>
          <p className="text-muted-foreground font-inter text-xs">Ative, desative ou edite as notificacoes automaticas</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-10">
          <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
          <p className="text-muted-foreground text-sm font-inter">
            Nenhuma configuracao encontrada.
          </p>
          <p className="text-muted-foreground text-xs font-inter mt-1">
            Execute a migracao SQL para criar as automacoes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {configs.map(cfg => {
            const label     = AUTOMATION_LABELS[cfg.key] ?? cfg.key;
            const isEditing = editingKey === cfg.key;

            return (
              <div
                key={cfg.key}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  cfg.enabled ? "border-border" : "border-border/40 opacity-60"
                }`}
              >
                <div className="p-3.5 bg-card space-y-2">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-inter font-bold text-foreground text-sm">{label}</p>
                      {cfg.description && (
                        <p className="text-muted-foreground text-[10px] font-inter mt-0.5 leading-relaxed">
                          {cfg.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(cfg)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleEnabled(cfg.key, cfg.enabled)}
                        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                          cfg.enabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        title={cfg.enabled ? "Desativar" : "Ativar"}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            cfg.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-[10px] font-inter font-semibold text-muted-foreground">Titulo</label>
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          maxLength={80}
                          className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-inter font-semibold text-muted-foreground">
                          Mensagem
                          {cfg.key === "devotional_reminder" && (
                            <span className="text-primary ml-1">(use {"{N}"} para mostrar a contagem pendente)</span>
                          )}
                        </label>
                        <textarea
                          value={editBody}
                          onChange={e => setEditBody(e.target.value)}
                          maxLength={200}
                          rows={2}
                          className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm font-inter text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        />
                        <p className="text-[10px] font-inter text-muted-foreground text-right">
                          {editBody.length}/200
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingKey(null)}
                          className="flex-1 py-1.5 rounded-lg border border-border text-muted-foreground font-inter text-xs font-medium hover:bg-muted transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => saveEdit(cfg.key)}
                          disabled={saving || !editTitle.trim() || !editBody.trim()}
                          className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground font-inter text-xs font-bold disabled:opacity-50"
                        >
                          {saving ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Preview current title/body */
                    <div className="bg-muted/30 rounded-xl px-3 py-2 space-y-0.5">
                      <p className="text-[10px] font-inter text-foreground font-semibold">{cfg.title}</p>
                      <p className="text-[10px] font-inter text-muted-foreground leading-relaxed">{cfg.body}</p>
                    </div>
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

// ─── Event Reminders Trigger ───────────────────────────────────────────────────

function EventRemindersTrigger() {
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<{ sent: number; failed: number; upcomingEvents: number; pastEvents: number } | null>(null);
  const [error,   setError]   = useState("");

  async function handleTrigger() {
    setSending(true); setError(""); setResult(null);
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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
          <CalendarClock className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h3 className="font-montserrat font-bold text-foreground text-sm">Lembretes de Eventos</h3>
          <p className="text-muted-foreground font-inter text-[10px]">Dispara automatico as 8h - Eventos +2 dias e -1 dia</p>
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
            {result.sent > 0 ? `${result.sent} notificacao(oes) enviada(s)` : "Nenhuma notificacao para enviar"}
          </p>
          <p className="text-muted-foreground text-[10px] font-inter">
            Eventos em 2 dias: {result.upcomingEvents} - Eventos de ontem: {result.pastEvents}
            {result.failed > 0 && ` - ${result.failed} falha(s)`}
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
          <><CalendarClock className="w-4 h-4" /> Disparar lembretes agora</>
        )}
      </button>
    </div>
  );
}

// ─── Push Log History ──────────────────────────────────────────────────────────

interface LogEntry {
  id:           string;
  type:         string;
  title:        string;
  body:         string;
  target:       string;
  target_value: string | null;
  sent_count:   number;
  failed_count: number;
  created_at:   string;
}

function PushLogHistory() {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("push_notification_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      toast.error("Erro ao carregar historico: " + error.message);
      setLogs([]);
    } else {
      setLogs((data as any as LogEntry[]) ?? []);
    }
    setLoading(false);
  }

  const typeLabels: Record<string, { label: string; emoji: string }> = {
    manual:               { label: "Push manual",        emoji: "P" },
    event_reminder:       { label: "Lembrete de evento", emoji: "E" },
    attendance_reminder:  { label: "Presenca",           emoji: "A" },
    prayer_pairs:         { label: "Dupla de oracao",    emoji: "O" },
  };

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
      " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function targetLabel(log: LogEntry) {
    if (log.target === "all")  return "Todos";
    if (log.target === "auto") return "Automatico";
    if (log.target_value)      return log.target_value;
    return log.target;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <History className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-montserrat font-bold text-foreground text-sm">Historico de disparos</h3>
          <p className="text-muted-foreground font-inter text-[10px]">Ultimos 20 envios registrados</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-xs font-inter text-center py-4">
          Nenhum disparo registrado ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const typeInfo = typeLabels[log.type] || { label: log.type, emoji: "P" };
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
                  <span className="text-[10px] font-inter text-muted-foreground">Destino: {targetLabel(log)}</span>
                  <span className="text-[10px] font-inter text-brand-green font-bold">OK {log.sent_count}</span>
                  {log.failed_count > 0 && (
                    <span className="text-[10px] font-inter text-destructive font-bold">Falhas {log.failed_count}</span>
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
