import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Trash2, ChevronRight, BookOpen, Calendar, Church, Trophy, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  // For deletion
  tableId?: string;
}

export default function PlayerDetailSheet({ userId, fullName, onClose, onPointsChanged }: Props) {
  const { role } = useAuth();
  const canDelete = role === "admin" || role === "lider";
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<any>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);

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
    ]);

    const lessonMap = new Map((lessons ?? []).map(l => [l.id, l]));
    const devMap = new Map((devContent ?? []).map(d => [d.id, d]));
    const eventMap = new Map((events ?? []).map(e => [e.id, e]));
    const actMap = new Map((activities ?? []).map(a => [a.id, a]));

    const allItems: ActivityItem[] = [];

    // Lessons (group by lesson_id, show once per lesson)
    const lessonIds = new Set((lessonResps ?? []).map(r => r.lesson_id));
    lessonIds.forEach(lessonId => {
      const lesson = lessonMap.get(lessonId);
      const firstResp = (lessonResps ?? []).find(r => r.lesson_id === lessonId);
      allItems.push({
        id: `lesson-${lessonId}`,
        type: "lesson",
        title: lesson?.title ?? "Lição",
        subtitle: "Estudo de lição",
        points: 20,
        date: firstResp?.created_at ?? "",
        deletable: true,
        tableId: lessonId,
      });
    });

    // Devotionals
    (devProgress ?? []).forEach(dp => {
      const dev = devMap.get(dp.devotional_id);
      const dow = new Date(dp.completed_at).getDay();
      const pts = dow === 0 || dow === 6 ? 2 : 5;
      allItems.push({
        id: `dev-${dp.id}`,
        type: "devotional",
        title: dev?.title || `Devocional dia ${dev?.day_number ?? "?"}`,
        subtitle: pts === 2 ? "Recuperado no fim de semana" : "Devocional diário",
        points: pts,
        date: dp.completed_at,
        deletable: true,
        tableId: dp.id,
      });
    });

    // Attendance
    (attendance ?? []).forEach(a => {
      const event = eventMap.get(a.event_id);
      allItems.push({
        id: `att-${a.id}`,
        type: "attendance",
        title: event?.title ?? "Encontro",
        subtitle: event?.event_date ? format(new Date(event.event_date), "d 'de' MMM", { locale: ptBR }) : "",
        points: 10,
        date: a.created_at,
        deletable: true,
        tableId: a.id,
      });
    });

    // Worship
    (worship ?? []).forEach(w => {
      allItems.push({
        id: `wor-${w.id}`,
        type: "worship",
        title: `Culto — ${w.preacher_name}`,
        subtitle: `${format(new Date(w.worship_date), "d/MM/yyyy")} às ${w.worship_time}`,
        points: 5,
        date: w.created_at,
        deletable: true,
        tableId: w.id,
      });
    });

    // Achievements
    (achievements ?? []).forEach(a => {
      allItems.push({
        id: `ach-${a.id}`,
        type: "achievement",
        title: `Conquista: ${a.achievement_key}`,
        subtitle: "Bônus de conquista",
        points: a.bonus_points,
        date: a.unlocked_at,
        deletable: true,
        tableId: a.id,
      });
    });

    // User progress (other activities)
    (userProgress ?? []).forEach(up => {
      const act = actMap.get(up.activity_id);
      if (act && act.type !== "devocional" && act.type !== "formacao" && act.type !== "encontro") {
        allItems.push({
          id: `act-${up.id}`,
          type: "activity",
          title: act.title,
          subtitle: "Atividade extra",
          points: act.points ?? 0,
          date: up.completed_at,
          deletable: true,
          tableId: up.id,
        });
      }
    });

    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(allItems);
    setTotalPoints(allItems.reduce((s, i) => s + i.points, 0));
    setLoading(false);
  }

  async function handleExpand(item: ActivityItem) {
    if (expandedItem === item.id) {
      setExpandedItem(null);
      setExpandedContent(null);
      return;
    }
    setExpandedItem(item.id);
    setLoadingContent(true);

    if (item.type === "lesson" && item.tableId) {
      const { data } = await supabase
        .from("lesson_responses")
        .select("question_key, response")
        .eq("user_id", userId)
        .eq("lesson_id", item.tableId);
      setExpandedContent(data ?? []);
    } else if (item.type === "devotional" && item.tableId) {
      const { data } = await supabase
        .from("devotional_content")
        .select("bible_reference, reflection, practice")
        .eq("id", (await supabase.from("devotional_progress").select("devotional_id").eq("id", item.tableId).single()).data?.devotional_id ?? "")
        .single();
      setExpandedContent(data);
    } else {
      setExpandedContent(null);
    }
    setLoadingContent(false);
  }

  async function handleDelete(item: ActivityItem) {
    if (!confirm(`Remover "${item.title}" e descontar ${item.points} pontos?`)) return;
    setDeleting(item.id);

    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      // Delete from source table
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

      // Log removal
      await supabase.from("activity_removal_log").insert({
        removed_by: user?.id ?? "",
        target_user_id: userId,
        activity_type: item.type,
        activity_id: item.tableId ?? item.id,
        activity_title: item.title,
        points_removed: item.points,
        notes: `Removido via relatório de pontuação`,
      });

      setItems(prev => prev.filter(i => i.id !== item.id));
      setTotalPoints(prev => prev - item.points);
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

  // Group by type for summary
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = { count: 0, points: 0 };
    acc[item.type].count++;
    acc[item.type].points += item.points;
    return acc;
  }, {} as Record<string, { count: number; points: number }>);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <p className="font-montserrat font-bold text-foreground text-base">{fullName}</p>
            <p className="text-muted-foreground font-inter text-xs">{totalPoints} pontos · {items.length} atividades</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
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

        {/* Activity list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground font-inter text-sm py-8">Nenhuma atividade pontuada.</p>
          ) : (
            items.map(item => (
              <div key={item.id}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    expandedItem === item.id ? "bg-primary/5 border border-primary/20" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                  onClick={() => handleExpand(item)}
                >
                  <div className="flex-shrink-0">{typeIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm text-foreground font-medium truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-muted-foreground text-[10px] font-inter">{item.subtitle}</p>
                    )}
                    <p className="text-muted-foreground text-[10px] font-inter">
                      {item.date ? format(new Date(item.date), "d/MM/yy HH:mm") : ""}
                    </p>
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
                  <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${expandedItem === item.id ? "rotate-90" : ""}`} />
                </div>

                {/* Expanded content */}
                {expandedItem === item.id && (
                  <div className="ml-10 mt-1 p-3 bg-muted/20 rounded-xl border border-border text-xs font-inter space-y-1">
                    {loadingContent ? (
                      <div className="h-8 bg-muted rounded animate-pulse" />
                    ) : item.type === "lesson" && Array.isArray(expandedContent) ? (
                      expandedContent.length > 0 ? (
                        expandedContent.map((r: any, i: number) => (
                          <div key={i}>
                            <p className="text-muted-foreground font-bold">{r.question_key}</p>
                            <p className="text-foreground">{r.response || <span className="italic text-muted-foreground">Sem resposta</span>}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground italic">Sem respostas registradas.</p>
                      )
                    ) : item.type === "devotional" && expandedContent ? (
                      <div>
                        <p className="text-muted-foreground font-bold">📖 {expandedContent.bible_reference}</p>
                        {expandedContent.reflection && <p className="text-foreground mt-1">{expandedContent.reflection.slice(0, 200)}...</p>}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">Detalhes da atividade: {typeLabel(item.type)}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
