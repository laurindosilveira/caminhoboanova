import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { Bell, Eye, Globe, GraduationCap, MapPin, MessageSquare, Plus, Send, Share2, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getAreaForCommunity, getCommunitiesForArea } from "@/config/areas";

type Message = {
  id: string;
  title: string;
  body: string;
  area: string | null;
  community: string | null;
  turma_id: string | null;
  created_at: string;
};

type Turma = {
  id: string;
  name: string;
  area: string | null;
};

const FINAL_PUSH_COPY = {
  title: "Novo aviso no app",
  body: "Voce tem um novo comunicado. Toque para conferir.",
  reminderTitle: "Aviso pendente",
};

type Props = {
  /** When true, restricts sending options to only the leader's own area/turma */
  leaderMode?: boolean;
};

export default function MessagesTab({ leaderMode = false }: Props) {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    target: (leaderMode ? "turma" : "area") as "all" | "area" | "community" | "turma",
    community: "",
    turmaId: leaderMode && profile?.turma_id ? profile.turma_id : "",
  });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [showViewers, setShowViewers] = useState<string | null>(null);
  const [viewers, setViewers] = useState<{ name: string; viewedAt: string }[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [sendingPush, setSendingPush] = useState<string | null>(null);

  const communities = getCommunitiesForArea(effectiveArea ?? "");

  useEffect(() => {
    void loadTurmasAndMessages();
  }, [effectiveArea]);

  async function loadTurmasAndMessages() {
    const { data: turmasData, error: turmasError } = await supabase
      .from("turmas")
      .select("id, name, area")
      .eq("is_active", true)
      .order("name");

    if (turmasError) {
      toast.error(`Erro ao carregar turmas: ${turmasError.message}`);
      setTurmas([]);
      await fetchMessages([]);
      return;
    }

    const scopedTurmas = (turmasData ?? []).filter((turma) => !effectiveArea || turma.area === effectiveArea);
    setTurmas(scopedTurmas);
    await fetchMessages(scopedTurmas);
  }

  async function fetchMessages(currentTurmas: Turma[] = turmas) {
    setLoading(true);
    const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(`Erro ao carregar comunicados: ${error.message}`);
      setMessages([]);
      setViewCounts({});
      setLoading(false);
      return;
    }

    const allMessages = data ?? [];
    const scopedMessages = allMessages.filter((message) => {
      if (!message.area && !message.community && !message.turma_id) return true;
      if (message.area) return message.area === effectiveArea;
      if (message.community) return getAreaForCommunity(message.community) === effectiveArea;
      if (message.turma_id) {
        const turma = currentTurmas.find((item) => item.id === message.turma_id);
        return turma?.area === effectiveArea;
      }
      return false;
    });
    setMessages(scopedMessages);

    if (scopedMessages.length === 0) {
      setViewCounts({});
      setLoading(false);
      return;
    }

    const { data: viewsData, error: viewsError } = await supabase
      .from("message_views")
      .select("message_id")
      .in("message_id", scopedMessages.map((message) => message.id));

    if (viewsError) {
      toast.error(`Erro ao carregar visualizacoes: ${viewsError.message}`);
      setViewCounts({});
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    (viewsData ?? []).forEach((view: any) => {
      counts[view.message_id] = (counts[view.message_id] ?? 0) + 1;
    });
    setViewCounts(counts);
    setLoading(false);
  }

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      toast.error(`Erro ao identificar o lider: ${authError.message}`);
      setSaving(false);
      return;
    }
    const userId = authData.user?.id;
    const messageArea = form.target === "all" ? null : form.target === "turma" ? null : effectiveArea ?? null;
    const messageCommunity = form.target === "community" ? form.community : null;
    const messageTurmaId = form.target === "turma" ? form.turmaId : null;

    const { error: insertError } = await supabase.from("messages").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      area: messageArea,
      community: messageCommunity,
      turma_id: messageTurmaId,
      sent_by: userId,
    } as any);

    if (insertError) {
      toast.error(`Erro ao criar comunicado: ${insertError.message}`);
      setSaving(false);
      return;
    }

    try {
      const pushTarget = form.target === "all"
        ? "all"
        : form.target === "community"
          ? "community"
          : form.target === "turma"
            ? "turma"
            : "area";
      const targetValue = form.target === "all"
        ? undefined
        : form.target === "community"
          ? form.community
          : form.target === "turma"
            ? form.turmaId
            : effectiveArea;

      const { error: pushError } = await supabase.functions.invoke("admin-push", {
        body: {
          title: FINAL_PUSH_COPY.title,
          body: FINAL_PUSH_COPY.body,
          target: pushTarget,
          targetValue: targetValue,
        },
      });

      if (pushError) {
        toast.warning(`Comunicado criado, mas o push falhou: ${pushError.message}`);
      } else {
        toast.success("Comunicado enviado.");
      }
    } catch (error: any) {
      toast.warning(`Comunicado criado, mas o push falhou: ${error.message}`);
    }

    setForm({ title: "", body: "", target: "area", community: "", turmaId: "" });
    setShowForm(false);
    setSaving(false);
    await fetchMessages();
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este aviso?")) return;
    setDeleting(id);
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error(`Erro ao excluir aviso: ${error.message}`);
    } else {
      setMessages((prev) => prev.filter((message) => message.id !== id));
      setViewCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success("Aviso excluido.");
    }
    setDeleting(null);
  }

  async function openViewers(messageId: string) {
    if (showViewers === messageId) {
      setShowViewers(null);
      setViewers([]);
      return;
    }

    setShowViewers(messageId);
    setLoadingViewers(true);
    const { data: viewsData, error: viewsError } = await supabase
      .from("message_views")
      .select("user_id, viewed_at")
      .eq("message_id", messageId);

    if (viewsError) {
      toast.error(`Erro ao carregar visualizacoes: ${viewsError.message}`);
      setViewers([]);
      setLoadingViewers(false);
      return;
    }

    if (!viewsData || viewsData.length === 0) {
      setViewers([]);
      setLoadingViewers(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", viewsData.map((view: any) => view.user_id));

    if (profilesError) {
      toast.error(`Erro ao carregar nomes: ${profilesError.message}`);
      setViewers([]);
      setLoadingViewers(false);
      return;
    }

    const nameMap: Record<string, string> = {};
    (profilesData ?? []).forEach((item: any) => {
      nameMap[item.user_id] = item.full_name;
    });

    setViewers(
      viewsData.map((view: any) => ({
        name: nameMap[view.user_id] ?? "Desconhecido",
        viewedAt: view.viewed_at,
      }))
    );
    setLoadingViewers(false);
  }

  function shareOnWhatsApp(message: Message) {
    const text = `*${message.title}*\n\n${message.body}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function sendReminderPush(message: Message) {
    setSendingPush(message.id);
    try {
      const { data: viewsData, error: viewsError } = await supabase
        .from("message_views")
        .select("user_id")
        .eq("message_id", message.id);
      if (viewsError) throw viewsError;

      const viewedUserIds = new Set((viewsData ?? []).map((view: any) => view.user_id));

      let targetQuery = supabase.from("profiles").select("user_id");
      if (message.turma_id) targetQuery = targetQuery.eq("turma_id", message.turma_id);
      else if (message.community) targetQuery = targetQuery.eq("community", message.community as any);
      else if (message.area) targetQuery = targetQuery.eq("area", message.area as any);

      const { data: targetUsers, error: targetError } = await targetQuery;
      if (targetError) throw targetError;

      const nonViewers = (targetUsers ?? [])
        .filter((item) => !viewedUserIds.has(item.user_id))
        .map((item) => item.user_id);

      if (nonViewers.length === 0) {
        toast.info("Todos ja visualizaram este aviso.");
        setSendingPush(null);
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const userId of nonViewers) {
        const { data, error: pushError } = await supabase.functions.invoke("admin-push", {
          body: {
            title: FINAL_PUSH_COPY.reminderTitle,
            body: `Voce ainda nao viu: "${message.title}". Abra o app para conferir.`,
            target: "user",
            targetValue: userId,
          },
        });
        if (pushError) throw pushError;
        sent += data?.sent ?? 0;
        failed += data?.failed ?? 0;
      }

      if (sent === 0) {
        toast.info(`${nonViewers.length} pessoa(s) ainda nao visualizaram, mas nenhuma recebeu push.`);
      } else {
        toast.success(`Push enviado para ${sent} dispositivo(s).${failed ? ` ${failed} falha(s).` : ""}`);
      }
    } catch (error: any) {
      toast.error(`Erro ao enviar push de lembrete: ${error.message}`);
    }
    setSendingPush(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-montserrat font-bold text-foreground text-base">Comunicados</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo comunicado
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm">Novo comunicado</p>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo *"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <textarea
            value={form.body}
            onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            placeholder="Mensagem *"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />

          <div>
            <p className="font-inter text-xs text-muted-foreground mb-2">Enviar para:</p>
            <div className="grid grid-cols-2 gap-2">
              {(leaderMode
                ? [
                    ...(profile?.turma_id ? [{ value: "turma" as const, label: "Minha Turma", icon: GraduationCap }] : []),
                    { value: "area" as const, label: effectiveArea || "Minha Área", icon: MapPin },
                  ]
                : [
                    { value: "all" as const, label: "Todos", icon: Globe },
                    { value: "area" as const, label: effectiveArea || "Minha area", icon: MapPin },
                    { value: "community" as const, label: "Comunidade", icon: Users },
                    ...(turmas.length > 0 ? [{ value: "turma" as const, label: "Turma", icon: GraduationCap }] : []),
                  ]
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setForm((prev) => ({ ...prev, target: option.value as any }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-inter transition-colors ${
                    form.target === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {form.target === "community" && (
            <select
              value={form.community}
              onChange={(event) => setForm((prev) => ({ ...prev, community: event.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">Selecione a comunidade</option>
              {communities.map((community) => (
                <option key={community} value={community}>{community}</option>
              ))}
            </select>
          )}

          {form.target === "turma" && (
            leaderMode ? (
              <div className="px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5 text-foreground font-inter text-sm">
                {turmas.find(t => t.id === profile?.turma_id)?.name ?? "Minha turma"}
              </div>
            ) : (
              <select
                value={form.turmaId}
                onChange={(event) => setForm((prev) => ({ ...prev, turmaId: event.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Selecione a turma</option>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.name}{turma.area ? ` (${turma.area})` : ""}
                  </option>
                ))}
              </select>
            )
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={
                saving ||
                !form.title.trim() ||
                !form.body.trim() ||
                (form.target === "community" && !form.community) ||
                (form.target === "turma" && !form.turmaId)
              }
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Send className="w-4 h-4" /> {saving ? "Enviando..." : "Enviar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-inter text-sm">Carregando...</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum comunicado enviado</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Clique em "Novo comunicado" para enviar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-montserrat font-bold text-foreground text-sm">{message.title}</h3>
                  <p className="text-muted-foreground font-inter text-xs mt-1 leading-relaxed">{message.body}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-muted-foreground font-inter text-[10px]">
                      {format(new Date(message.created_at), "d 'de' MMM 'as' HH:mm", { locale: ptBR })}
                    </span>
                    {message.community ? (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-inter font-medium">
                        {message.community}
                      </span>
                    ) : message.area ? (
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-md text-[10px] font-inter font-medium">
                        {message.area}
                      </span>
                    ) : message.turma_id ? (
                      <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-md text-[10px] font-inter font-medium">
                        {turmas.find((turma) => turma.id === message.turma_id)?.name ?? "Turma"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-md text-[10px] font-inter font-medium">
                        Todos
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => openViewers(message.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium transition-colors ${
                        showViewers === message.id
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {viewCounts[message.id] ?? 0} viram
                    </button>
                    <button
                      onClick={() => shareOnWhatsApp(message)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors border border-transparent"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => sendReminderPush(message)}
                      disabled={sendingPush === message.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors border border-transparent disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {sendingPush === message.id ? "Enviando..." : "Lembrar"}
                    </button>
                  </div>

                  {showViewers === message.id && (
                    <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border">
                      <p className="font-inter text-xs font-semibold text-foreground mb-2">
                        Quem visualizou ({viewCounts[message.id] ?? 0})
                      </p>
                      {loadingViewers ? (
                        <div className="space-y-1.5">
                          {[1, 2].map((item) => (
                            <div key={item} className="h-6 bg-muted rounded animate-pulse" />
                          ))}
                        </div>
                      ) : viewers.length === 0 ? (
                        <p className="text-muted-foreground font-inter text-xs">Ninguem visualizou ainda.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {viewers.map((viewer, index) => (
                            <div key={index} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {viewer.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-inter text-xs text-foreground">{viewer.name}</span>
                              </div>
                              <span className="text-muted-foreground font-inter text-[10px]">
                                {format(new Date(viewer.viewedAt), "dd/MM HH:mm")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(message.id)}
                  disabled={deleting === message.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title="Excluir aviso"
                >
                  <Trash2 className={`w-4 h-4 ${deleting === message.id ? "text-muted-foreground animate-pulse" : "text-destructive/60 hover:text-destructive"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
