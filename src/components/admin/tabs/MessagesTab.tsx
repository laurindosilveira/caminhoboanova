import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { MessageSquare, Plus, Send, Users, MapPin, Globe, Trash2, GraduationCap, Eye, Share2, Bell } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Message = {
  id: string; title: string; body: string;
  area: string | null; community: string | null; turma_id: string | null; created_at: string;
};

type Turma = { id: string; name: string; area: string | null };

const AREA_1_COMMUNITIES = ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"];
const AREA_2_COMMUNITIES = ["Martim Lutero", "Linha Brasil", "Iriá Pira 2"];

export default function MessagesTab() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", target: "area" as "all" | "area" | "community" | "turma", community: "", turmaId: "" });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [showViewers, setShowViewers] = useState<string | null>(null);
  const [viewers, setViewers] = useState<{ name: string; viewedAt: string }[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [sendingPush, setSendingPush] = useState<string | null>(null);

  const communities = effectiveArea === "Área 1" ? AREA_1_COMMUNITIES : AREA_2_COMMUNITIES;

  useEffect(() => {
    fetchMessages();
    supabase.from("turmas").select("id, name, area").eq("is_active", true).order("name").then(({ data }) => setTurmas(data ?? []));
  }, [effectiveArea]);

  async function fetchMessages() {
    setLoading(true);
    const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
    // Filter messages relevant to the effective area
    const allMsgs = data ?? [];
    const msgs = allMsgs.filter(m => {
      // Global messages (no area, no community, no turma) — show always
      if (!m.area && !m.community && !m.turma_id) return true;
      // Messages for the effective area
      if (m.area && m.area === effectiveArea) return true;
      // Messages for a community in the effective area
      if (m.community) {
        const area1Communities = ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"];
        const communityArea = area1Communities.includes(m.community) ? "Área 1" : "Área 2";
        return communityArea === effectiveArea;
      }
      // Turma messages — show if turma belongs to effective area
      if (m.turma_id) {
        const turma = turmas.find(t => t.id === m.turma_id);
        return !turma || turma.area === effectiveArea;
      }
      return false;
    });
    setMessages(msgs);

    // Fetch view counts
    if (msgs.length > 0) {
      const msgIds = msgs.map(m => m.id);
      const { data: viewsData } = await supabase
        .from("message_views")
        .select("message_id")
        .in("message_id", msgIds);
      const counts: Record<string, number> = {};
      (viewsData ?? []).forEach((v: any) => {
        counts[v.message_id] = (counts[v.message_id] || 0) + 1;
      });
      setViewCounts(counts);
    }

    setLoading(false);
  }

  async function handleSend() {
    if (!form.title || !form.body) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const msgArea = form.target === "all" ? null : form.target === "turma" ? null : effectiveArea ?? null;
    const msgCommunity = form.target === "community" ? form.community : null;
    const msgTurmaId = form.target === "turma" ? form.turmaId : null;
    await supabase.from("messages").insert({
      title: form.title,
      body: form.body,
      area: msgArea,
      community: msgCommunity,
      turma_id: msgTurmaId,
      sent_by: user?.id,
    } as any);

    try {
      const pushTarget = form.target === "turma" ? "turma" : form.target === "all" ? "all" : form.target === "community" ? "community" : "area";
      const pushTargetValue = form.target === "all" ? undefined : form.target === "turma" ? form.turmaId : form.target === "community" ? form.community : effectiveArea;
      await supabase.functions.invoke("admin-push", {
        body: {
          title: "📢 Novo aviso no app!",
          body: "Você tem um novo comunicado. Toque para conferir.",
          target: pushTarget,
          targetValue: pushTargetValue,
        },
      });
    } catch (e) {
      console.warn("Push notification failed:", e);
    }

    setForm({ title: "", body: "", target: "area", community: "", turmaId: "" });
    setShowForm(false);
    setSaving(false);
    fetchMessages();
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este aviso?")) return;
    setDeleting(id);
    await supabase.from("messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    setDeleting(null);
  }

  async function openViewers(messageId: string) {
    if (showViewers === messageId) { setShowViewers(null); return; }
    setShowViewers(messageId);
    setLoadingViewers(true);
    const { data: viewsData } = await supabase
      .from("message_views")
      .select("user_id, viewed_at")
      .eq("message_id", messageId);
    
    if (viewsData && viewsData.length > 0) {
      const userIds = viewsData.map((v: any) => v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach(p => { nameMap[p.user_id] = p.full_name; });
      setViewers(viewsData.map((v: any) => ({
        name: nameMap[v.user_id] || "Desconhecido",
        viewedAt: v.viewed_at,
      })));
    } else {
      setViewers([]);
    }
    setLoadingViewers(false);
  }

  function shareOnWhatsApp(msg: Message) {
    const text = `📢 *${msg.title}*\n\n${msg.body}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  async function sendReminderPush(msg: Message) {
    setSendingPush(msg.id);
    try {
      // Get users who have NOT viewed this message
      const { data: viewsData } = await supabase
        .from("message_views")
        .select("user_id")
        .eq("message_id", msg.id);
      const viewedUserIds = new Set((viewsData ?? []).map((v: any) => v.user_id));

      // Get all target users based on message scope
      let targetQuery = supabase.from("profiles").select("user_id");
      if (msg.turma_id) {
        targetQuery = targetQuery.eq("turma_id", msg.turma_id);
      } else if (msg.community) {
        targetQuery = targetQuery.eq("community", msg.community as any);
      } else if (msg.area) {
        targetQuery = targetQuery.eq("area", msg.area as any);
      }
      const { data: targetUsers } = await targetQuery;
      
      const nonViewers = (targetUsers ?? []).filter(u => !viewedUserIds.has(u.user_id)).map(u => u.user_id);

      if (nonViewers.length === 0) {
        alert("Todos já visualizaram este aviso! 🎉");
        setSendingPush(null);
        return;
      }

      // Get push subscriptions for non-viewers
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", nonViewers);

      if (!subs || subs.length === 0) {
        alert(`${nonViewers.length} pessoa(s) não visualizaram, mas nenhuma tem push ativado.`);
        setSendingPush(null);
        return;
      }

      await supabase.functions.invoke("send-push-notifications", {
        body: {
          subscriptions: subs.map(s => ({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          })),
          title: "📢 Aviso pendente!",
          body: `Você ainda não viu: "${msg.title}". Abra o app para conferir!`,
        },
      });

      alert(`Push enviado para ${subs.length} pessoa(s) que não visualizaram!`);
    } catch (e) {
      console.error("Push reminder failed:", e);
      alert("Erro ao enviar push. Tente novamente.");
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
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Título *"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Mensagem *" rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />

          <div>
            <p className="font-inter text-xs text-muted-foreground mb-2">Enviar para:</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "all" as const, label: "Todos", icon: Globe },
                { value: "area" as const, label: effectiveArea || "Minha área", icon: MapPin },
                { value: "community" as const, label: "Comunidade", icon: Users },
                ...(turmas.length > 0 ? [{ value: "turma" as const, label: "Turma", icon: GraduationCap }] : []),
              ] as const).map(opt => (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, target: opt.value as any }))}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-inter transition-colors ${
                    form.target === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"
                  }`}>
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.target === "community" && (
            <select value={form.community} onChange={e => setForm(f => ({ ...f, community: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
              <option value="">Selecione a comunidade</option>
              {communities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {form.target === "turma" && (
            <select value={form.turmaId} onChange={e => setForm(f => ({ ...f, turmaId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
              <option value="">Selecione a turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.name}{t.area ? ` (${t.area})` : ""}</option>)}
            </select>
          )}

          <div className="flex gap-2">
            <button onClick={handleSend} disabled={saving || !form.title || !form.body || (form.target === "community" && !form.community) || (form.target === "turma" && !form.turmaId)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}>
              <Send className="w-4 h-4" /> {saving ? "Enviando..." : "Enviar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
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
          {messages.map(msg => (
            <div key={msg.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-montserrat font-bold text-foreground text-sm">{msg.title}</h3>
                  <p className="text-muted-foreground font-inter text-xs mt-1 leading-relaxed">{msg.body}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-muted-foreground font-inter text-[10px]">
                      {format(new Date(msg.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {msg.community ? (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[10px] font-inter font-medium">{msg.community}</span>
                    ) : msg.area ? (
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded-md text-[10px] font-inter font-medium">{msg.area}</span>
                    ) : (msg as any).turma_id ? (
                      <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-md text-[10px] font-inter font-medium">
                        {turmas.find(t => t.id === (msg as any).turma_id)?.name ?? "Turma"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-md text-[10px] font-inter font-medium">Todos</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => openViewers(msg.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium transition-colors ${
                        showViewers === msg.id
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {viewCounts[msg.id] ?? 0} viram
                    </button>
                    <button
                      onClick={() => shareOnWhatsApp(msg)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors border border-transparent"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => sendReminderPush(msg)}
                      disabled={sendingPush === msg.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-inter font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors border border-transparent disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {sendingPush === msg.id ? "Enviando..." : "Lembrar"}
                    </button>
                  </div>

                  {/* Viewers list */}
                  {showViewers === msg.id && (
                    <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border">
                      <p className="font-inter text-xs font-semibold text-foreground mb-2">
                        👁️ Quem visualizou ({viewCounts[msg.id] ?? 0})
                      </p>
                      {loadingViewers ? (
                        <div className="space-y-1.5">
                          {[1, 2].map(i => <div key={i} className="h-6 bg-muted rounded animate-pulse" />)}
                        </div>
                      ) : viewers.length === 0 ? (
                        <p className="text-muted-foreground font-inter text-xs">Ninguém visualizou ainda.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {viewers.map((v, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-background/50">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {v.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-inter text-xs text-foreground">{v.name}</span>
                              </div>
                              <span className="text-muted-foreground font-inter text-[10px]">
                                {format(new Date(v.viewedAt), "dd/MM HH:mm")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => handleDelete(msg.id)} disabled={deleting === msg.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title="Excluir aviso">
                  <Trash2 className={`w-4 h-4 ${deleting === msg.id ? "text-muted-foreground animate-pulse" : "text-destructive/60 hover:text-destructive"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}