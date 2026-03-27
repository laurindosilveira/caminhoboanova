import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, GraduationCap, Cake, Sparkles, Send, Trash2, Target, Check, Users, ClipboardList, Upload, Image, Camera } from "lucide-react";
import ClassroomTab from "./ClassroomTab";
import AnnouncementsSection from "./AnnouncementsSection";
import LeaderRoomSection from "./LeaderRoomSection";
import PollsSection from "./PollsSection";
import CommunityAchievements from "./CommunityAchievements";
import PrayerPairsSection from "./PrayerPairsSection";
import EventPhotoGallery from "./EventPhotoGallery";

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
}

type ReactionMap = Record<string, Record<string, { count: number; hasReacted: boolean }>>;
// { messageId: { emoji: { count, hasReacted } } }

interface Testimony {
  id: string;
  user_name: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  has_joined: boolean;
  has_completed: boolean;
  requires_text: boolean;
  requires_file: boolean;
  response_text: string | null;
  file_url: string | null;
}

interface BirthdayPerson {
  full_name: string;
  birth_date: string;
  day: number;
}

type SubTab = "comunidade" | "sala" | "discipulador" | "galeria";

export default function CommunityTab() {
  const { profile, role } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("comunidade");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [newTestimony, setNewTestimony] = useState("");
  const [submittingTestimony, setSubmittingTestimony] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [challengeResponses, setChallengeResponses] = useState<Record<string, string>>({});
  const [challengeFiles, setChallengeFiles] = useState<Record<string, File | null>>({});
  const [completingChallenge, setCompletingChallenge] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!profile) return;

    async function fetchMessages() {
      setLoadingMessages(true);
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data }, { data: reactionsData }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, title, body, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("message_reactions").select("message_id, emoji, user_id"),
      ]);
      setMessages(data ?? []);
      // Build reactions map
      const rMap: ReactionMap = {};
      (reactionsData ?? []).forEach((r: any) => {
        if (!rMap[r.message_id]) rMap[r.message_id] = {};
        if (!rMap[r.message_id][r.emoji]) rMap[r.message_id][r.emoji] = { count: 0, hasReacted: false };
        rMap[r.message_id][r.emoji].count++;
        if (user && r.user_id === user.id) rMap[r.message_id][r.emoji].hasReacted = true;
      });
      setReactions(rMap);
      setLoadingMessages(false);
    }


    async function fetchBirthdays() {
      const currentMonth = new Date().getMonth() + 1;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birth_date")
        .eq("community", profile.community as any);
      const bdays: BirthdayPerson[] = (data ?? [])
        .filter(p => {
          const month = new Date(p.birth_date + "T00:00:00").getMonth() + 1;
          return month === currentMonth;
        })
        .map(p => ({
          full_name: p.full_name,
          birth_date: p.birth_date,
          day: new Date(p.birth_date + "T00:00:00").getDate(),
        }))
        .sort((a, b) => a.day - b.day);
      setBirthdays(bdays);
    }

    async function fetchTestimonies() {
      const { data } = await supabase
        .from("testimonies")
        .select("id, user_name, user_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      setTestimonies((data ?? []) as Testimony[]);
    }

    async function fetchChallenges() {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];
      const { data: challengesData } = await supabase
        .from("community_challenges")
        .select("*")
        .lte("start_date", today)
        .gte("end_date", today);
      const cIds = (challengesData ?? []).map((c: any) => c.id);
      let participantsData: any[] = [];
      if (cIds.length > 0) {
        const { data } = await supabase.from("challenge_participants").select("challenge_id, user_id, completed, response_text, file_url").in("challenge_id", cIds);
        participantsData = data ?? [];
      }
      const mapped: Challenge[] = (challengesData ?? []).map((c: any) => {
        const parts = participantsData.filter((p: any) => p.challenge_id === c.id);
        const myPart = user ? parts.find((p: any) => p.user_id === user.id) : null;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          emoji: c.emoji,
          start_date: c.start_date,
          end_date: c.end_date,
          participant_count: parts.length,
          has_joined: !!myPart,
          has_completed: myPart?.completed ?? false,
          requires_text: c.requires_text ?? false,
          requires_file: c.requires_file ?? false,
          response_text: myPart?.response_text ?? null,
          file_url: myPart?.file_url ?? null,
        };
      });
      setChallenges(mapped);
    }

    fetchMessages();
    fetchBirthdays();
    fetchTestimonies();
    fetchChallenges();
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
          copy[messageId][emoji] = { count: copy[messageId][emoji].count - 1, hasReacted: false };
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
        const old = copy[messageId][emoji] ?? { count: 0, hasReacted: false };
        copy[messageId][emoji] = { count: old.count + 1, hasReacted: true };
        return copy;
      });
    }
  }

  async function submitTestimony() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile || !newTestimony.trim()) return;
    setSubmittingTestimony(true);
    const { data, error } = await supabase.from("testimonies").insert({
      user_id: user.id,
      user_name: profile.full_name,
      community: profile.community,
      content: newTestimony.trim(),
    }).select().single();
    if (data && !error) {
      setTestimonies(prev => [data as Testimony, ...prev]);
      setNewTestimony("");
    }
    setSubmittingTestimony(false);
  }

  async function deleteTestimony(id: string) {
    await supabase.from("testimonies").delete().eq("id", id);
    setTestimonies(prev => prev.filter(t => t.id !== id));
  }

  async function joinChallenge(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("challenge_participants").insert({ challenge_id: challengeId, user_id: user.id });
    setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, has_joined: true, participant_count: c.participant_count + 1 } : c));
  }

  async function completeChallenge(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ch = challenges.find(c => c.id === challengeId);
    if (!ch) return;

    // Validate requirements
    if (ch.requires_text && !challengeResponses[challengeId]?.trim()) return;
    if (ch.requires_file && !challengeFiles[challengeId]) return;

    setCompletingChallenge(challengeId);

    let fileUrl: string | null = null;
    if (ch.requires_file && challengeFiles[challengeId]) {
      const file = challengeFiles[challengeId]!;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${challengeId}.${ext}`;
      const { error } = await supabase.storage.from("challenge-files").upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("challenge-files").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }
    }

    await supabase.from("challenge_participants").update({
      completed: true,
      completed_at: new Date().toISOString(),
      response_text: challengeResponses[challengeId]?.trim() || null,
      file_url: fileUrl,
    }).eq("challenge_id", challengeId).eq("user_id", user.id);

    setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, has_completed: true, response_text: challengeResponses[challengeId] || null, file_url: fileUrl } : c));
    setCompletingChallenge(null);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff / 60000);
    if (d > 0) return `${d}d atrás`;
    if (h > 0) return `${h}h atrás`;
    return `${m}min atrás`;
  }

  return (
    <div className="pt-5 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <h2 className="font-montserrat font-black text-foreground text-xl">👥 Comunidade</h2>
        {profile?.community && (
          <span className="text-xs font-inter text-muted-foreground bg-muted rounded-full px-3 py-1">
            {profile.community}
          </span>
        )}
      </div>

      {/* Sub-nav tabs */}
      <div className="px-5">
        <div className="flex bg-muted rounded-2xl p-1 gap-1">
          <button
            onClick={() => setSubTab("comunidade")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
              subTab === "comunidade"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Comunidade
          </button>
          <button
            onClick={() => setSubTab("sala")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
              subTab === "sala"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Sala da Turma
          </button>
          <button
            onClick={() => setSubTab("galeria")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
              subTab === "galeria"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Galeria
          </button>
          {(role === "admin" || role === "lider") && (
            <button
              onClick={() => setSubTab("discipulador")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
                subTab === "discipulador"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Discipulador
            </button>
          )}
        </div>
      </div>

      {/* ===== DISCIPULADOR (admin/lider) ===== */}
      {subTab === "discipulador" && (role === "admin" || role === "lider") && (
        <LeaderRoomSection asTab />
      )}

      {/* ===== GALERIA ===== */}
      {subTab === "galeria" && (
        <div className="px-5">
          <EventPhotoGallery />
        </div>
      )}

      {/* ===== SALA DA TURMA ===== */}
      {subTab === "sala" && <ClassroomTab />}

      {/* ===== COMUNIDADE ===== */}
      {subTab === "comunidade" && (
        <div className="px-5 space-y-5">
          {/* Pastor messages */}
          <AnnouncementsSection />

          {/* 🏆 Conquistas da Comunidade */}
          <CommunityAchievements />


          {challenges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-montserrat font-bold text-foreground text-sm">🎯 Desafios da Semana</span>
              </div>
              <div className="space-y-2.5">
                {challenges.map(ch => {
                  const endDate = new Date(ch.end_date + "T23:59:59");
                  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000));
                  return (
                    <div key={ch.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{ch.emoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-montserrat font-bold text-foreground text-sm">{ch.title}</h4>
                          {ch.description && (
                            <p className="text-muted-foreground font-inter text-xs mt-0.5 leading-relaxed">{ch.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-inter">
                              <Users className="w-3 h-3" />{ch.participant_count} participando
                            </span>
                            <span className="text-[10px] font-inter text-muted-foreground">
                              ⏳ {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restante{daysLeft !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="mt-2.5 space-y-2">
                            {ch.has_completed ? (
                              <div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-green/10">
                                  <Check className="w-3.5 h-3.5 text-brand-green" />
                                  <span className="font-inter text-xs font-semibold text-brand-green">Desafio concluído ✓ (+15 pts)</span>
                                </div>
                                {ch.response_text && (
                                  <p className="text-muted-foreground font-inter text-xs mt-1.5 italic">"{ch.response_text}"</p>
                                )}
                                {ch.file_url && (
                                  <a href={ch.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary text-xs font-inter mt-1 hover:underline">
                                    <Image className="w-3 h-3" /> Ver arquivo enviado
                                  </a>
                                )}
                              </div>
                            ) : ch.has_joined ? (
                              <div className="space-y-2">
                                {ch.requires_text && (
                                  <textarea
                                    value={challengeResponses[ch.id] || ""}
                                    onChange={e => setChallengeResponses(prev => ({ ...prev, [ch.id]: e.target.value }))}
                                    placeholder="Escreva sua resposta..."
                                    className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    rows={2}
                                    maxLength={500}
                                  />
                                )}
                                {ch.requires_file && (
                                  <div>
                                    <input
                                      ref={el => { fileInputRefs.current[ch.id] = el; }}
                                      type="file"
                                      accept="image/*,.pdf,.doc,.docx"
                                      className="hidden"
                                      onChange={e => {
                                        const file = e.target.files?.[0] ?? null;
                                        setChallengeFiles(prev => ({ ...prev, [ch.id]: file }));
                                      }}
                                    />
                                    <button
                                      onClick={() => fileInputRefs.current[ch.id]?.click()}
                                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      <span className="font-inter text-xs">
                                        {challengeFiles[ch.id] ? challengeFiles[ch.id]!.name : "Enviar foto/arquivo"}
                                      </span>
                                    </button>
                                  </div>
                                )}
                                <button
                                  onClick={() => completeChallenge(ch.id)}
                                  disabled={
                                    completingChallenge === ch.id ||
                                    (ch.requires_text && !challengeResponses[ch.id]?.trim()) ||
                                    (ch.requires_file && !challengeFiles[ch.id])
                                  }
                                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span className="font-inter text-xs font-semibold">
                                    {completingChallenge === ch.id ? "Enviando..." : "Completei o desafio!"}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => joinChallenge(ch.id)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                <Target className="w-3.5 h-3.5" />
                                <span className="font-inter text-xs font-semibold">Participar (+15 pts)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📊 Enquetes */}
          <PollsSection />

          {/* 🙏 Dupla de Oração */}
          <PrayerPairsSection />


          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="font-montserrat font-bold text-foreground text-sm">✨ O que Deus fez esta semana</span>
            </div>

            {/* New testimony form */}
            <div className="bg-card rounded-2xl border border-border p-3 shadow-sm mb-3">
              <textarea
                value={newTestimony}
                onChange={e => setNewTestimony(e.target.value)}
                placeholder="Compartilhe o que Deus fez na sua vida esta semana..."
                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2}
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground font-inter">{newTestimony.length}/500</span>
                <button
                  onClick={submitTestimony}
                  disabled={!newTestimony.trim() || submittingTestimony}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-inter font-semibold disabled:opacity-50 transition-colors hover:bg-primary/90"
                >
                  <Send className="w-3.5 h-3.5" />
                  Compartilhar
                </button>
              </div>
            </div>

            {/* Testimonies list */}
            {testimonies.length > 0 && (
              <div className="space-y-2.5">
                {testimonies.map(t => (
                  <div key={t.id} className="bg-card rounded-2xl border border-border p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base">✨</span>
                        <div>
                          <p className="font-montserrat font-bold text-card-foreground text-xs">{t.user_name}</p>
                          <p className="text-muted-foreground text-[10px] font-inter">{timeAgo(t.created_at)}</p>
                        </div>
                      </div>
                      {(profile && (t.user_id === profile.user_id || role === "admin" || role === "lider")) && (
                        <button onClick={() => deleteTestimony(t.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-card-foreground text-sm font-inter leading-relaxed">{t.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aniversariantes do mês */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cake className="w-4 h-4 text-secondary" />
              <span className="font-montserrat font-bold text-foreground text-sm">
                🎂 Aniversariantes de {new Date().toLocaleString("pt-BR", { month: "long" })}
              </span>
            </div>
            {birthdays.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-4 text-center">
                <p className="text-muted-foreground text-sm font-inter">Nenhum aniversariante este mês.</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                {birthdays.map((b, i) => {
                  const isToday = b.day === new Date().getDate();
                  return (
                    <div
                      key={b.full_name + b.birth_date}
                      className={`flex items-center gap-3 px-4 py-3 ${i < birthdays.length - 1 ? "border-b border-border" : ""} ${isToday ? "bg-secondary/5" : ""}`}
                    >
                      <span className="text-lg">{isToday ? "🎉" : "🎂"}</span>
                      <span className="font-montserrat font-black text-card-foreground text-sm flex-shrink-0">
                        {String(b.day).padStart(2, '0')}/{String(new Date().getMonth() + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-montserrat text-card-foreground text-sm truncate">
                          {b.full_name}
                          {isToday && <span className="text-secondary text-xs font-inter ml-1">(hoje!)</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
