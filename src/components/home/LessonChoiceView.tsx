import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, BookOpen, GraduationCap, CheckCircle2, Star, LockKeyhole, Calendar, Lock, Pencil } from "lucide-react";
import DevotionalView from "@/components/home/DevotionalView";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type DevotionalItem = {
  id: string;
  lesson_id: string;
  day_number: number;
  title: string;
  bible_text: string;
  bible_reference: string;
  reflection: string;
  prayer: string;
  practice: string;
  questions: string[];
};

type DevotionalOverride = {
  id: string;
  devotional_id: string;
  custom_points: number | null;
  available_from: string | null;
  available_until: string | null;
  is_unlocked: boolean;
};

type DevotionalStatus = "available" | "completed" | "locked" | "future" | "recovery";

type Props = {
  lesson: Lesson;
  onBack: () => void;
  onOpenStudy: () => void;
  /** Callback to open the lesson content editor (leaders/admins only) */
  onOpenEdit?: () => void;
  /** Callback to open the devotional editor (leaders/admins only) */
  onOpenEditDevotionals?: () => void;
  /** Schedule-based devotional dates (from agenda, 10 entries). [0..4] = primary week, [5..9] = recovery week. */
  scheduledDevotionalDates?: Date[];
  /** Day numbers the leader chose to release. null = all. */
  releasedDayNumbers?: number[] | null;
  /** '5_days' = 5+recovery; '10_days' = full 10-day window (default). */
  devotionalMode?: "5_days" | "10_days";
  /** Auto-open the currently available devotional when this view mounts. */
  autoOpenAvailableDevotional?: boolean;
  /** Called after the auto-open request is handled. */
  onAutoOpenAvailableDevotionalConsumed?: () => void;
  /** Event date for display */
  eventDate?: Date;
  /** Whether the study is locked (event day or past deadline) */
  isStudyLocked?: boolean;
  /** Whether this is late access (after event date — no points) */
  isLateAccess?: boolean;
  /** Whether the study (lesson responses) has been completed */
  isStudyCompleted?: boolean;
};

function normalizeDate(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getWeekendRecoveryWindow(today: Date) {
  const day = today.getDay();
  if (day !== 0 && day !== 6) return null;

  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : 5));
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(0, 0, 0, 0);

  return { monday, friday };
}

function isRecoverableOnWeekend(scheduledDate: Date, today: Date) {
  const recoveryWindow = getWeekendRecoveryWindow(today);
  if (!recoveryWindow) return false;
  return scheduledDate >= recoveryWindow.monday && scheduledDate <= recoveryWindow.friday;
}

function isOverrideActive(override: DevotionalOverride | undefined, now: Date) {
  if (!override || !override.is_unlocked) return false;
  if (override.available_from && new Date(override.available_from) > now) return false;
  if (override.available_until && new Date(override.available_until) < now) return false;
  return true;
}

/**
 * Compute devotional statuses based on scheduled dates from the agenda.
 *
 * 10_days mode (default):
 *   - dates[0..N-1] are the business-day release dates; one per day_number.
 *   - Past + missed = "locked"; future = "future"; today = "available".
 *
 * 5_days mode:
 *   - devotionals 1–5 are mapped to dates[0..4] (primary week).
 *   - devotionals 1–5 that were MISSED in primary get a recovery date = dates[5..9]
 *     (one per missed devotional, in order). Recovery is strict: miss the recovery
 *     date and it becomes permanently "locked".
 */
function computeDevotionalStatuses(
  devList: DevotionalItem[],
  completedMap: Map<string, string>,
  completedRecoveryIds: Set<string>,
  scheduledDates: Date[],
  devotionalMode: "5_days" | "10_days",
  releasedDayNumbers: number[] | null,
  overrideMap: Map<string, DevotionalOverride>,
): { statuses: Map<string, DevotionalStatus>; lockedSet: Set<string>; recoverySet: Set<string> } {
  const statuses = new Map<string, DevotionalStatus>();
  const lockedSet = new Set<string>();
  const recoverySet = new Set<string>();

  if (devList.length === 0) return { statuses, lockedSet, recoverySet };

  const today = normalizeDate(new Date());
  const now = new Date();
  const released = releasedDayNumbers ? new Set(releasedDayNumbers) : null;
  const scheduledDayLimit = devotionalMode === "5_days" ? 5 : Number.POSITIVE_INFINITY;

  function isToday(date: Date) {
    return normalizeDate(date).getTime() === today.getTime();
  }

  const devListIds = new Set(devList.map((dev) => dev.id));
  const completedToday = Array.from(completedMap.entries()).some(([devId, dateStr]) => {
    if (!devListIds.has(devId)) return false;
    const completedDate = new Date(dateStr);
    completedDate.setHours(0, 0, 0, 0);
    return completedDate.getTime() === today.getTime();
  });

  for (const dev of devList) {
    if (dev.day_number > scheduledDayLimit) {
      statuses.set(dev.id, "future");
      lockedSet.add(dev.id);
    }
  }

  const activeDevs = devList
    .filter((dev) => dev.day_number <= scheduledDayLimit)
    .sort((a, b) => a.day_number - b.day_number);

  if (scheduledDates.length > 0) {
    for (const dev of activeDevs) {
      const activeOverride = overrideMap.get(dev.id);

      if (released && !released.has(dev.day_number) && !isOverrideActive(activeOverride, now)) {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
        continue;
      }

      if (completedMap.has(dev.id)) {
        statuses.set(dev.id, "completed");
        continue;
      }

      if (isOverrideActive(activeOverride, now)) {
        statuses.set(dev.id, "available");
        continue;
      }

      const rawScheduledDate = scheduledDates[dev.day_number - 1];
      const scheduledDate = rawScheduledDate ? normalizeDate(new Date(rawScheduledDate)) : null;

      if (!scheduledDate) {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
        continue;
      }

      if (scheduledDate > today) {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
        continue;
      }

      if (isToday(scheduledDate)) {
        if (completedToday) {
          statuses.set(dev.id, "future");
          lockedSet.add(dev.id);
        } else {
          statuses.set(dev.id, "available");
        }
        continue;
      }

      if (completedRecoveryIds.has(dev.id) || isRecoverableOnWeekend(scheduledDate, today)) {
        statuses.set(dev.id, "recovery");
        recoverySet.add(dev.id);
        continue;
      }

      statuses.set(dev.id, "locked");
      lockedSet.add(dev.id);
    }

    return { statuses, lockedSet, recoverySet };
  }

  const day1Dev = activeDevs.find((dev) => dev.day_number === 1);
  const day1CompletedAt = day1Dev ? completedMap.get(day1Dev.id) : null;

  if (!day1CompletedAt) {
    activeDevs.forEach((dev, index) => {
      const activeOverride = overrideMap.get(dev.id);

      if (released && !released.has(dev.day_number) && !isOverrideActive(activeOverride, now)) {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
      } else if (isOverrideActive(activeOverride, now) || index === 0) {
        statuses.set(dev.id, "available");
      } else {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
      }
    });

    return { statuses, lockedSet, recoverySet };
  }

  const startDate = new Date(day1CompletedAt);
  startDate.setHours(0, 0, 0, 0);

  function getScheduledDate(dayNumber: number) {
    const date = new Date(startDate);
    let assigned = 1;

    while (assigned < dayNumber) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) assigned++;
    }

    return date;
  }

  for (const dev of activeDevs) {
    const activeOverride = overrideMap.get(dev.id);

    if (released && !released.has(dev.day_number) && !isOverrideActive(activeOverride, now)) {
      statuses.set(dev.id, "future");
      lockedSet.add(dev.id);
      continue;
    }

    if (completedMap.has(dev.id)) {
      statuses.set(dev.id, "completed");
      continue;
    }

    if (isOverrideActive(activeOverride, now)) {
      statuses.set(dev.id, "available");
      continue;
    }

    const scheduledDate = getScheduledDate(dev.day_number);
    scheduledDate.setHours(0, 0, 0, 0);

    if (scheduledDate > today) {
      statuses.set(dev.id, "future");
      lockedSet.add(dev.id);
    } else if (isToday(scheduledDate)) {
      if (completedToday) {
        statuses.set(dev.id, "future");
        lockedSet.add(dev.id);
      } else {
        statuses.set(dev.id, "available");
      }
    } else {
      statuses.set(dev.id, "locked");
      lockedSet.add(dev.id);
    }
  }

  return { statuses, lockedSet, recoverySet };
}

export default function LessonChoiceView({
  lesson,
  onBack,
  onOpenStudy,
  onOpenEdit,
  onOpenEditDevotionals,
  scheduledDevotionalDates,
  releasedDayNumbers = null,
  devotionalMode = "10_days",
  autoOpenAvailableDevotional = false,
  onAutoOpenAvailableDevotionalConsumed,
  eventDate,
  isStudyLocked,
  isLateAccess,
  isStudyCompleted = true,
}: Props) {
  const { role } = useAuth();
  const isLeaderOrAdmin = role === "admin" || role === "lider";
  const [devotionals, setDevotionals] = useState<DevotionalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDevotionals, setShowDevotionals] = useState(false);
  const [viewingDevotional, setViewingDevotional] = useState<DevotionalItem | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completedDates, setCompletedDates] = useState<Map<string, string>>(new Map());
  const [completedRecoveryIds, setCompletedRecoveryIds] = useState<Set<string>>(new Set());
  const [devStatuses, setDevStatuses] = useState<Map<string, DevotionalStatus>>(new Map());
  const [devRecoverySet, setDevRecoverySet] = useState<Set<string>>(new Set());
  const [devOverrideMap, setDevOverrideMap] = useState<Map<string, DevotionalOverride>>(new Map());
  const [devPts, setDevPts] = useState(5);
  const [devRecoveryPts, setDevRecoveryPts] = useState(2);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: devs }, { data: prog }, { data: gameConfig }] = await Promise.all([
        supabase.from("devotional_content").select("*").eq("lesson_id", lesson.id).order("day_number"),
        user
          ? supabase.from("devotional_progress").select("devotional_id, completed_at, is_recovery").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        supabase.rpc("get_game_config" as any),
      ]);
      const cfgMap = new Map<string, number>((gameConfig ?? []).map((r: any) => [r.key, Number(r.value)]));
      setDevPts(cfgMap.get("devotional_points") ?? 5);

      setDevRecoveryPts(cfgMap.get("devotional_recovery_points") ?? 2);

      const devList = (devs ?? []) as DevotionalItem[];
      const overrideMap = new Map<string, DevotionalOverride>();
      if (user && devList.length > 0) {
        const { data: overrides } = await supabase
          .from("user_devotional_overrides" as any)
          .select("id, devotional_id, custom_points, available_from, available_until, is_unlocked")
          .eq("user_id", user.id)
          .in("devotional_id", devList.map((dev) => dev.id));
        (overrides ?? []).forEach((item: any) => {
          overrideMap.set(item.devotional_id, item as DevotionalOverride);
        });
      }
      setDevOverrideMap(overrideMap);
      const progList = prog ?? [];
      const completedMap = new Map<string, string>();
      const recoveryIds = new Set<string>();
      progList.forEach((p: any) => {
        completedMap.set(p.devotional_id, p.completed_at);
        if (p.is_recovery) recoveryIds.add(p.devotional_id);
      });
      setCompletedIds(new Set(progList.map((p: any) => p.devotional_id)));
      setCompletedDates(completedMap);
      setCompletedRecoveryIds(recoveryIds);

      if (isLeaderOrAdmin) {
        const allAvailable = new Map<string, DevotionalStatus>();
        devList.forEach(d => allAvailable.set(d.id, completedMap.has(d.id) ? "completed" : "available"));
        setDevStatuses(allAvailable);
        setDevRecoverySet(new Set());
      } else if (isLateAccess) {
        const lateStatuses = new Map<string, DevotionalStatus>();
        devList.forEach(d => {
          if (completedMap.has(d.id)) {
            lateStatuses.set(d.id, "completed");
            return;
          }
          const activeOverride = overrideMap.get(d.id);
          lateStatuses.set(d.id, isOverrideActive(activeOverride, new Date()) ? "available" : "locked");
        });
        setDevStatuses(lateStatuses);
        setDevRecoverySet(new Set());
      } else {
        const { statuses, recoverySet } = computeDevotionalStatuses(
          devList, completedMap, recoveryIds,
          scheduledDevotionalDates ?? [], devotionalMode, releasedDayNumbers, overrideMap
        );
        setDevStatuses(statuses);
        setDevRecoverySet(recoverySet);
      }
      setDevotionals(devList);
      setLoading(false);
    }
    load();
  }, [lesson.id, scheduledDevotionalDates, releasedDayNumbers, devotionalMode, isLateAccess, isStudyCompleted]);

  useEffect(() => {
    if (!autoOpenAvailableDevotional || loading || devotionals.length === 0) return;

    const availableDevotional = devotionals.find((dev) => {
      const s = devStatuses.get(dev.id) ?? "future";
      return s === "available" || s === "recovery";
    });

    if (availableDevotional) {
      setShowDevotionals(false);
      setViewingDevotional(availableDevotional);
    } else {
      setShowDevotionals(true);
    }

    onAutoOpenAvailableDevotionalConsumed?.();
  }, [
    autoOpenAvailableDevotional,
    loading,
    devotionals,
    devStatuses,
    onAutoOpenAvailableDevotionalConsumed,
  ]);

  async function handleCompleteDevotional(devotionalId: string, isRecovery = false) {
    const now = new Date();
    const overridePoints = devOverrideMap.get(devotionalId)?.custom_points ?? null;
    const pts = isLateAccess ? 0 : overridePoints ?? (isRecovery ? devRecoveryPts : devPts);
    const newCompletedMap = new Map(completedDates);
    newCompletedMap.set(devotionalId, now.toISOString());
    const newRecoveryIds = new Set(completedRecoveryIds);
    if (isRecovery) newRecoveryIds.add(devotionalId);
    setCompletedDates(newCompletedMap);
    setCompletedIds(prev => new Set([...prev, devotionalId]));
    setCompletedRecoveryIds(newRecoveryIds);
    if (isLeaderOrAdmin) {
      const allAvailable = new Map<string, DevotionalStatus>();
      devotionals.forEach(d => allAvailable.set(d.id, newCompletedMap.has(d.id) ? "completed" : "available"));
      setDevStatuses(allAvailable);
      setDevRecoverySet(new Set());
    } else if (isLateAccess) {
      const lateStatuses = new Map<string, DevotionalStatus>();
      devotionals.forEach(d => {
        if (newCompletedMap.has(d.id)) {
          lateStatuses.set(d.id, "completed");
          return;
        }
        const activeOverride = devOverrideMap.get(d.id);
        lateStatuses.set(d.id, isOverrideActive(activeOverride, now) ? "available" : "locked");
      });
      setDevStatuses(lateStatuses);
      setDevRecoverySet(new Set());
    } else {
      const { statuses, recoverySet } = computeDevotionalStatuses(
        devotionals, newCompletedMap, newRecoveryIds,
        scheduledDevotionalDates ?? [], devotionalMode, releasedDayNumbers, devOverrideMap
      );
      setDevStatuses(statuses);
      setDevRecoverySet(recoverySet);
    }
    if (isLateAccess) {
      toast.info("Devocional concluído! (sem pontuação — prazo encerrado)", { duration: 3000 });
    } else if (isRecovery) {
      toast.success(`Devocional recuperado! +${pts} pontos de fé ⭐`, {
        description: `Recuperação (${devRecoveryPts} pts — valor reduzido)`,
        duration: 3000,
      });
    } else {
      toast.success(`Devocional concluído! +${pts} pontos de fé ⭐`, {
        description: "Continue firme na sua caminhada!",
        duration: 3000,
      });
    }
  }

  const completedCount = devotionals.filter(d => completedIds.has(d.id)).length;
  const lockedCount = Array.from(devStatuses.values()).filter(s => s === "locked").length;
  const totalCount = devotionals.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Compute display dates for devotionals
  const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const scheduledDateMap = new Map<string, Date>();

  if (devotionals.length > 0) {
    if (scheduledDevotionalDates && scheduledDevotionalDates.length > 0) {
      // Use agenda-based dates
      devotionals.forEach(dev => {
        const idx = dev.day_number - 1;
        if (idx < scheduledDevotionalDates.length) {
          scheduledDateMap.set(dev.id, scheduledDevotionalDates[idx]);
        }
      });
    } else {
      // Fallback: compute from day1 completion
      const day1Dev = devotionals.find(d => d.day_number === 1);
      const day1Date = day1Dev ? completedDates.get(day1Dev.id) : null;
      if (day1Date) {
        const anchor = new Date(day1Date);
        anchor.setHours(0, 0, 0, 0);
        for (const dev of devotionals) {
          const date = new Date(anchor);
          let assigned = 1;
          while (assigned < dev.day_number) {
            date.setDate(date.getDate() + 1);
            const dow = date.getDay();
            if (dow !== 0 && dow !== 6) assigned++;
          }
          scheduledDateMap.set(dev.id, new Date(date));
        }
      }
    }
  }

  if (viewingDevotional) {
    const isCompleted = completedIds.has(viewingDevotional.id);
    const isViewingRecovery = devRecoverySet.has(viewingDevotional.id);
    const activeOverride = devOverrideMap.get(viewingDevotional.id);
    const pts = isLateAccess ? 0 : activeOverride?.custom_points ?? (isViewingRecovery ? devRecoveryPts : devPts);
    return (
      <DevotionalView
        activity={{
          id: viewingDevotional.id,
          title: viewingDevotional.title || `Dia ${viewingDevotional.day_number}`,
          subtitle: `${lesson.title} · Dia ${viewingDevotional.day_number}${isViewingRecovery ? " · Recuperação" : ""}`,
          points: pts,
        }}
        devotionalData={{
          bible_text: viewingDevotional.bible_text,
          bible_reference: viewingDevotional.bible_reference,
          reflection: viewingDevotional.reflection,
          prayer: viewingDevotional.prayer,
          practice: viewingDevotional.practice,
          questions: viewingDevotional.questions,
        }}
        onBack={() => setViewingDevotional(null)}
        onComplete={async (id) => {
          await handleCompleteDevotional(id, isViewingRecovery);
          setViewingDevotional(null);
        }}
        isCompleted={isCompleted}
        isRecovery={isViewingRecovery}
        awardedPoints={pts}
        overrideId={activeOverride?.id}
      />
    );
  }

  if (showDevotionals) {
    return (
      <div className="px-5 pt-5 pb-6 space-y-4">
        <button onClick={() => setShowDevotionals(false)} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
          <p className="text-primary-foreground/60 font-inter text-xs mb-1">📖 Devocionais da semana · Lição {lesson.order_num}</p>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg">{lesson.title}</h2>
          <p className="text-primary-foreground/70 font-inter text-xs mt-1">
            {completedCount}/{totalCount} concluídos{lockedCount > 0 ? ` · ${lockedCount} bloqueado${lockedCount > 1 ? "s" : ""}` : ""}
          </p>
          {eventDate && (
            <p className="text-primary-foreground/60 font-inter text-[10px] mt-1">
              📅 Encontro: {format(eventDate, "d 'de' MMMM", { locale: ptBR })}
            </p>
          )}
          {totalCount > 0 && (
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>

        {devotionals.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-montserrat font-bold text-foreground text-sm">Devocionais em preparação</p>
            <p className="text-muted-foreground font-inter text-xs mt-1">Seu pastor está preparando os devocionais para esta lição.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devotionals.map((dev) => {
              const status = devStatuses.get(dev.id) ?? "future";
              const done = status === "completed";
              const locked = status === "locked";
              const future = status === "future";
              const isDisabled = locked || future;
              const sched = scheduledDateMap.get(dev.id);
              return (
                <button key={dev.id}
                  onClick={() => !isDisabled && setViewingDevotional(dev)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 p-4 bg-card rounded-2xl border shadow-sm text-left transition-colors ${
                    locked ? "border-destructive/20 bg-destructive/5 opacity-60 cursor-not-allowed" :
                    future ? "border-border bg-muted/30 opacity-50 cursor-not-allowed" :
                    done ? "border-brand-green/30 bg-brand-green/5" : "border-border hover:bg-brand-green/5"
                  }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    locked ? "bg-destructive/10" : future ? "bg-muted" : done ? "bg-brand-green/20" : "bg-brand-green/10"
                  }`}>
                    {locked ? (
                      <LockKeyhole className="w-5 h-5 text-destructive/60" />
                    ) : future ? (
                      <Calendar className="w-5 h-5 text-muted-foreground/50" />
                    ) : done ? (
                      <CheckCircle2 className="w-5 h-5 text-brand-green" />
                    ) : (
                      <span className="font-montserrat font-bold text-brand-green text-sm">{dev.day_number}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-montserrat font-bold text-sm ${
                      locked ? "text-destructive/60" : future ? "text-muted-foreground" : done ? "text-brand-green" : "text-foreground"
                    }`}>
                      {dev.title || `Dia ${dev.day_number}`}
                    </p>
                    <p className="text-muted-foreground font-inter text-[10px] truncate">
                      {locked ? "🔒 Bloqueado — dia perdido" : future ? (
                        sched ? `🔜 ${weekdayNames[sched.getDay()]}, ${sched.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "🔜 Disponível em breve"
                      ) : done ? "✅ Concluído" : (
                        sched ? `📖 Disponível hoje (${weekdayNames[sched.getDay()]})` : "📖 Disponível hoje"
                      )}
                    </p>
                  </div>
                  {!isDisabled && <span className="text-muted-foreground text-xs">→</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-primary-foreground/60 font-inter text-xs mb-1">Lição {lesson.order_num}</p>
        <h2 className="font-montserrat font-black text-primary-foreground text-xl leading-tight">{lesson.title}</h2>
        {lesson.objective && (
          <p className="text-primary-foreground/70 font-inter text-xs mt-2">{lesson.objective}</p>
        )}
        {eventDate && (
          <p className="text-primary-foreground/50 font-inter text-[10px] mt-2">
            📅 Encontro: {format(eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </div>

      {isLateAccess && (
        <div className="rounded-2xl p-3 bg-accent/10 border border-accent/20 flex items-start gap-2">
          <span className="text-sm">⚠️</span>
          <p className="font-inter text-xs text-accent-foreground">
            O prazo desta lição já encerrou. Você ainda pode completar o <strong>estudo</strong>, mas <strong>sem pontuação</strong>. Os devocionais não realizados estão bloqueados.
          </p>
        </div>
      )}

      {/* Warning: study not done yet (only during normal access, not late) */}
      {!isLeaderOrAdmin && !isStudyCompleted && !isLateAccess && (
        <div className="rounded-2xl p-3 bg-secondary/10 border border-secondary/20 flex items-start gap-2.5">
          <span className="text-base mt-0.5">💡</span>
          <div>
            <p className="font-montserrat font-bold text-foreground text-xs">Dica importante</p>
            <p className="font-inter text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Recomendamos <strong>completar o estudo da lição primeiro</strong> para um melhor aproveitamento dos devocionais.
            </p>
          </div>
        </div>
      )}

      <p className="font-inter text-sm text-muted-foreground text-center">Escolha o que deseja acessar:</p>

      <div className="grid grid-cols-1 gap-3">
        {/* Estudo — show first when not completed */}
        {!isStudyCompleted && !isLeaderOrAdmin && (
          <button onClick={() => {
              if (isStudyLocked) return;
              onOpenStudy();
            }}
            className={`flex items-center gap-4 p-5 bg-card rounded-2xl border shadow-sm text-left transition-all group ${
              isStudyLocked ? "border-border opacity-50 cursor-not-allowed" : "border-secondary/30 hover:bg-secondary/5 ring-2 ring-secondary/20"
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
              isStudyLocked ? "bg-muted" : "bg-secondary/10 group-hover:bg-secondary/20"
            }`}>
              {isStudyLocked ? <Lock className="w-7 h-7 text-muted-foreground" /> : <GraduationCap className="w-7 h-7 text-secondary" />}
            </div>
            <div className="flex-1">
              <p className="font-montserrat font-bold text-foreground text-base">🎓 Estudo da Lição</p>
              <p className="text-secondary font-inter text-xs mt-0.5 font-semibold">
                ⭐ Recomendado — faça primeiro!
              </p>
              <p className="text-muted-foreground font-inter text-[10px] mt-1 italic">
                {isLateAccess ? "⚠️ Sem pontuação (prazo encerrado)" : "+20 pontos de fé ao completar"}
              </p>
            </div>
            {!isStudyLocked && <span className="text-secondary font-montserrat font-bold text-lg">→</span>}
          </button>
        )}

        {/* Devocionais */}
        <button onClick={() => setShowDevotionals(true)}
          className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-border shadow-sm text-left hover:bg-brand-green/5 hover:border-brand-green/30 transition-all group">
          <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-green/20 transition-colors">
            <BookOpen className="w-7 h-7 text-brand-green" />
          </div>
          <div className="flex-1">
            <p className="font-montserrat font-bold text-foreground text-base">📖 Devocionais</p>
            <p className="text-muted-foreground font-inter text-xs mt-0.5">
              {loading ? "Carregando..." : totalCount > 0 ? `${completedCount}/${totalCount} concluídos` : `${totalCount} devocional(is)`}
            </p>
            {totalCount > 0 && !loading && (
              <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden w-24">
                <div className="h-full bg-brand-green rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            )}
            <p className="text-muted-foreground font-inter text-[10px] mt-1 italic">
              {isLateAccess ? "⚠️ Sem pontuação (prazo encerrado)" : "Preparação diária antes do encontro"}
            </p>
          </div>
          <span className="text-brand-green font-montserrat font-bold text-lg">→</span>
        </button>

        {/* Estudo — show here when study is already completed or for leaders */}
        {(isStudyCompleted || isLeaderOrAdmin) && (
          <button onClick={() => {
              if (isStudyLocked) return;
              onOpenStudy();
            }}
            className={`flex items-center gap-4 p-5 bg-card rounded-2xl border border-border shadow-sm text-left transition-all group ${
              isStudyLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary/5 hover:border-secondary/30"
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
              isStudyLocked ? "bg-muted" : "bg-secondary/10 group-hover:bg-secondary/20"
            }`}>
              {isStudyLocked ? <Lock className="w-7 h-7 text-muted-foreground" /> : <GraduationCap className="w-7 h-7 text-secondary" />}
            </div>
            <div className="flex-1">
              <p className="font-montserrat font-bold text-foreground text-base">🎓 Estudo da Lição</p>
              {isStudyLocked ? (
                <p className="text-destructive font-inter text-xs mt-0.5">
                  ⏰ Prazo encerrado — disponível apenas durante a semana de preparação
                </p>
              ) : (
                <>
                  <p className="text-muted-foreground font-inter text-xs mt-0.5">
                    Responda as perguntas e registre sua reflexão
                  </p>
                  <p className="text-muted-foreground font-inter text-[10px] mt-1 italic">
                    {isLateAccess ? "⚠️ Sem pontuação (prazo encerrado)" : "+20 pontos de fé ao completar"}
                  </p>
                </>
              )}
            </div>
            {!isStudyLocked && <span className="text-secondary font-montserrat font-bold text-lg">→</span>}
          </button>
        )}

        {/* Editar conteúdo — leaders/admins only */}
        {onOpenEdit && isLeaderOrAdmin && (
          <button onClick={onOpenEdit}
            className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-primary/20 shadow-sm text-left hover:bg-primary/5 hover:border-primary/40 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Pencil className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-montserrat font-bold text-foreground text-base">✏️ Editar Conteúdo da Lição</p>
              <p className="text-muted-foreground font-inter text-xs mt-0.5">
                Editar saudação, perguntas, textos bíblicos e recursos
              </p>
            </div>
            <span className="text-primary font-montserrat font-bold text-lg">→</span>
          </button>
        )}

        {/* Editar devocionais — leaders/admins only */}
        {onOpenEditDevotionals && isLeaderOrAdmin && (
          <button onClick={onOpenEditDevotionals}
            className="flex items-center gap-4 p-5 bg-card rounded-2xl border border-brand-green/20 shadow-sm text-left hover:bg-brand-green/5 hover:border-brand-green/40 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-green/20 transition-colors">
              <Pencil className="w-7 h-7 text-brand-green" />
            </div>
            <div className="flex-1">
              <p className="font-montserrat font-bold text-foreground text-base">✏️ Editar Devocionais</p>
              <p className="text-muted-foreground font-inter text-xs mt-0.5">
                Criar e editar os {totalCount} devocionais desta lição
              </p>
            </div>
            <span className="text-brand-green font-montserrat font-bold text-lg">→</span>
          </button>
        )}
      </div>
    </div>
  );
}

