import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, MessageSquare, Heart, BookOpen, ExternalLink, Eye, EyeOff, Trash2, CheckCircle, Reply, X, ChevronRight, MessageCircle, Paperclip, Image, Mic, XCircle, Loader2, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp";
const ACCEPTED_AUDIO = "audio/mpeg,audio/wav,audio/mp4,audio/webm";

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
  community: string;
  reply_to: string | null;
  reply_to_name: string | null;
  reply_to_text: string | null;
  file_url: string | null;
  file_type: string | null;
}

interface PrayerRequest {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  is_anonymous: boolean;
  amen_count: number;
  created_at: string;
  status: string;
}

interface CommunitySettings {
  whatsapp_link: string | null;
  verse_of_week: string | null;
  verse_reference: string | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}min`;
  return "agora";
}

export default function ClassroomTab() {
  const { profile, role } = useAuth();

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  // Typing indicator & online status
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef(0);

  // Orações
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerInput, setPrayerInput] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sendingPrayer, setSendingPrayer] = useState(false);
  const [showPrayerForm, setShowPrayerForm] = useState(false);
  const [amenLoading, setAmenLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canModerate = role === "admin" || role === "lider";
  // Settings
  const [settings, setSettings] = useState<CommunitySettings | null>(null);

  const community = profile?.community as string | undefined;
  const myUserId = profile?.user_id;
  const myName = profile?.full_name ?? "Anônimo";

  // ---- Fetch initial data ----
  useEffect(() => {
    if (!community) return;

    async function fetchAll() {
      const [chatRes, prayerRes, settingsRes] = await Promise.all([
        supabase
          .from("community_chat")
          .select("*")
          .eq("community", community!)
          .order("created_at", { ascending: true })
          .limit(50),
        supabase
          .from("prayer_requests")
          .select("*")
          .eq("community", community!)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("community_settings")
          .select("whatsapp_link, verse_of_week, verse_reference")
          .eq("community", community!)
          .maybeSingle(),
      ]);

      setChatMessages((chatRes.data ?? []) as ChatMessage[]);
      setPrayers((prayerRes.data ?? []) as PrayerRequest[]);
      setSettings(settingsRes.data as CommunitySettings | null);
    }

    fetchAll();
  }, [community]);

  // ---- Realtime: chat ----
  useEffect(() => {
    if (!community) return;

    const channel = supabase
      .channel(`community_chat:${community}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_chat",
          filter: `community=eq.${community}`,
        },
        (payload) => {
          setChatMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "community_chat",
          filter: `community=eq.${community}`,
        },
        (payload) => {
          setChatMessages((prev) => prev.filter(m => m.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [community]);

  // ---- Realtime: prayers ----
  useEffect(() => {
    if (!community) return;

    const channel = supabase
      .channel(`prayer_requests:${community}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prayer_requests",
          filter: `community=eq.${community}`,
        },
        () => {
          // Re-fetch prayers on any change
          supabase
            .from("prayer_requests")
            .select("*")
            .eq("community", community!)
            .order("created_at", { ascending: false })
            .limit(20)
            .then(({ data }) => setPrayers((data ?? []) as PrayerRequest[]));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [community]);

  // ---- Presence: typing indicator + online status ----
  useEffect(() => {
    if (!community || !myUserId || !myName) return;

    const presenceChannel = supabase.channel(`presence:${community}`, {
      config: { presence: { key: myUserId } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const allUsers = Object.keys(state);
        setOnlineCount(allUsers.length);
        
        // Extract typing users
        const typing: string[] = [];
        for (const [uid, presences] of Object.entries(state)) {
          const p = presences as any[];
          if (p.some((pr: any) => pr.typing) && uid !== myUserId) {
            const name = p[0]?.name?.split(" ")[0] || "Alguém";
            typing.push(name);
          }
        }
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ name: myName, typing: false });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [community, myUserId, myName]);

  // Broadcast typing status
  const broadcastTyping = useCallback(() => {
    if (!community || !myUserId) return;
    const now = Date.now();
    if (now - lastTypingBroadcast.current < 2000) return; // throttle
    lastTypingBroadcast.current = now;

    const channel = supabase.channel(`presence:${community}`);
    channel.track({ name: myName, typing: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channel.track({ name: myName, typing: false });
    }, 3000);
  }, [community, myUserId, myName]);

  // Load more messages (infinite scroll up)
  const loadMoreMessages = useCallback(async () => {
    if (!community || loadingMore || !hasMore || chatMessages.length === 0) return;
    setLoadingMore(true);
    const oldestDate = chatMessages[0]?.created_at;
    const { data } = await supabase
      .from("community_chat")
      .select("*")
      .eq("community", community)
      .lt("created_at", oldestDate)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!data || data.length === 0) {
      setHasMore(false);
    } else {
      setChatMessages(prev => [...(data as ChatMessage[]).reverse(), ...prev]);
      if (data.length < PAGE_SIZE) setHasMore(false);
    }
    setLoadingMore(false);
  }, [community, loadingMore, hasMore, chatMessages]);

  // Handle chat scroll for infinite scroll
  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop < 40 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  }, [hasMore, loadingMore, loadMoreMessages]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ---- Actions ----
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isImage && !isAudio) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande (máx. 10MB)");
      return;
    }
    setAttachedFile(file);
    if (isImage) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function clearAttachment() {
    setAttachedFile(null);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
  }

  async function sendChat() {
    if ((!chatInput.trim() && !attachedFile) || !community || !myUserId) return;
    setSendingChat(true);
    const msgText = chatInput.trim();
    const replyTarget = replyTo;

    let fileUrl: string | null = null;
    let fileType: string | null = null;

    // Upload file if attached
    if (attachedFile) {
      setUploadingFile(true);
      const ext = attachedFile.name.split(".").pop() || "bin";
      const path = `${myUserId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("chat-files")
        .upload(path, attachedFile, { cacheControl: "3600", upsert: false });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileType = attachedFile.type.startsWith("image/") ? "image" : "audio";
      }
      setUploadingFile(false);
    }

    await supabase.from("community_chat").insert({
      community,
      user_id: myUserId,
      user_name: myName,
      message: msgText || (fileType === "image" ? "📷 Imagem" : "🎵 Áudio"),
      reply_to: replyTarget?.id ?? null,
      reply_to_name: replyTarget?.user_name ?? null,
      reply_to_text: replyTarget ? replyTarget.message.slice(0, 80) : null,
      file_url: fileUrl,
      file_type: fileType,
    } as any);
    setChatInput("");
    setReplyTo(null);
    clearAttachment();
    setSendingChat(false);

    // Send push notification to the original author (fire-and-forget)
    if (replyTarget && replyTarget.user_id !== myUserId) {
      supabase.functions.invoke("notify-chat-reply", {
        body: {
          target_user_id: replyTarget.user_id,
          sender_name: myName,
          message_preview: msgText || (fileType === "image" ? "📷 Imagem" : "🎵 Áudio"),
        },
      }).catch(() => {});
    }
  }

  async function sendPrayer() {
    if (!prayerInput.trim() || !community || !myUserId) return;
    setSendingPrayer(true);
    await supabase.from("prayer_requests").insert({
      community,
      user_id: myUserId,
      user_name: myName,
      content: prayerInput.trim(),
      is_anonymous: isAnonymous,
    });
    setPrayerInput("");
    setIsAnonymous(false);
    setShowPrayerForm(false);
    setSendingPrayer(false);
  }

  async function handleAmen(prayer: PrayerRequest) {
    setAmenLoading(prayer.id);
    await supabase
      .from("prayer_requests")
      .update({ amen_count: prayer.amen_count + 1 })
      .eq("id", prayer.id);
    setPrayers((prev) =>
      prev.map((p) => p.id === prayer.id ? { ...p, amen_count: p.amen_count + 1 } : p)
    );
    setAmenLoading(null);
  }

  async function deletePrayer(id: string) {
    if (!confirm("Deseja excluir este pedido de oração?")) return;
    setDeletingId(id);
    await supabase.from("prayer_requests").delete().eq("id", id);
    setPrayers(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  }

  async function togglePrayerStatus(prayer: PrayerRequest) {
    const newStatus = prayer.status === "respondido" ? "em_oracao" : "respondido";
    await supabase.from("prayer_requests").update({ status: newStatus } as any).eq("id", prayer.id);
    setPrayers(prev => prev.map(p => p.id === prayer.id ? { ...p, status: newStatus } : p));
  }

  async function deleteChatMessage(id: string) {
    if (!confirm("Deseja excluir esta mensagem?")) return;
    setDeletingId(id);
    await supabase.from("community_chat").delete().eq("id", id);
    setChatMessages(prev => prev.filter(m => m.id !== id));
    setDeletingId(null);
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function renderFileContent(msg: ChatMessage) {
    if (!msg.file_url) return null;
    if (msg.file_type === "image") {
      return (
        <img
          src={msg.file_url}
          alt="Imagem"
          className="rounded-xl max-w-full max-h-48 object-cover mt-1 cursor-pointer"
          onClick={() => window.open(msg.file_url!, "_blank")}
        />
      );
    }
    if (msg.file_type === "audio") {
      return (
        <audio controls className="mt-1 max-w-full h-8" preload="metadata">
          <source src={msg.file_url} />
        </audio>
      );
    }
    return null;
  }

  function renderThreadMessage(msg: ChatMessage, isRoot: boolean) {
    const isMe = msg.user_id === myUserId;
    return (
      <div key={msg.id} className={`flex gap-2 ${isRoot ? "" : "ml-4"}`}>
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-montserrat font-black text-primary-foreground">
            {msg.user_name[0]?.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-montserrat font-bold ${isMe ? "text-primary" : "text-foreground"}`}>
              {msg.user_name.split(" ")[0]}
            </span>
            <span className="text-[10px] text-muted-foreground font-inter">{formatDateTime(msg.created_at)}</span>
          </div>
          <div className={`rounded-2xl px-3 py-2 text-sm font-inter leading-relaxed ${isRoot ? "bg-primary/5 border border-primary/20" : "bg-muted"} text-foreground`}>
            {(!msg.file_url || (msg.message && msg.message !== "📷 Imagem" && msg.message !== "🎵 Áudio")) && msg.message}
            {renderFileContent(msg)}
          </div>
          <div className="flex items-center gap-1 mt-0.5 px-1">
            <button
              onClick={() => { setReplyTo(msg); }}
              className="p-0.5 rounded text-muted-foreground/50 hover:text-primary transition-colors"
              title="Responder"
            >
              <Reply className="w-3 h-3" />
            </button>
            {(isMe || canModerate) && (
              <button
                onClick={() => deleteChatMessage(msg.id)}
                disabled={deletingId === msg.id}
                className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!community) return null;

  return (
    <div className="space-y-5">

      {/* ===== VERSÍCULO DA SEMANA ===== */}
      {settings?.verse_of_week && (
        <div
          className="mx-5 rounded-2xl p-4 border border-border shadow-sm"
          style={{ background: "var(--gradient-gold)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-foreground/70" />
            <span className="font-montserrat font-bold text-foreground/80 text-xs uppercase tracking-wide">
              Versículo da semana
            </span>
          </div>
          <p className="font-inter text-foreground text-sm leading-relaxed italic">
            "{settings.verse_of_week}"
          </p>
          {settings.verse_reference && (
            <p className="font-montserrat font-bold text-foreground/70 text-xs mt-2">
              — {settings.verse_reference}
            </p>
          )}
        </div>
      )}

      {/* ===== LINK DO WHATSAPP ===== */}
      {settings?.whatsapp_link && (
        <div className="mx-5">
          <a
            href={settings.whatsapp_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm hover:bg-muted/50 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(145 63% 45%), hsl(145 63% 35%))" }}
            >
              <span className="text-xl">💬</span>
            </div>
            <div className="flex-1">
              <p className="font-montserrat font-bold text-foreground text-sm">Grupo do WhatsApp</p>
              <p className="text-muted-foreground text-xs font-inter">Participe do grupo da turma</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </a>
        </div>
      )}

      {/* Sala do Discipulador moved to CommunityTab as separate tab */}

      {/* ===== MURAL DE ORAÇÕES ===== */}
      <div className="mx-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🙏</span>
            <span className="font-montserrat font-bold text-foreground text-sm">Mural de Orações</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 rounded-xl border-primary/40 text-primary"
            onClick={() => setShowPrayerForm(!showPrayerForm)}
          >
            {showPrayerForm ? "Cancelar" : "+ Pedido"}
          </Button>
        </div>

        {/* Form de pedido */}
        {showPrayerForm && (
          <div className="bg-card border border-border rounded-2xl p-4 mb-3 space-y-3">
            <Textarea
              placeholder="Compartilhe seu pedido de oração com a turma..."
              value={prayerInput}
              onChange={(e) => setPrayerInput(e.target.value)}
              className="text-sm resize-none min-h-[80px] border-border"
              maxLength={300}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsAnonymous(!isAnonymous)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isAnonymous ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {isAnonymous ? "Anônimo" : "Com meu nome"}
              </button>
              <Button
                size="sm"
                className="h-8 rounded-xl text-xs"
                onClick={sendPrayer}
                disabled={!prayerInput.trim() || sendingPrayer}
              >
                {sendingPrayer ? "Enviando..." : "Enviar 🙏"}
              </Button>
            </div>
          </div>
        )}

        {/* Lista de orações */}
        {prayers.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">🙏</p>
            <p className="text-muted-foreground text-sm font-inter">Nenhum pedido ainda. Seja o primeiro!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {prayers.map((p) => (
              <div key={p.id} className={`bg-card border rounded-2xl p-4 ${p.status === "respondido" ? "border-brand-green/30 bg-brand-green/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-montserrat font-bold text-muted-foreground">
                        {p.is_anonymous ? "Anônimo" : p.user_name}
                        <span className="font-normal ml-1">· {timeAgo(p.created_at)}</span>
                      </p>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-inter font-semibold ${
                        p.status === "respondido" 
                          ? "bg-brand-green/15 text-brand-green" 
                          : "bg-primary/10 text-primary"
                      }`}>
                        {p.status === "respondido" ? "✔ Respondido" : "🙏 Em oração"}
                      </span>
                    </div>
                    <p className={`text-sm font-inter leading-relaxed ${p.status === "respondido" ? "text-muted-foreground" : "text-card-foreground"}`}>{p.content}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => handleAmen(p)}
                      disabled={amenLoading === p.id}
                      className="flex flex-col items-center gap-0.5 group"
                    >
                      <Heart className="w-5 h-5 text-primary group-hover:fill-primary transition-all" />
                      <span className="text-xs font-montserrat font-bold text-primary">
                        {p.amen_count > 0 ? p.amen_count : "Amém"}
                      </span>
                    </button>
                    {p.user_id === myUserId && (
                      <button
                        onClick={() => togglePrayerStatus(p)}
                        className={`p-1 rounded-lg transition-colors ${
                          p.status === "respondido"
                            ? "text-brand-green hover:bg-brand-green/10"
                            : "text-muted-foreground hover:text-brand-green hover:bg-brand-green/10"
                        }`}
                        title={p.status === "respondido" ? "Voltar para em oração" : "Marcar como respondido"}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {(p.user_id === myUserId || canModerate) && (
                    <button
                      onClick={() => deletePrayer(p.id)}
                      disabled={deletingId === p.id}
                      className="flex-shrink-0 ml-1 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      title="Excluir pedido"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== CHAT DA TURMA ===== */}
      <div className="mx-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-montserrat font-bold text-foreground text-sm">Chat da Turma</span>
          <div className="flex items-center gap-2 ml-auto">
            {onlineCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-inter text-muted-foreground">
                <Wifi className="w-3 h-3 text-brand-green" />
                {onlineCount} online
              </span>
            )}
            <span className="text-xs text-muted-foreground font-inter">tempo real</span>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Thread panel or main chat */}
          {threadRootId ? (() => {
            const rootMsg = chatMessages.find(m => m.id === threadRootId);
            const replies = chatMessages.filter(m => m.reply_to === threadRootId);
            if (!rootMsg) { setThreadRootId(null); return null; }

            return (
              <>
                <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-muted/30">
                  <button onClick={() => setThreadRootId(null)} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="w-4 h-4" />
                  </button>
                  <MessageCircle className="w-3.5 h-3.5 text-primary" />
                  <span className="font-montserrat font-bold text-foreground text-xs">Thread · {replies.length} resposta{replies.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="h-64 overflow-y-auto p-3 space-y-2">
                  {/* Original message */}
                  {renderThreadMessage(rootMsg, true)}
                  {/* Divider */}
                  {replies.length > 0 && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground font-inter">{replies.length} resposta{replies.length !== 1 ? "s" : ""}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {/* Replies */}
                  {replies
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(r => renderThreadMessage(r, false))}
                  <div ref={threadEndRef} />
                </div>
              </>
            );
          })() : (
            <div ref={chatContainerRef} className="h-64 overflow-y-auto p-3 space-y-2" onScroll={handleChatScroll}>
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && chatMessages.length > PAGE_SIZE && (
                <p className="text-center text-[10px] text-muted-foreground font-inter py-1">Início da conversa</p>
              )}
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-2xl mb-1">💬</p>
                    <p className="text-muted-foreground text-sm font-inter">Nenhuma mensagem ainda. Diga olá!</p>
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.user_id === myUserId;
                  const replyCount = chatMessages.filter(m => m.reply_to === msg.id).length;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMe && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-montserrat font-black text-primary-foreground">
                            {msg.user_name[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && (
                          <span className="text-xs text-muted-foreground font-montserrat font-bold mb-0.5 px-1">
                            {msg.user_name.split(" ")[0]}
                          </span>
                        )}
                        {/* Reply context */}
                        {msg.reply_to_name && (
                          <button
                            onClick={() => setThreadRootId(msg.reply_to)}
                            className={`flex items-center gap-1 px-2 py-1 mb-0.5 rounded-lg bg-muted/60 border-l-2 border-primary/40 max-w-full cursor-pointer hover:bg-muted transition-colors ${isMe ? "self-end" : "self-start"}`}
                          >
                            <Reply className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-[10px] font-montserrat font-bold text-primary truncate">{msg.reply_to_name.split(" ")[0]}</span>
                            <span className="text-[10px] font-inter text-muted-foreground truncate">{msg.reply_to_text}</span>
                          </button>
                        )}
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm font-inter leading-relaxed ${
                            isMe
                              ? "text-primary-foreground rounded-tr-sm"
                              : "bg-muted text-foreground rounded-tl-sm"
                          }`}
                          style={isMe ? { background: "var(--gradient-hero)" } : undefined}
                        >
                          {(!msg.file_url || (msg.message && msg.message !== "📷 Imagem" && msg.message !== "🎵 Áudio")) && msg.message}
                          {renderFileContent(msg)}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 px-1">
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(msg.created_at)}
                          </span>
                          {/* Thread badge */}
                          {replyCount > 0 && (
                            <button
                              onClick={() => setThreadRootId(msg.id)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <MessageCircle className="w-2.5 h-2.5" />
                              <span className="text-[9px] font-inter font-bold">{replyCount}</span>
                            </button>
                          )}
                          {/* Reply button */}
                          <button
                            onClick={() => setReplyTo(msg)}
                            className="p-0.5 rounded text-muted-foreground/50 hover:text-primary transition-colors"
                            title="Responder"
                          >
                            <Reply className="w-3 h-3" />
                          </button>
                          {(isMe || canModerate) && (
                            <button
                              onClick={() => deleteChatMessage(msg.id)}
                              disabled={deletingId === msg.id}
                              className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive transition-colors disabled:opacity-40"
                              title="Excluir mensagem"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="border-t border-border px-3 pt-2 flex items-center gap-2 bg-muted/30">
              <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-montserrat font-bold text-primary">{replyTo.user_name.split(" ")[0]}</span>
                <p className="text-[10px] font-inter text-muted-foreground truncate">{replyTo.message.slice(0, 60)}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* File preview */}
          {attachedFile && (
            <div className="border-t border-border px-3 py-2 bg-muted/30">
              <div className="flex items-center gap-2">
                {filePreviewUrl ? (
                  <img src={filePreviewUrl} alt="Preview" className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-inter text-foreground truncate">{attachedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(attachedFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={clearAttachment} className="text-muted-foreground hover:text-destructive p-1">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={`${ACCEPTED_IMAGES},${ACCEPTED_AUDIO}`}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="border-t border-border px-3 py-1.5 bg-muted/20">
              <p className="text-[10px] font-inter text-muted-foreground animate-pulse">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} está digitando...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0]} e ${typingUsers[1]} estão digitando...`
                  : `${typingUsers[0]} e mais ${typingUsers.length - 1} estão digitando...`
                }
              </p>
            </div>
          )}

          {/* Input */}
          <div className={`border-t border-border p-3 flex items-center gap-2 ${replyTo || attachedFile ? "pt-2" : ""}`}>
            {/* Attachment buttons */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ACCEPTED_IMAGES;
                    fileInputRef.current.click();
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Enviar imagem"
              >
                <Image className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ACCEPTED_AUDIO;
                    fileInputRef.current.click();
                  }
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Enviar áudio"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <Input
              placeholder={threadRootId ? "Responder na thread..." : "Mensagem para a turma..."}
              value={chatInput}
              onChange={(e) => { setChatInput(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
              className="flex-1 h-9 text-sm border-border rounded-xl"
              maxLength={500}
            />
            <button
              onClick={sendChat}
              disabled={(!chatInput.trim() && !attachedFile) || sendingChat || uploadingFile}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
