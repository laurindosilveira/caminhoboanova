import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomEventTypes } from "@/hooks/useCustomEventTypes";
import { X, Trash2, ChevronRight, ChevronDown, ChevronUp, BookOpen, Calendar, Church, Trophy, Star, AlertTriangle, Gift, Plus, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  userId: string;
  fullName: string;
  currentArea?: string;
  onClose: () => void;
  onPointsChanged?: () => void;
}

interface ActivityItem {
  id: string;
  type: "lesson" | "devotional" | "attendance" | "worship" | "achievement" | "activity";
  source?: "native" | "manual_bonus";
  title: string;
  subtitle?: string;
  points: number;
  date: string;
  deletable: boolean;
  tableId?: string;
  /** For attendance items: the event type (encontro, confirmatorio, culto, etc.) */
  eventType?: string;
  lessonId?: string | null;
  lessonTitle?: string;
  lessonOrder?: number | null;
  devotionalDay?: number | null;
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

type AchievementLabel = { icon: string; title: string };

type DetailModalState =
  | { itemId: string; type: "lesson"; title: string; content: LessonExpandedContent | null }
  | { itemId: string; type: "devotional"; title: string; content: DevotionalExpandedContent | null };

type BonusCategory = "conquista" | "lesson" | "devotional" | "worship" | string;

type BonusOption = {
  value: BonusCategory;
  label: string;
  type: ActivityItem["type"];
  points?: number;
};

function parseManualBonusKey(rawKey: string) {
  if (!rawKey.startsWith("bonus_lider|")) return null;

  const parts = rawKey.split("|");
  if (parts.length >= 3) {
    const category = parts[1] || "conquista";
    const justification = decodeURIComponent(parts.slice(2).join("|"));
    return { category, justification };
  }

  return {
    category: "conquista",
    justification: rawKey.slice("bonus_lider|".length),
  };
}

function buildManualBonusKey(category: string, justification: string) {
  return `bonus_lider|${category}|${encodeURIComponent(justification)}`;
}

function getManualBonusPresentation(category: string, eventTypeMeta: Record<string, { label: string; icon: React.ReactNode }>) {
  switch (category) {
    case "conquista":
      return { type: "achievement" as const, title: "Bonus do Lider", subtitlePrefix: "" };
    case "lesson":
      return { type: "lesson" as const, title: "Bonus de Licao", subtitlePrefix: "" };
    case "devotional":
      return { type: "devotional" as const, title: "Bonus de Devocional", subtitlePrefix: "" };
    case "worship":
      return { type: "worship" as const, title: "Bonus de Culto", subtitlePrefix: "" };
    default:
      return {
        type: "attendance" as const,
        title: `Bonus em ${eventTypeMeta[category]?.label ?? category}`,
        subtitlePrefix: eventTypeMeta[category]?.label ?? category,
      };
  }
}

function buildWhatsAppLink(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

export default function PlayerDetailSheet({ userId, fullName, currentArea, onClose, onPointsChanged }: Props) {
  const { role } = useAuth();
  const canDelete = role === "admin" || role === "lider";
  const { customTypes } = useCustomEventTypes(currentArea);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gaps, setGaps] = useState<{ missingLessons: { id: string; title: string }[]; missingDevotionals: { id: string; title: string; day_number: number | null }[] } | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [selectedDevotionalLessonKey, setSelectedDevotionalLessonKey] = useState<string | null>(null);
  const [bonusCategory, setBonusCategory] = useState<BonusCategory>("conquista");
  const [bonusPoints, setBonusPoints] = useState("");
  const [bonusJustification, setBonusJustification] = useState("");
  const [grantingBonus, setGrantingBonus] = useState(false);
  const [achievementLabels, setAchievementLabels] = useState<Map<string, AchievementLabel>>(new Map());
  const [bonusOptions, setBonusOptions] = useState<BonusOption[]>([]);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [userId, currentArea, customTypes]);

  useEffect(() => {
    const selectedOption = bonusOptions.find((option) => option.value === bonusCategory);
    if (!selectedOption) return;
    if (bonusCategory === "conquista") {
      setBonusPoints("");
      return;
    }
    setBonusPoints(String(selectedOption.points ?? 0));
  }, [bonusCategory, bonusOptions]);

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
      { data: achDefs },
      { data: customEventTypesData },
      { data: profileData },
    ] = await Promise.all([
      supabase.from("lesson_responses").select("id, lesson_id, question_key, response, created_at").eq("user_id", userId),
      supabase.from("devotional_progress").select("id, devotional_id, completed_at").eq("user_id", userId),
      supabase.from("attendance").select("id, event_id, status, created_at").eq("user_id", userId).in("status", ["presente", "faltou", "falta", "justificou", "justificado"]),
      supabase.from("worship_attendance").select("id, worship_date, preacher_name, worship_time, status, created_at").eq("user_id", userId).eq("status", "aprovado"),
      supabase.from("achievement_unlocks").select("id, achievement_key, bonus_points, unlocked_at").eq("user_id", userId),
      supabase.from("user_progress").select("id, activity_id, completed_at").eq("user_id", userId),
      supabase.from("lessons").select("id, title, course_id, order_num"),
      supabase.from("devotional_content").select("id, title, day_number, lesson_id"),
      supabase.from("events").select("id, title, event_date, type"),
      supabase.from("activities").select("id, title, points, type"),
      supabase.rpc("get_game_config" as any),
      supabase.from("achievement_definitions" as any).select("key, icon, title"),
      supabase.from("custom_event_types").select("value, label, gives_points, points, area"),
      supabase.from("profiles").select("phone").eq("user_id", userId).maybeSingle(),
    ]);

    // Carrega pontuações dinâmicas do game_config
    const cfgMap = new Map<string, number>((gameConfig ?? []).map((r: any) => [r.key, Number(r.value)]));
    const lessonPts    = cfgMap.get("lesson_points")             ?? 20;
    const devPts       = cfgMap.get("devotional_points")         ?? 5;
    const devWkPts     = cfgMap.get("devotional_weekend_points") ?? 2;
    const attPts       = cfgMap.get("attendance_points")         ?? 10;
    const worshipPts   = cfgMap.get("worship_points")            ?? 5;

    const customTypeMap = new Map<string, { label: string; gives_points: boolean; points: number; area: string | null }>(
      (customEventTypesData ?? []).map((type: any) => [
        type.value,
        {
          label: type.label,
          gives_points: !!type.gives_points,
          points: Number(type.points ?? 0),
          area: type.area ?? null,
        },
      ])
    );

    const nextBonusOptions: BonusOption[] = [
      { value: "conquista", label: "Conquista", type: "achievement" },
      { value: "lesson", label: "Licao", type: "lesson", points: lessonPts },
      { value: "devotional", label: "Devocional", type: "devotional", points: devPts },
      { value: "worship", label: "Culto", type: "worship", points: worshipPts },
      { value: "encontro", label: "Encontro", type: "attendance", points: customTypeMap.get("encontro")?.gives_points ? customTypeMap.get("encontro")!.points : attPts },
      { value: "confirmatorio", label: "Ens. Confirmatorio", type: "attendance", points: customTypeMap.get("confirmatorio")?.gives_points ? customTypeMap.get("confirmatorio")!.points : attPts },
      { value: "culto", label: "Culto (Agenda)", type: "attendance", points: customTypeMap.get("culto")?.gives_points ? customTypeMap.get("culto")!.points : attPts },
      { value: "jemiac", label: "JEMIAC", type: "attendance", points: customTypeMap.get("jemiac")?.gives_points ? customTypeMap.get("jemiac")!.points : attPts },
      { value: "retiro", label: "Retiro", type: "attendance", points: customTypeMap.get("retiro")?.gives_points ? customTypeMap.get("retiro")!.points : attPts },
      { value: "evento", label: "Evento", type: "attendance", points: customTypeMap.get("evento")?.gives_points ? customTypeMap.get("evento")!.points : attPts },
    ];

    customTypes.forEach((type) => {
      if (nextBonusOptions.some((option) => option.value === type.value)) return;
      nextBonusOptions.push({
        value: type.value,
        label: type.label,
        type: "attendance",
        points: type.gives_points ? type.points : attPts,
      });
    });

    setBonusOptions(nextBonusOptions);
    setPhone(profileData?.phone ?? null);

    const labelMap = new Map<string, AchievementLabel>(
      (achDefs ?? []).map((d: any) => [d.key, { icon: d.icon, title: d.title }])
    );
    setAchievementLabels(labelMap);

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
        source: "native",
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
      const lesson = devotional?.lesson_id ? lessonMap.get(devotional.lesson_id) : null;
      const dayOfWeek = new Date(progress.completed_at).getDay();
      const points = dayOfWeek === 0 || dayOfWeek === 6 ? devWkPts : devPts;
      const completionLabel = dayOfWeek === 0 || dayOfWeek === 6 ? "Recuperado no fim de semana" : "Devocional diario";
      const lessonLabel = lesson ? `Licao ${lesson.order_num}: ${lesson.title}` : "Sem licao vinculada";
      allItems.push({
        id: `dev-${progress.id}`,
        type: "devotional",
        source: "native",
        title: devotional?.title || `Devocional dia ${devotional?.day_number ?? "?"}`,
        subtitle: `${lessonLabel} - ${completionLabel}`,
        points,
        date: progress.completed_at,
        deletable: true,
        tableId: progress.id,
        lessonId: devotional?.lesson_id ?? null,
        lessonTitle: lesson?.title ?? "Sem licao vinculada",
        lessonOrder: lesson?.order_num ?? null,
        devotionalDay: devotional?.day_number ?? null,
      });
    });

    (attendance ?? []).forEach((presence) => {
      const event = eventMap.get(presence.event_id);
      const isJustified = normalizeAttendanceStatus(presence.status) === "justificou";
      allItems.push({
        id: `att-${presence.id}`,
        type: "attendance",
        source: "native",
        title: event?.title ?? "Encontro",
        subtitle: isJustified
          ? `Falta justificada · ${event?.event_date ? format(new Date(event.event_date), "d 'de' MMM", { locale: ptBR }) : ""}`
          : event?.event_date ? format(new Date(event.event_date), "d 'de' MMM", { locale: ptBR }) : "",
        points: isJustified ? 0 : attPts,
        date: presence.created_at,
        deletable: true,
        tableId: presence.id,
        eventType: (event as any)?.type ?? "encontro",
      });
    });

    (worship ?? []).forEach((service) => {
      allItems.push({
        id: `wor-${service.id}`,
        type: "worship",
        source: "native",
        title: `Culto - ${service.preacher_name}`,
        subtitle: `${format(new Date(service.worship_date), "d/MM/yyyy")} às ${service.worship_time}`,
        points: worshipPts,
        date: service.created_at,
        deletable: true,
        tableId: service.id,
      });
    });

    (achievements ?? []).forEach((achievement) => {
      const manualBonus = parseManualBonusKey(achievement.achievement_key);
      const isManualBonus = !!manualBonus;
      const label = labelMap.get(achievement.achievement_key);
      const presentation = manualBonus ? getManualBonusPresentation(manualBonus.category, EVENT_TYPE_META) : null;
      allItems.push({
        id: `ach-${achievement.id}`,
        type: presentation?.type ?? "achievement",
        source: isManualBonus ? "manual_bonus" : "native",
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

      if (isManualBonus && manualBonus) {
        const currentItem = allItems[allItems.length - 1];
        currentItem.type = presentation?.type ?? "achievement";
        currentItem.source = "manual_bonus";
        currentItem.title = presentation?.title ?? "Bonus do Lider";
        currentItem.subtitle = manualBonus.justification;
        currentItem.eventType = presentation?.type === "attendance" ? manualBonus.category : undefined;
      }
    });

    (userProgress ?? []).forEach((progress) => {
      const activity = activityMap.get(progress.activity_id);
      if (activity && activity.type !== "devocional" && activity.type !== "formacao" && activity.type !== "encontro") {
        allItems.push({
          id: `act-${progress.id}`,
          type: "activity",
          source: "native",
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

    // Open detail overlay immediately (synchronously) so no gap exists between
    // closing the category overlay and showing the detail overlay — otherwise the
    // pointerup ghost-click reaches the outer backdrop and closes the sheet.
    setPreviousCategoryModal(categoryModal);
    setCategoryModal(null);
    setLoadingDetail(true);
    setDetailModal({ itemId: item.id, type: item.type as "lesson" | "devotional", title: item.title, content: null });

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

  function resetBonusForm() {
    setBonusCategory("conquista");
    setBonusPoints("");
    setBonusJustification("");
    setShowBonusForm(false);
  }

  async function handleGrantBonus() {
    const selectedOption = bonusOptions.find((option) => option.value === bonusCategory);
    const pts = parseInt(bonusPoints, 10);
    if (!pts || pts <= 0) { toast.error("Informe uma quantidade de pontos válida."); return; }
    if (pts > 500) { toast.error("O bônus não pode ultrapassar 500 pontos por vez."); return; }
    if (!bonusJustification.trim()) { toast.error("Informe a justificativa para o bônus."); return; }
    if (pts > 100 && !confirm(`Confirma conceder ${pts} pontos para ${fullName}?\n\nJustificativa: ${bonusJustification.trim()}`)) return;

    setGrantingBonus(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const key = buildManualBonusKey(bonusCategory, bonusJustification.trim());
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

      const presentation = getManualBonusPresentation(bonusCategory, EVENT_TYPE_META);
      setItems(prev => [{
        id: `ach-${data.id}`,
        type: presentation.type,
        source: "manual_bonus",
        title: presentation.title,
        subtitle: bonusJustification.trim(),
        points: pts,
        date: data.unlocked_at,
        deletable: true,
        tableId: data.id,
        eventType: presentation.type === "attendance" ? bonusCategory : undefined,
      }, ...prev]);
      setTotalPoints(prev => prev + pts);
      resetBonusForm();
      toast.success(`+${pts} pontos concedidos a ${fullName}${selectedOption ? ` em ${selectedOption.label}` : ""}`);
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
      if (item.source === "manual_bonus" && item.tableId) {
        await supabase.from("achievement_unlocks").delete().eq("id", item.tableId);
      } else if (item.type === "lesson" && item.tableId) {
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
        activity_type: item.source === "manual_bonus" ? "achievement" : item.type,
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

  // Labels and icons for each event type (attendance sub-types)
  const EVENT_TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
    encontro:      { label: "Encontro",           icon: <Calendar className="w-4 h-4 text-brand-green" /> },
    confirmatorio: { label: "Ens. Confirmatório", icon: <Calendar className="w-4 h-4 text-primary" /> },
    culto:         { label: "Culto",              icon: <Church className="w-4 h-4 text-accent" /> },
    jemiac:        { label: "JEMIAC",             icon: <Calendar className="w-4 h-4 text-secondary" /> },
    retiro:        { label: "Retiro",             icon: <Calendar className="w-4 h-4 text-amber-500" /> },
    evento:        { label: "Evento",             icon: <Calendar className="w-4 h-4 text-muted-foreground" /> },
    ...Object.fromEntries(
      customTypes.map((type) => [
        type.value,
        { label: type.label, icon: <Calendar className="w-4 h-4 text-brand-green" /> },
      ])
    ),
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "lesson": return <BookOpen className="w-4 h-4 text-primary" />;
      case "devotional": return <BookOpen className="w-4 h-4 text-secondary" />;
      case "achievement": return <Trophy className="w-4 h-4 text-amber-500" />;
      case "worship": return <Church className="w-4 h-4 text-accent" />;
      case "activity": return <Star className="w-4 h-4 text-muted-foreground" />;
      default:
        // attendance sub-types keyed as "att_<eventType>"
        if (type.startsWith("att_")) {
          const evType = type.slice(4);
          return EVENT_TYPE_META[evType]?.icon ?? <Calendar className="w-4 h-4 text-brand-green" />;
        }
        return <Star className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "lesson": return "Lição";
      case "devotional": return "Devocional";
      case "achievement": return "Conquista";
      case "worship": return "Culto";
      case "activity": return "Atividade";
      default:
        if (type.startsWith("att_")) {
          const evType = type.slice(4);
          return EVENT_TYPE_META[evType]?.label ?? "Presença";
        }
        return "Presença";
    }
  };

  // Group items: attendance items are split by eventType (att_encontro, att_confirmatorio, etc.)
  const grouped = items.reduce((acc, item) => {
    const key = item.type === "attendance" ? `att_${item.eventType ?? "encontro"}` : item.type;
    if (!acc[key]) acc[key] = { count: 0, points: 0 };
    acc[key].count++;
    acc[key].points += item.points;
    return acc;
  }, {} as Record<string, { count: number; points: number }>);

  const selectedDetailItem = detailModal ? items.find((item) => item.id === detailModal.itemId) ?? null : null;

  const [categoryModal, setCategoryModal] = useState<string | null>(null);
  const [previousCategoryModal, setPreviousCategoryModal] = useState<string | null>(null);
  // For attendance sub-types, filter by eventType; otherwise filter by type
  const categoryItems = categoryModal
    ? categoryModal.startsWith("att_")
      ? items.filter(i => i.type === "attendance" && `att_${i.eventType ?? "encontro"}` === categoryModal)
      : items.filter(i => i.type === categoryModal)
    : [];
  const devotionalLessonGroups = categoryItems
    .filter((item) => item.type === "devotional")
    .reduce((acc, item) => {
      const key = item.source === "manual_bonus"
        ? "manual_bonus"
        : item.lessonId ?? "without_lesson";
      if (!acc[key]) {
        acc[key] = {
          key,
          title: item.source === "manual_bonus" ? "Bonus de Devocional" : item.lessonTitle ?? "Sem licao vinculada",
          order: item.source === "manual_bonus" ? 9998 : item.lessonOrder ?? 9999,
          items: [] as ActivityItem[],
          points: 0,
          lastDate: item.date,
        };
      }
      acc[key].items.push(item);
      acc[key].points += item.points;
      if (new Date(item.date).getTime() > new Date(acc[key].lastDate).getTime()) {
        acc[key].lastDate = item.date;
      }
      return acc;
    }, {} as Record<string, { key: string; title: string; order: number; items: ActivityItem[]; points: number; lastDate: string }>);
  const devotionalLessonGroupList = Object.values(devotionalLessonGroups)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const selectedDevotionalLessonGroup = selectedDevotionalLessonKey
    ? devotionalLessonGroups[selectedDevotionalLessonKey]
    : null;
  const visibleCategoryItems = categoryModal === "devotional" && selectedDevotionalLessonGroup
    ? selectedDevotionalLessonGroup.items
    : categoryItems;
  const selectedBonusOption = bonusOptions.find((option) => option.value === bonusCategory);
  const isManualConquistaBonus = bonusCategory === "conquista";
  const whatsappLink = buildWhatsAppLink(phone);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <p className="font-montserrat font-bold text-foreground text-base">{fullName}</p>
            <p className="text-muted-foreground font-inter text-xs">{totalPoints} pontos · {items.length} atividades</p>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-inter font-semibold text-primary hover:underline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Conversar no WhatsApp
              </a>
            )}
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
            <select
              value={bonusCategory}
              onChange={e => setBonusCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {bonusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="500"
                placeholder="Pts"
                value={bonusPoints}
                onChange={e => setBonusPoints(e.target.value)}
                disabled={!isManualConquistaBonus}
                className="w-20 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
              <input
                type="text"
                placeholder="Justificativa..."
                value={bonusJustification}
                onChange={e => setBonusJustification(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {!isManualConquistaBonus && selectedBonusOption && (
              <p className="text-xs font-inter text-muted-foreground">
                Pontuacao automatica para {selectedBonusOption.label}: +{selectedBonusOption.points ?? 0}
              </p>
            )}
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
                onClick={resetBonusForm}
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
              <button
                key={type}
                onClick={() => { setCategoryModal(type); setSelectedDevotionalLessonKey(null); }}
                className="bg-muted/50 hover:bg-muted/80 active:scale-95 rounded-xl p-2 text-center transition-all cursor-pointer"
              >
                <div className="flex items-center justify-center mb-1">{typeIcon(type)}</div>
                <p className="font-montserrat font-bold text-foreground text-xs">{count}</p>
                <p className="text-muted-foreground text-[10px] font-inter">{typeLabel(type)}</p>
                <p className="text-primary text-[10px] font-montserrat font-bold">+{points}</p>
              </button>
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

        {loading && (
          <div className="p-4 space-y-2 flex-shrink-0">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="text-center text-muted-foreground font-inter text-sm py-8">Nenhuma atividade pontuada.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="px-4 pb-4 pt-2 flex-shrink-0">
            <p className="text-muted-foreground font-inter text-[10px] text-center">Toque em uma categoria acima para ver os detalhes</p>
          </div>
        )}
      </div>

      {/* Category modal — inline overlay, no portal, so clicks don't leak to backdrop */}
      {categoryModal && (
        <div
          className="absolute inset-0 z-10 bg-black/50 rounded-t-2xl flex flex-col justify-end"
          onClick={(e) => { e.stopPropagation(); setCategoryModal(null); }}
        >
          <div
            className="bg-card rounded-t-2xl max-h-[80%] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 font-montserrat text-lg font-bold text-foreground">
                {categoryModal === "devotional" && selectedDevotionalLessonGroup && (
                  <button
                    onClick={() => setSelectedDevotionalLessonKey(null)}
                    className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                )}
                {categoryModal === "devotional" && selectedDevotionalLessonGroup
                  ? <BookOpen className="w-4 h-4 text-secondary" />
                  : typeIcon(categoryModal)}
                {categoryModal === "devotional" && selectedDevotionalLessonGroup
                  ? selectedDevotionalLessonGroup.order < 9998
                    ? `Lição ${selectedDevotionalLessonGroup.order}`
                    : selectedDevotionalLessonGroup.title
                  : typeLabel(categoryModal)}
                <span className="text-muted-foreground font-inter text-sm font-normal ml-1">
                  {categoryModal === "devotional" && !selectedDevotionalLessonGroup
                    ? `${devotionalLessonGroupList.length} ${devotionalLessonGroupList.length === 1 ? "lição" : "lições"}`
                    : `${visibleCategoryItems.length} ${visibleCategoryItems.length === 1 ? "item" : "itens"}`}
                </span>
              </div>
              <button
                onClick={() => { setCategoryModal(null); setSelectedDevotionalLessonKey(null); }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {categoryItems.length === 0 ? (
                <p className="text-center text-muted-foreground font-inter text-sm py-8">Nenhuma atividade nesta categoria.</p>
              ) : categoryModal === "devotional" && !selectedDevotionalLessonGroup ? (
                devotionalLessonGroupList.map((group) => (
                  <button
                    key={group.key}
                    onClick={() => setSelectedDevotionalLessonKey(group.key)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-inter text-sm text-foreground font-semibold truncate">
                        {group.order < 9998 ? `Lição ${group.order}: ${group.title}` : group.title}
                      </p>
                      <p className="text-muted-foreground text-[10px] font-inter">
                        {group.items.length} {group.items.length === 1 ? "devocional lido" : "devocionais lidos"}
                        {group.lastDate ? ` - último em ${format(new Date(group.lastDate), "d/MM/yy")}` : ""}
                      </p>
                    </div>
                    <span className="font-montserrat font-bold text-primary text-xs flex-shrink-0">+{group.points}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              ) : (
                visibleCategoryItems.map((item) => {
                  const canOpenDetails = item.source !== "manual_bonus" && (item.type === "lesson" || item.type === "devotional");
                  return (
                    <div
                      key={item.id}
                      onClick={() => { if (canOpenDetails) handleOpenDetails(item); }}
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
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); setCategoryModal(null); }}
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
        </div>
      )}

      {/* Detail modal — inline overlay, no portal */}
      {detailModal && (
        <div
          className="absolute inset-0 z-20 bg-black/50 rounded-t-2xl flex flex-col justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card rounded-t-2xl max-h-[85%] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                {previousCategoryModal && (
                  <button
                    onClick={() => { setDetailModal(null); setCategoryModal(previousCategoryModal); setPreviousCategoryModal(null); }}
                    className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    ←
                  </button>
                )}
                <p className="font-montserrat text-base font-bold text-foreground">
                  {detailModal.type === "lesson" ? "🎓 Respostas da lição" : "📖 Respostas do devocional"}
                </p>
              </div>
              <button
                onClick={() => { setDetailModal(null); if (previousCategoryModal) { setCategoryModal(previousCategoryModal); setPreviousCategoryModal(null); } }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
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
          </div>
        </div>
      )}
    </div>
  );
}
