import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Trash2, X } from "lucide-react";

const REACTION_EMOJIS = [
  { emoji: "🙏", label: "orando" },
  { emoji: "❤️", label: "amém" },
  { emoji: "🔥", label: "forte" },
  { emoji: "🙌", label: "glória" },
];

interface Message {
  id: string;
  title: string;
  body: string;
  created_at: string;
  turma_id: string | null;
}

interface ReactionDetail {
  count: number;
  hasReacted: boolean;
  userIds: string[];
}

type ReactionMap = Record<string, Record<string, ReactionDetail>>;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d atrás`;
  if (h > 0) return `${h}h atrás`;
  return `${m}min atrás`;
}

export default function AnnouncementsSection() {
  const { profile, role } = useAuth();
  const canDelete = role === "admin" || role === "lider";
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [loading, setLoading] = useState(true);
  const [showUsers, setShowUsers] = useState<{ messageId: string; emoji: string } | null>(null);
  const [reactionUsers, setReactionUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [turmaNames, setTurmaNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    async function fetchMessages() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data }, { data: reactionsData }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, title, body, created_at, turma_id")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("message_reactions").select("message_id, emoji, user_id"),
      ]);
      const msgs = (data ?? []) as Message[];
      setMessages(msgs);

      // Record views for all fetched messages
      if (user && msgs.length > 0) {
        const viewInserts = msgs.map(m => ({ message_id: m.id, user_id: user.id }));
        await supabase.from("message_views").upsert(viewInserts, { onConflict: "message_id,user_id", ignoreDuplicates: true });
      }

      // Fetch turma names for turma-targeted messages
      const turmaIds = [...new Set(msgs.filter(m => m.turma_id).map(m => m.turma_id!))];
      if (turmaIds.length > 0) {
        const { data: turmaData } = await supabase.from("turmas").select("id, name").in("id", turmaIds);
        const tMap: Record<string, string> = {};
        (turmaData ?? []).forEach(t => { tMap[t.id] = t.name; });
        setTurmaNames(tMap);
      }

      const rMap: ReactionMap = {};
      (reactionsData ?? []).forEach((r: any) => {
        if (!rMap[r.message_id]) rMap[r.message_id] = {};
        if (!rMap[r.message_id][r.emoji]) rMap[r.message_id][r.emoji] = { count: 0, hasReacted: false, userIds: [] };
        rMap[r.message_id][r.emoji].count++;
        rMap[r.message_id][r.emoji].userIds.push(r.user_id);
        if (user && r.user_id === user.id) rMap[r.message_id][r.emoji].hasReacted = true;
      });
      setReactions(rMap);
      setLoading(false);
    }
    fetchMessages();
  }, [profile]);

  async function toggleReaction(messageId: string, emoji: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const current = reactions[messageId]?.[emoji];
    if (current?.hasReacted) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
      setReactions(prev => {
        const copy = { ...prev };
        if (copy[messageId]?.[emoji]) {
          copy[messageId] = { ...copy[messageId] };
          const old = copy[messageId][emoji];
          copy[messageId][emoji] = { count: old.count - 1, hasReacted: false, userIds: old.userIds.filter(id => id !== user.id) };
          if (copy[messageId][emoji].count <= 0) delete copy[messageId][emoji];
        }
        return copy;
      });
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
      setReactions(prev => {
        const copy = { ...prev };
        if (!copy[messageId]) copy[messageId] = {};
        copy[messageId] = { ...copy[messageId] };
        const old = copy[messageId][emoji] ?? { count: 0, hasReacted: false, userIds: [] };
        copy[messageId][emoji] = { count: old.count + 1, hasReacted: true, userIds: [...old.userIds, user.id] };
        return copy;
      });
    }
  }

  async function showReactionUsers(messageId: string, emoji: string) {
    const r = reactions[messageId]?.[emoji];
    if (!r || r.count === 0) return;
    setShowUsers({ messageId, emoji });
    setLoadingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .in("user_id", r.userIds);
    setReactionUsers((data ?? []).map(p => p.full_name));
    setLoadingUsers(false);
  }

  async function deleteMessage(id: string) {
    if (!confirm("Deseja excluir este aviso?")) return;
    await supabase.from("messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  if (loading) {
    return (
      <div className="px-5 space-y-2">
        {[1, 2].map(i => <div key={i} className="bg-muted rounded-2xl h-20 animate-pulse" />)}
      </div>
    );
  }

  if (messages.length === 0) return null;

  return (
    <div className="px-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="font-montserrat font-bold text-foreground text-sm">Avisos</span>
      </div>
      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">✝️</span>
                <div>
                  <p className="font-montserrat font-bold text-card-foreground text-sm">{msg.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-muted-foreground text-xs font-inter">{timeAgo(msg.created_at)}</p>
                    {msg.turma_id && turmaNames[msg.turma_id] && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[9px] font-inter font-semibold leading-none">
                        🎓 {turmaNames[msg.turma_id]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {canDelete && (
                <button onClick={() => deleteMessage(msg.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-card-foreground text-sm font-inter leading-relaxed">{msg.body}</p>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {REACTION_EMOJIS.map(({ emoji, label }) => {
                const r = reactions[msg.id]?.[emoji];
                const active = r?.hasReacted;
                const count = r?.count ?? 0;
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    onContextMenu={(e) => { e.preventDefault(); showReactionUsers(msg.id, emoji); }}
                    onDoubleClick={() => showReactionUsers(msg.id, emoji)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-inter transition-all ${
                      active
                        ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                        : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
                    }`}
                    title={label}
                  >
                    <span className="text-sm">{emoji}</span>
                    {count > 0 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); showReactionUsers(msg.id, emoji); }}
                        className="cursor-pointer hover:underline"
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Reaction users modal */}
      {showUsers && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowUsers(null)}>
          <div
            className="bg-card rounded-t-2xl w-full max-w-md p-5 pb-8 shadow-xl animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {REACTION_EMOJIS.find(e => e.emoji === showUsers.emoji)?.emoji}
                </span>
                <span className="font-montserrat font-bold text-foreground text-sm">
                  {REACTION_EMOJIS.find(e => e.emoji === showUsers.emoji)?.label}
                </span>
              </div>
              <button onClick={() => setShowUsers(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {loadingUsers ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-8 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : reactionUsers.length === 0 ? (
              <p className="text-muted-foreground font-inter text-sm">Nenhuma reação encontrada.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {reactionUsers.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-xl bg-muted/50">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-inter text-sm text-foreground">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
