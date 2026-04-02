import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Trash2, ChevronRight, ChevronDown, ChevronUp, BookOpen, Calendar, Church, Trophy, Star, AlertTriangle, Gift, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  userId: string;
  fullName: string;
  onClose: () => void;
  onPointsChanged?: () => void;
}

interface ActivityItem {
  id: string;
  type: "lesson" | "devotional" | "attendance" | "worship" | "achievement" | "activity";
  title: string;
  subtitle?: string;
  points: number;
  date: string;
  deletable: boolean;
  tableId?: string;
}

type LessonExpandedContent = {
  icebreaker?: string;
  practice?: string;
  prayer_prompt?: string;
  questions?: string[];
  answers: Array<{ question_key: string; response: string }>;
};

type DevotionalExpandedContent = {
  title?: string;
  bible_reference?: string;
  bible_text?: string;
  reflection?: string;
  practice?: string;
  prayer?: string;
  questions?: string[];
  answers?: Array<{ question_index: number; response: string }>;
};

const ACHIEVEMENT_LABELS: Record<string, { title: string; icon: string }> = {
  streak_7:        { icon: "🔥", title: "7 dias seguidos" },
  first_activity:  { icon: "📖", title: "Primeiros passos" },
  activities_5:    { icon: "🎓", title: "5 atividades" },
  points_100:      { icon: "⭐", title: "100 pontos da fé" },
  activities_10:   { icon: "🏆", title: "10 atividades" },
  points_200:      { icon: "💎", title: "200 pontos" },
  dev_10:          { icon: "❤️", title: "Oração contínua" },
  attendance_5:    { icon: "🤝", title: "Serviço fiel" },
  dev_20:          { icon: "📖", title: "Leitura bíblica" },
  worship_5:       { icon: "⛪", title: "Adorador" },
  attendance_3:    { icon: "👥", title: "Participou do encontro" },
  chat_5:          { icon: "🎤", title: "Compartilhou testemunho" },
  prayer_3:        { icon: "🙏", title: "Intercessor" },
  chat_20:         { icon: "💬", title: "Voz ativa" },
  biweekly_streak: { icon: "🏅", title: "Quinzena perfeita" },
  streak_14:       { icon: "🛡️", title: "Guardião da Fé" },
  streak_30:       { icon: "👁️", title: "Constância Invisível" },
  apto:            { icon: "✝️", title: "Pronto para a Profissão de Fé" },
};

type DetailModalState =
  | { itemId: string; type: "lesson"; title: string; content: LessonExpandedContent | null }
  | { itemId: string; type: "devotional"; title: string; content: DevotionalExpandedContent | null };

export default function PlayerDetailSheet({ userId, fullName, onClose, onPointsChanged }: Props) {
  const { role } = useAuth();
  const canDelete = role === "admin" || role === "lider";
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gaps, setGaps] = useState<{ missingLessons: { id: string; title: string }[]; missingDevotionals: { id: string; title: string; day_number: number | null }[] } | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusJustification, setBonusJustification] = useState("");
  const [grantingBonus, setGrantingBonus] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [userId]);

  async function fetchActivities() {
    setLoading(true);
    const [
      { data: lessonResps },
      { data: devProgress },
      { data: attendance },
      { data: worship },
      { data: achievements },
      { data: userProgress },
      { data: lessons },
      { data: devContent },
      { data: events },
      { data: activities },
      { data: gameConfig },
    ] = await Promise.all([
      supabase.from("lesson_responses").select("id, lesson_id, question_key, response, created_at").eq("user_id", userId),
      supabase.from("devotional_progress").select("id, devotional_id, completed_at").eq("user_id", userId),
      supabase.from("attendance").select("id, event_id, status, created_at").eq("user_id", userId).eq("status", "presente"),
      supabase.from("worship_attendance").select("id, worship_date, preacher_name, worship_time, status, created_at").eq("user_id", userId).eq("status", "aprovado"),
      supabase.from("achievement_unlocks").select("id, achievement_key, bonus_points, unlocked_at").eq("user_id", userId),
      supabase.from("user_progress").select("id, activity_id, completed_at").eq("user_id", userId),
      supabase.from("lessons").select("id, title, course_id"),
      supabase.from("devotional_content").select("id, title, day_number, lesson_id"),
      supabase.from("events").select("id, title, event_date"),
      supabase.from("activities").select("id, title, points, type"),
      supabase.rpc("get_game_config" as any),
    ]);

    // Carrega pontuações dinâmicas do game_config
    const cfgMap = new Map<string, number>((gameConfig ?? []).map((r: any) => [r.key, Number(r.value)]));
    const lessonPts    = cfgMap.get("lesson_points")             ?? 20;
    const devPts       = cfgMap.get("devotional_points")         ?? 5;
    const devWkPts     = cfgMap.get("devotional_weekend_points") ?? 2;
    const attPts       = cfgMap.get("attendance_points")         ?? 10;
    const worshipPts   = cfgMap.get("worship_points")            ?? 5;

    const lessonMap = new Map((lessons ?? []).map((lesson) => [lesson.id, lesson]));
    const devotionalMap = new Map((devContent ?? []).map((devotional) => [devotional.id, devotional]));
    const eventMap = new Map((events ?? []).map((event) => [event.id, event]));
    const activityMap = new Map((activities ?? []).map((activity) => [activity.id, activity]));

    const allItems: ActivityItem[] = [];

    const lessonIds = new Set((lessonResps ?? []).map((response) => response.lesson_id));
    lessonIds.forEach((lessonId) => {
      const lesson = lessonMap.get(lessonId);
      const firstResp = (lessonResps ?? []).find((response) => response.lesson_id === lessonId);
      allItems.push({
        id: `lesson-${lessonId}`,
        type: "lesson",
        title: lesson?.title ?? "Lição",
        subtitle: "Estudo de lição",
        points: lessonPts,
        date: firstResp?.created_at ?? "",
        deletable: true,
        tableId: lessonId,
      });
    });

    (devProgress ?? []).forEach((progress) => {
      const devotional = devotionalMap.get(progress.devotional_id);
      const dayOfWeek = new Date(progress.completed_at).getDay();
      const points = dayOfWeek === 0 || dayOfWeek === 6 ? devWkPts : devPts;
      allItems.push({
        id: `dev-${progress.id}`,
        type: "devotional",
        title: devotional?.title || `Devocional dia ${devotional?.day_number ?? "?"}`,
        subtitle: dayOfWeek === 0 || dayOfWeek === 6 ? "Recuperado no fim de semana" : "Devocional diário",
        points,
        date: progress.completed_at,
        deletable: true,
        tableId: progress.id,
      });
    });

    (attendance ?? []).forEach((presence) => {
      const event = eventMap.get(presence.event_id);
      allItems.push({
        id: `att-${presence.id}`,
        type: "attendance",
        title: event?.title ?? "Encontro",
        subtitle: event?.event_date ? format(new Date(event.event_date), "d 'de' MMM", { locale: ptBR }) : "",
        points: attPts,
        date: presence.created_at,
        deletable: true,
        tableId: presence.id,
      });
    });

    (worship ?? []).forEach((service) => {
      allItems.push({
        id: `wor-${service.id}`,
        type: "worship",
        title: `Culto - ${service.preacher_name}`,
        subtitle: `${format(new Date(service.worship_date), "d/MM/yyyy")} às ${service.worship_time}`,
        points: worshipPts,
        date: service.created_at,
        deletable: true,
        tableId: service.id,
      });
    });

    (achievements ?? []).forEach((achievement) => {
      const isManualBonus = achievement.achievement_key.startsWith("bonus_lider|");
      const label = ACHIEVEMENT_LABELS[achievement.achievement_key];
      allItems.push({
        id: `ach-${achievement.id}`,
        type: "achievement",
        title: isManualBonus
          ? "🌟 Bônus do Líder"
          : label ? `${label.icon} ${label.title}` : `🏆 ${achievement.achievement_key}`,
        subtitle: isManualBonus
          ? achievement.achievement_key.slice("bonus_lider|".length)
          : "Bônus de conquista",
        points: achievement.bonus_points,
        date: achievement.unlocked_at,
        deletable: true,
        tableId: achievement.id,
      });
    });

    (userProgress ?? []).forEach((progress) => {
      const activity = activityMap.get(progress.activity_id);
      if (activity && activity.type !== "devocional" && activity.type !== "formacao" && activity.type !== "encontro") {
        allItems.push({
          id: `act-${progress.id}`,
          type: "activity",
          title: activity.title,
          subtitle: "Atividade extra",
          points: activity.points ?? 0,
          date: progress.completed_at,
          deletable: true,
          tableId: progress.id,
        });
      }
    });

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(allItems);
    setTotalPoints(allItems.reduce((sum, item) => sum + item.points, 0));

    // Compute gaps
    const completedDevIds = new Set((devProgress ?? []).map((p) => p.devotional_id));
    const missingLessons = (lessons ?? []).filter((l) => !lessonIds.has(l.id));
    const missingDevotionals = (devContent ?? []).filter((d) => !completedDevIds.has(d.id));
    setGaps({ missingLessons, missingDevotionals });

    setLoading(false);
  }

  function formatLessonQuestionLabel(
    key: string,
    lessonContent?: { icebreaker?: string; practice?: string; prayer_prompt?: string; questions?: string[] } | null
  ) {
    if (key === "icebreaker") return lessonContent?.icebreaker || "Quebra-gelo";
    if (key === "practice") return lessonContent?.practice || "Prática da semana";
    if (key === "prayer") return lessonContent?.prayer_prompt || "Oração final";
    if (/^q\d+$/.test(key)) {
      const index = Number(key.slice(1));
      return lessonContent?.questions?.[index] || `Pergunta ${index + 1}`;
    }
    return key;
  }

  async function handleOpenDetails(item: ActivityItem) {
    if ((item.type !== "lesson" && item.type !== "devotional") || !item.tableId) return;

    setLoadingDetail(true);

    if (item.type === "lesson") {
      const [{ data: lessonContent }, { data: responses }] = await Promise.all([
        supabase
          .from("lesson_content")
          .select("icebreaker, practice, prayer_prompt, questions")
          .eq("lesson_id", item.tableId)
          .maybeSingle(),
        supabase
          .from("lesson_responses")
          .select("question_key, response")
          .eq("user_id", userId)
          .eq("lesson_id", item.tableId),
      ]);

      const orderedAnswers = (responses ?? []).sort((a, b) => {
        const weight = (questionKey: string) => {
          if (questionKey === "icebreaker") return 0;
          if (/^q\d+$/.test(questionKey)) return 1 + Number(questionKey.slice(1));
          if (questionKey === "practice") return 1000;
          if (questionKey === "prayer") return 1001;
          return 2000;
        };
        return weight(a.question_key) - weight(b.question_key);
      });

      setDetailModal({
        itemId: item.id,
        type: "lesson",
        title: item.title,
        content: {
          ...(lessonContent ?? {}),
          answers: orderedAnswers,
        },
      });
    } else {
      const { data: progress } = await supabase
        .from("devotional_progress")
        .select("devotional_id")
        .eq("id", item.tableId)
        .single();

      if (!progress?.devotional_id) {
        setDetailModal({
          itemId: item.id,
          type: "devotional",
          title: item.title,
          content: null,
        });
      } else {
        const [{ data: devotional }, { data: responses }] = await Promise.all([
          supabase
            .from("devotional_content")
            .select("title, bible_reference, bible_text, reflection, practice, prayer, questions")
            .eq("id", progress.devotional_id)
            .single(),
          supabase
            .from("devotional_responses")
            .select("question_index, response")
            .eq("user_id", userId)
            .eq("devotional_id", progress.devotional_id)
            .order("question_index"),
        ]);

        setDetailModal({
          itemId: item.id,
          type: "devotional",
          title: item.title,
          content: {
            ...(devotional as DevotionalExpandedContent),
            answers: responses ?? [],
          },
        });
      }
    }

    setLoadingDetail(false);
  }

  async function handleGrantBonus() {
    const pts = parseInt(bonusPoints, 10);
    if (!pts || pts <= 0) { toast.error("Informe uma quantidade de pontos válida."); return; }
    if (pts > 500) { toast.error("O bônus não pode ultrapassar 500 pontos por vez."); return; }
    if (!bonusJustification.trim()) { toast.error("Informe a justificativa para o bônus."); return; }
    if (pts > 100 && !confirm(`Confirma conceder ${pts} pontos para ${fullName}?\n\nJustificativa: ${bonusJustification.trim()}`)) return;

    setGrantingBonus(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const key = `bonus_lider|${bonusJustification.trim()}`;
      const { data, error } = await supabase.from("achievement_unlocks").insert({
        user_id: userId,
        achievement_key: key,
        bonus_points: pts,
      }).select("id, unlocked_at").single();

      if (error) throw error;

      await supabase.from("bonus_grant_log").insert({
        granted_by: user?.id ?? "",
        target_user_id: userId,
        achievement_id: data.id,
        justification: bonusJustification.trim(),
        points_granted: pts,
      });

      setItems(prev => [{
        id: `ach-${data.id}`,
        type: "achievement",
        title: "🌟 Bônus do Líder",
        subtitle: bonusJustification.trim(),
        points: pts,
        date: data.unlocked_at,
        deletable: true,
        tableId: data.id,
      }, ...prev]);
      setTotalPoints(prev => prev + pts);
      setBonusPoints("");
      setBonusJustification("");
      setShowBonusForm(false);
      toast.success(`+${pts} pontos concedidos a ${fullName}`);
      onPointsChanged?.();
    } catch (err: any) {
      toast.error("Erro ao conceder bônus: " + (err.message ?? ""));
    }
    setGrantingBonus(false);
  }

  async function handleDelete(item: ActivityItem) {
    if (!confirm(`Remover "${item.title}" e descontar ${item.points} pontos?`)) return;
    setDeleting(item.id);

    const { data: { user } } = await supabase.auth.getUser();

    try {
      if (item.type === "lesson" && item.tableId) {
        await supabase.from("lesson_responses").delete().eq("user_id", userId).eq("lesson_id", item.tableId);
      } else if (item.type === "devotional" && item.tableId) {
        await supabase.from("devotional_progress").delete().eq("id", item.tableId);
      } else if (item.type === "attendance" && item.tableId) {
        await supabase.from("attendance").delete().eq("id", item.tableId);
      } else if (item.type === "worship" && item.tableId) {
        await supabase.from("worship_attendance").delete().eq("id", item.tableId);
      } else if (item.type === "achievement" && item.tableId) {
        await supabase.from("achievement_unlocks").delete().eq("id", item.tableId);
      } else if (item.type === "activity" && item.tableId) {
        await supabase.from("user_progress").delete().eq("id", item.tableId);
      }

      await supabase.from("activity_removal_log").insert({
        removed_by: user?.id ?? "",
        target_user_id: userId,
        activity_type: item.type,
        activity_id: item.tableId ?? item.id,
        activity_title: item.title,
        points_removed: item.points,
        notes: "Removido via relatório de pontuação",
      });

      setItems((prev) => prev.filter((current) => current.id !== item.id));
      setTotalPoints((prev) => prev - item.points);
      toast.success(`Removido: ${item.title} (-${item.points} pts)`);
      onPointsChanged?.();
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err.message ?? ""));
    }

    setDeleting(null);
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "lesson": return <BookOpen className="w-4 h-4 text-primary" />;
      case "devotional": return <BookOpen className="w-4 h-4 text-secondary" />;
      case "attendance": return <Calendar className="w-4 h-4 text-brand-green" />;
      case "worship": return <Church className="w-4 h-4 text-accent" />;
      case "achievement": return <Trophy className="w-4 h-4 text-amber-500" />;
      default: return <Star className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "lesson": return "Lição";
      case "devotional": return "Devocional";
      case "attendance": return "Presença";
      case "worship": return "Culto";
      case "achievement": return "Conquista";
      default: return "Atividade";
    }
  };

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = { count: 0, points: 0 };
    acc[item.type].count++;
    acc[item.type].points += item.points;
    return acc;
  }, {} as Record<string, { count: number; points: number }>);

  const selectedDetailItem = detailModal ? items.find((item) => item.id === detailModal.itemId) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <p className="font-montserrat font-bold text-foreground text-base">{fullName}</p>
            <p className="text-muted-foreground font-inter text-xs">{totalPoints} pontos · {items.length} atividades</p>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={() => setShowBonusForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-inter text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Bônus
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showBonusForm && canDelete && (
          <div className="p-4 border-b border-border bg-primary/5 flex-shrink-0 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="font-montserrat font-bold text-foreground text-sm">Conceder pontos extras</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="500"
                placeholder="Pts"
                value={bonusPoints}
                onChange={e => setBonusPoints(e.target.value)}
                className="w-20 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Justificativa..."
                value={bonusJustification}
                onChange={e => setBonusJustification(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleGrantBonus}
                disabled={grantingBonus}
                className="flex-1 py-2 rounded-xl text-sm font-inter font-semibold text-primary-foreground disabled:opacity-50 transition-opacity"
                style={{ background: "var(--gradient-hero)" }}
              >
                {grantingBonus ? "Concedendo..." : "Confirmar bônus"}
              </button>
              <button
                onClick={() => { setShowBonusForm(false); setBonusPoints(""); setBonusJustification(""); }}
                className="px-4 py-2 rounded-xl bg-muted text-foreground font-inter text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-border flex-shrink-0">
          <p className="font-montserrat font-bold text-foreground text-xs mb-2">Resumo</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(grouped).map(([type, { count, points }]) => (
              <div key={type} className="bg-muted/50 rounded-xl p-2 text-center">
                <div className="flex items-center justify-center mb-1">{typeIcon(type)}</div>
                <p className="font-montserrat font-bold text-foreground text-xs">{count}</p>
                <p className="text-muted-foreground text-[10px] font-inter">{typeLabel(type)}</p>
                <p className="text-primary text-[10px] font-montserrat font-bold">+{points}</p>
              </div>
            ))}
          </div>
        </div>

        {!loading && gaps && (gaps.missingLessons.length > 0 || gaps.missingDevotionals.length > 0) && (
          <div className="border-b border-border flex-shrink-0">
            <button
              onClick={() => setShowGaps((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="font-montserrat font-bold text-amber-600 dark:text-amber-400 text-xs">
                  Lacunas
                </span>
                <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 font-montserrat font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                  {gaps.missingLessons.length + gaps.missingDevotionals.length}
                </span>
              </div>
              {showGaps ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showGaps && (
              <div className="px-4 pb-3 space-y-3">
                {gaps.missingLessons.length > 0 && (
                  <div>
                    <p className="font-inter font-semibold text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                      Lições não estudadas ({gaps.missingLessons.length})
                    </p>
                    <div className="space-y-1">
                      {gaps.missingLessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/15">
                          <BookOpen className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="font-inter text-xs text-foreground truncate">{lesson.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {gaps.missingDevotionals.length > 0 && (
                  <div>
                    <p className="font-inter font-semibold text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                      Devocionais não concluídos ({gaps.missingDevotionals.length})
                    </p>
                    <div className="space-y-1">
                      {gaps.missingDevotionals.map((dev) => (
                        <div key={dev.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-orange-500/8 border border-orange-500/15">
                          <BookOpen className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                          <span className="font-inter text-xs text-foreground truncate">
                            {dev.title || `Devocional dia ${dev.day_number ?? "?"}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground font-inter text-sm py-8">Nenhuma atividade pontuada.</p>
          ) : (
            items.map((item) => {
              const canOpenDetails = item.type === "lesson" || item.type === "devotional";
              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetails(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                    canOpenDetails ? "bg-muted/30 hover:bg-muted/50 cursor-pointer" : "bg-muted/20 cursor-default"
                  }`}
                >
                  <div className="flex-shrink-0">{typeIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm text-foreground font-medium truncate">{item.title}</p>
                    {item.subtitle && <p className="text-muted-foreground text-[10px] font-inter">{item.subtitle}</p>}
                    <p className="text-muted-foreground text-[10px] font-inter">
                      {item.date ? format(new Date(item.date), "d/MM/yy HH:mm") : ""}
                    </p>
                    {canOpenDetails && (
                      <p className="text-primary text-[10px] font-inter font-semibold mt-0.5">Toque para ver as respostas</p>
                    )}
                  </div>
                  <span className="font-montserrat font-bold text-primary text-xs flex-shrink-0">+{item.points}</span>
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      disabled={deleting === item.id}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                      title="Remover atividade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canOpenDetails && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!detailModal} onOpenChange={(open) => { if (!open) setDetailModal(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-lg">
              {detailModal?.type === "lesson" ? "🎓 Respostas da lição" : "📖 Respostas do devocional"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <p className="font-montserrat font-bold text-foreground text-sm">{detailModal?.title}</p>
              <p className="text-muted-foreground font-inter text-xs mt-1">
                {fullName}
                {selectedDetailItem?.date ? ` · ${format(new Date(selectedDetailItem.date), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}` : ""}
              </p>
            </div>

            {loadingDetail ? (
              <div className="space-y-2">
                <div className="h-16 rounded-2xl bg-muted animate-pulse" />
                <div className="h-24 rounded-2xl bg-muted animate-pulse" />
              </div>
            ) : detailModal?.type === "lesson" ? (
              detailModal.content && detailModal.content.answers.length > 0 ? (
                <div className="space-y-3">
                  {detailModal.content.answers.map((answer, index) => (
                    <div key={`${answer.question_key}-${index}`} className="rounded-2xl border border-border bg-card p-4">
                      <p className="font-montserrat font-bold text-foreground text-sm">
                        {formatLessonQuestionLabel(answer.question_key, detailModal.content)}
                      </p>
                      <p className="mt-2 text-sm font-inter text-foreground whitespace-pre-wrap">
                        {answer.response || "Sem resposta registrada."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-inter text-muted-foreground">Nenhuma resposta encontrada para esta lição.</p>
              )
            ) : detailModal?.content ? (
              <div className="space-y-3">
                {detailModal.content.bible_reference && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-montserrat font-bold text-foreground text-sm">Texto bíblico</p>
                    <p className="mt-2 text-sm font-inter text-foreground">{detailModal.content.bible_reference}</p>
                    {detailModal.content.bible_text && (
                      <p className="mt-2 text-sm font-inter text-muted-foreground whitespace-pre-wrap">{detailModal.content.bible_text}</p>
                    )}
                  </div>
                )}

                {detailModal.content.reflection && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-montserrat font-bold text-foreground text-sm">Reflexão</p>
                    <p className="mt-2 text-sm font-inter text-foreground whitespace-pre-wrap">{detailModal.content.reflection}</p>
                  </div>
                )}

                {Array.isArray(detailModal.content.questions) && detailModal.content.questions.filter((question) => question.trim()).length > 0 && (
                  <div className="space-y-3">
                    {detailModal.content.questions
                      .filter((question) => question.trim())
                      .map((question, index) => {
                        const answer = detailModal.content?.answers?.find((row) => row.question_index === index)?.response;
                        return (
                          <div key={index} className="rounded-2xl border border-border bg-card p-4">
                            <p className="font-montserrat font-bold text-foreground text-sm">{index + 1}. {question}</p>
                            <p className="mt-2 text-sm font-inter text-foreground whitespace-pre-wrap">
                              {answer || "Sem resposta registrada."}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}

                {detailModal.content.practice && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-montserrat font-bold text-foreground text-sm">Prática</p>
                    <p className="mt-2 text-sm font-inter text-foreground whitespace-pre-wrap">{detailModal.content.practice}</p>
                  </div>
                )}

                {detailModal.content.prayer && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="font-montserrat font-bold text-foreground text-sm">Oração</p>
                    <p className="mt-2 text-sm font-inter text-foreground whitespace-pre-wrap">{detailModal.content.prayer}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm font-inter text-muted-foreground">Nenhuma resposta encontrada para este devocional.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
