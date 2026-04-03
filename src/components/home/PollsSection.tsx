import { useState, useEffect } from "react";
import { getAreaForCommunity } from "@/config/areas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { BarChart3, Plus, X, Check, Users, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Poll {
  id: string;
  question: string;
  options: string[];
  emoji: string;
  community: string;
  area: string | null;
  is_active: boolean;
  ends_at: string | null;
  created_at: string;
  created_by: string;
}

interface PollVote {
  poll_id: string;
  user_id: string;
  option_index: number;
}

function useCountdown(endsAt: string | null) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!endsAt) { setRemaining(""); return; }
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Encerrada"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setRemaining(`${d}d ${h}h`);
      else if (h > 0) setRemaining(`${h}h ${m}min`);
      else setRemaining(`${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return remaining;
}

function PollCountdown({ endsAt }: { endsAt: string | null }) {
  const remaining = useCountdown(endsAt);
  if (!remaining) return null;
  const isExpired = remaining === "Encerrada";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-inter font-semibold ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
      <Timer className="w-3 h-3" />
      {remaining}
    </span>
  );
}

export default function PollsSection() {
  const { profile, role, user } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState(["", "", ""]);
  const [creating, setCreating] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const currentArea = effectiveArea || profile?.area || "";

  const isManager = role === "admin" || role === "lider";

  useEffect(() => {
    if (profile && currentArea) fetchPolls();
  }, [profile, currentArea]);

  async function fetchPolls() {
    setLoading(true);
    const [{ data: pollsData }, { data: votesData }] = await Promise.all([
      supabase
        .from("polls")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("poll_votes").select("poll_id, user_id, option_index"),
    ]);
    const filteredPolls = ((pollsData as Poll[]) ?? []).filter((poll) => {
      if (poll.area) return poll.area === currentArea;
      return getAreaForCommunity(poll.community) === currentArea;
    });
    setPolls(filteredPolls);
    setVotes((votesData as PollVote[]) ?? []);
    setLoading(false);
  }

  async function createPoll() {
    if (!user || !profile) return;
    const validOptions = newOptions.filter(o => o.trim());
    if (!newQuestion.trim() || validOptions.length < 2) {
      toast({ title: "Erro", description: "Preencha a pergunta e pelo menos 2 opções.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("polls").insert({
      question: newQuestion.trim(),
      options: validOptions.map(o => o.trim()),
      created_by: user.id,
      community: profile.community,
      area: currentArea,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Enquete criada!" });
      setNewQuestion("");
      setNewOptions(["", "", ""]);
      setShowCreate(false);
      fetchPolls();
    }
    setCreating(false);
  }

  async function vote(pollId: string, optionIndex: number) {
    if (!user) return;
    const existing = votes.find(v => v.poll_id === pollId && v.user_id === user.id);
    if (existing) return;

    setVoting(pollId);
    const { error } = await supabase.from("poll_votes").insert({
      poll_id: pollId,
      user_id: user.id,
      option_index: optionIndex,
    } as any);
    if (!error) {
      setVotes(prev => [...prev, { poll_id: pollId, user_id: user.id, option_index: optionIndex }]);
    }
    setVoting(null);
  }

  async function closePoll(pollId: string) {
    await supabase.from("polls").update({ is_active: false } as any).eq("id", pollId);
    setPolls(prev => prev.filter(p => p.id !== pollId));
    toast({ title: "Enquete encerrada" });
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="bg-muted rounded-2xl h-28 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="font-montserrat font-bold text-foreground text-sm">📊 Enquetes</span>
        </div>
        {isManager && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 text-xs font-inter font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showCreate ? "Cancelar" : "Nova Enquete"}
          </button>
        )}
      </div>

      {/* Create poll form */}
      {showCreate && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm mb-3 space-y-3">
          <Input
            placeholder="Pergunta da enquete..."
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            maxLength={200}
            className="rounded-xl"
          />
          <div className="space-y-2">
            {newOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-inter w-5">{i + 1}.</span>
                <Input
                  placeholder={`Opção ${i + 1}`}
                  value={opt}
                  onChange={e => {
                    const copy = [...newOptions];
                    copy[i] = e.target.value;
                    setNewOptions(copy);
                  }}
                  maxLength={100}
                  className="rounded-xl text-sm"
                />
                {i >= 3 && (
                  <button onClick={() => setNewOptions(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {newOptions.length < 5 && (
              <button
                onClick={() => setNewOptions(prev => [...prev, ""])}
                className="text-xs text-primary font-inter font-semibold hover:underline"
              >
                + Adicionar opção
              </button>
            )}
          </div>
          <Button
            onClick={createPoll}
            disabled={creating || !newQuestion.trim() || newOptions.filter(o => o.trim()).length < 2}
            className="w-full rounded-xl"
            size="sm"
          >
            {creating ? "Criando..." : "Criar Enquete"}
          </Button>
        </div>
      )}

      {/* Polls list */}
      {polls.length === 0 && !showCreate ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm font-inter">Nenhuma enquete ativa no momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map(poll => {
            const pollVotes = votes.filter(v => v.poll_id === poll.id);
            const totalVotes = pollVotes.length;
            const myVote = user ? pollVotes.find(v => v.user_id === user.id) : null;
            const hasVoted = !!myVote;
            const isExpired = poll.ends_at && new Date(poll.ends_at).getTime() < Date.now();

            return (
              <div key={poll.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{poll.emoji}</span>
                    <div>
                      <h4 className="font-montserrat font-bold text-foreground text-sm leading-snug">{poll.question}</h4>
                      {poll.ends_at && (
                        <div className="mt-1">
                          <PollCountdown endsAt={poll.ends_at} />
                        </div>
                      )}
                    </div>
                  </div>
                  {isManager && poll.created_by === user?.id && (
                    <button onClick={() => closePoll(poll.id)} className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {poll.options.map((option, i) => {
                    const optionVotes = pollVotes.filter(v => v.option_index === i).length;
                    const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                    const isMyVote = myVote?.option_index === i;

                    return (
                      <button
                        key={i}
                        onClick={() => !hasVoted && !isExpired && vote(poll.id, i)}
                        disabled={hasVoted || voting === poll.id || !!isExpired}
                        className={`w-full relative overflow-hidden rounded-xl border transition-all text-left ${
                          isMyVote
                            ? "border-primary bg-primary/5"
                            : hasVoted
                            ? "border-border bg-muted/20"
                            : "border-border hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        {/* Progress bar background */}
                        {hasVoted && (
                          <div
                            className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        )}
                        <div className="relative flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {isMyVote && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                            <span className={`font-inter text-sm ${isMyVote ? "font-semibold text-primary" : "text-foreground"}`}>
                              {option}
                            </span>
                          </div>
                          {hasVoted && (
                            <span className="text-xs font-inter font-semibold text-muted-foreground flex-shrink-0 ml-2">
                              {percentage}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 mt-2.5 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span className="text-[10px] font-inter">{totalVotes} voto{totalVotes !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
