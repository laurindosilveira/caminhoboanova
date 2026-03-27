import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Users, Trophy, FileText, MessageSquare, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ChallengeParticipantsPanel from "./ChallengeParticipantsPanel";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  start_date: string;
  end_date: string;
  area: string | null;
  community: string | null;
  participant_count: number;
  completed_count: number;
  requires_text: boolean;
  requires_file: boolean;
};

const EMOJI_OPTIONS = ["📖", "🙏", "🤝", "💪", "🎯", "❤️", "🌟", "⛪", "🕊️", "🔥"];

export default function ChallengesTab() {
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", emoji: "📖", start_date: "", end_date: "",
    requires_text: false, requires_file: false,
  });

  useEffect(() => { fetchChallenges(); }, []);

  async function fetchChallenges() {
    setLoading(true);
    const { data: challengesData } = await supabase
      .from("community_challenges")
      .select("*")
      .order("start_date", { ascending: false });

    if (!challengesData) { setChallenges([]); setLoading(false); return; }

    // Get participant counts
    const ids = challengesData.map(c => c.id);
    const { data: participantsData } = await supabase
      .from("challenge_participants")
      .select("challenge_id, completed")
      .in("challenge_id", ids);

    const enriched = challengesData.map(c => {
      const parts = (participantsData ?? []).filter(p => p.challenge_id === c.id);
      return {
        ...c,
        participant_count: parts.length,
        completed_count: parts.filter(p => p.completed).length,
      };
    });

    setChallenges(enriched);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title || !form.start_date || !form.end_date) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("community_challenges").insert({
      title: form.title,
      description: form.description || null,
      emoji: form.emoji,
      start_date: form.start_date,
      end_date: form.end_date,
      area: profile?.area ?? null,
      created_by: user?.id,
      requires_text: form.requires_text,
      requires_file: form.requires_file,
    });
    setForm({ title: "", description: "", emoji: "📖", start_date: "", end_date: "", requires_text: false, requires_file: false });
    setShowForm(false);
    setSaving(false);
    fetchChallenges();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este desafio?")) return;
    await supabase.from("community_challenges").delete().eq("id", id);
    fetchChallenges();
  }

  const now = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-montserrat font-bold text-foreground text-base">🎯 Desafios Comunitários</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-medium text-primary-foreground"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo desafio
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm">Novo desafio</p>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Título do desafio *"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div>
            <p className="font-inter text-xs text-muted-foreground mb-1.5">Emoji</p>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                    form.emoji === e ? "bg-primary/15 ring-2 ring-primary" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-inter text-xs text-muted-foreground">Início *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-inter text-xs text-muted-foreground">Fim *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
          </div>
          <div className="space-y-2">
            <p className="font-inter text-xs text-muted-foreground">Requisitos para conclusão</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requires_text}
                onChange={e => setForm(f => ({ ...f, requires_text: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-inter text-sm text-foreground">Pedir resposta em texto</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requires_file}
                onChange={e => setForm(f => ({ ...f, requires_file: e.target.checked }))}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="font-inter text-sm text-foreground">Pedir envio de foto/arquivo</span>
            </label>
          </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.title || !form.start_date || !form.end_date}
              className="flex-1 py-2.5 rounded-xl text-sm font-inter font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}
            >
              {saving ? "Salvando..." : "Criar desafio"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground">Nenhum desafio criado</p>
          <p className="text-muted-foreground font-inter text-sm mt-1">Crie desafios para engajar sua turma!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map(c => {
            const isActive = c.start_date <= now && c.end_date >= now;
            const isPast = c.end_date < now;
            return (
              <div key={c.id} className={`bg-card rounded-2xl border p-4 shadow-sm ${
                isActive ? "border-brand-green/30" : "border-border"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isActive ? "bg-brand-green/10" : "bg-muted"
                  }`}>
                    <span className="text-xl">{c.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-montserrat font-bold text-foreground text-sm">{c.title}</h3>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-inter font-semibold ${
                        isActive ? "bg-brand-green/15 text-brand-green" : isPast ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      }`}>
                        {isActive ? "Ativo" : isPast ? "Encerrado" : "Agendado"}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-muted-foreground font-inter text-xs mt-0.5 line-clamp-2">{c.description}</p>
                    )}
                    <p className="text-muted-foreground font-inter text-[10px] mt-1">
                      {format(new Date(c.start_date + "T12:00:00"), "d MMM", { locale: ptBR })} — {format(new Date(c.end_date + "T12:00:00"), "d MMM yyyy", { locale: ptBR })}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs font-inter text-muted-foreground">
                        <Users className="w-3 h-3" /> {c.participant_count} participante{c.participant_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-inter text-brand-green">
                        <Trophy className="w-3 h-3" /> {c.completed_count} concluíra{c.completed_count !== 1 ? "m" : ""}
                      </span>
                      {c.requires_text && (
                        <span className="flex items-center gap-1 text-[10px] font-inter text-primary">
                          <MessageSquare className="w-2.5 h-2.5" /> Texto
                        </span>
                      )}
                      {c.requires_file && (
                        <span className="flex items-center gap-1 text-[10px] font-inter text-primary">
                          <FileText className="w-2.5 h-2.5" /> Arquivo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setExpandedChallenge(expandedChallenge === c.id ? null : c.id)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        expandedChallenge === c.id ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                      title="Ver participantes"
                    >
                      {expandedChallenge === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>

                {expandedChallenge === c.id && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ChallengeParticipantsPanel
                      challengeId={c.id}
                      requiresText={c.requires_text}
                      requiresFile={c.requires_file}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
