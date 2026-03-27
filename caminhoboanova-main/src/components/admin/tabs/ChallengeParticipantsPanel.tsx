import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, MessageSquare, FileText, ExternalLink, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Participant = {
  id: string;
  user_id: string;
  joined_at: string;
  completed: boolean;
  completed_at: string | null;
  response_text: string | null;
  file_url: string | null;
  full_name: string;
  community: string;
};

export default function ChallengeParticipantsPanel({ challengeId, requiresText, requiresFile }: {
  challengeId: string;
  requiresText: boolean;
  requiresFile: boolean;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchParticipants();
  }, [challengeId]);

  async function fetchParticipants() {
    setLoading(true);
    const { data } = await supabase
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", challengeId)
      .order("joined_at", { ascending: false });

    if (!data || data.length === 0) { setParticipants([]); setLoading(false); return; }

    const userIds = data.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, community")
      .in("user_id", userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    const enriched: Participant[] = data.map(p => {
      const prof = profileMap.get(p.user_id);
      return {
        ...p,
        full_name: prof?.full_name ?? "Desconhecido",
        community: prof?.community ?? "",
      };
    });

    setParticipants(enriched);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)}
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="text-center py-6">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="font-inter text-xs text-muted-foreground">Nenhum participante ainda</p>
      </div>
    );
  }

  const completed = participants.filter(p => p.completed);
  const pending = participants.filter(p => !p.completed);

  return (
    <div className="space-y-3 pt-2">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs font-inter">
        <span className="flex items-center gap-1 text-brand-green font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" /> {completed.length} concluíram
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> {pending.length} pendentes
        </span>
      </div>

      {/* Completed participants */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="font-inter text-[10px] font-bold text-brand-green uppercase tracking-wider">✅ Concluídos</p>
          {completed.map(p => (
            <div key={p.id} className="bg-muted/30 rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-brand-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-semibold text-foreground truncate">{p.full_name}</p>
                  <p className="font-inter text-[10px] text-muted-foreground">{p.community} · Concluiu em {p.completed_at ? format(new Date(p.completed_at), "d MMM HH:mm", { locale: ptBR }) : "—"}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {p.response_text && <MessageSquare className="w-3.5 h-3.5 text-primary" />}
                  {p.file_url && <FileText className="w-3.5 h-3.5 text-primary" />}
                  {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>

              {expandedId === p.id && (
                <div className="px-3 pb-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-border pt-2.5">
                  {p.response_text && (
                    <div>
                      <p className="font-inter text-[10px] font-bold text-foreground mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-primary" /> Resposta em texto
                      </p>
                      <div className="bg-background rounded-lg px-3 py-2 border border-border">
                        <p className="font-inter text-xs text-foreground leading-relaxed whitespace-pre-wrap">{p.response_text}</p>
                      </div>
                    </div>
                  )}
                  {p.file_url && (
                    <div>
                      <p className="font-inter text-[10px] font-bold text-foreground mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-primary" /> Arquivo enviado
                      </p>
                      <a
                        href={p.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border hover:bg-primary/5 transition-colors"
                      >
                        {isImageUrl(p.file_url) ? (
                          <img src={p.file_url} alt="Arquivo" className="w-16 h-16 rounded-lg object-cover border border-border" />
                        ) : (
                          <FileText className="w-8 h-8 text-primary" />
                        )}
                        <span className="font-inter text-xs text-primary font-medium flex items-center gap-1">
                          Abrir arquivo <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    </div>
                  )}
                  {!p.response_text && !p.file_url && (
                    <p className="font-inter text-xs text-muted-foreground italic">Concluiu sem envios adicionais.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending participants */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="font-inter text-[10px] font-bold text-muted-foreground uppercase tracking-wider">⏳ Pendentes</p>
          {pending.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/20 border border-border">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter text-sm text-foreground truncate">{p.full_name}</p>
                <p className="font-inter text-[10px] text-muted-foreground">{p.community} · Participou em {format(new Date(p.joined_at), "d MMM", { locale: ptBR })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
}
