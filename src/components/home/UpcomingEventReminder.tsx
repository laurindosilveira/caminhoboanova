import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, X, ChevronRight } from "lucide-react";

type Props = {
  onNavigateToAgenda: () => void;
};

export default function UpcomingEventReminder({ onNavigateToAgenda }: Props) {
  const [event, setEvent] = useState<{ title: string; event_date: string; location: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 2); // Look 2 days ahead

      const { data } = await supabase
        .from("events")
        .select("title, event_date, location")
        .gte("event_date", now.toISOString())
        .lte("event_date", tomorrow.toISOString())
        .order("event_date")
        .limit(1);

      if (data && data.length > 0) {
        setEvent(data[0]);
      }
      setLoading(false);
    }
    check();
  }, []);

  if (loading || dismissed || !event) return null;

  const eventDate = new Date(event.event_date);
  const nowMs = Date.now();
  const diffMs = eventDate.getTime() - nowMs;
  const diffHours = Math.max(0, Math.floor(diffMs / 3600000));
  const diffMins = Math.max(0, Math.floor((diffMs % 3600000) / 60000));

  const isToday = eventDate.toDateString() === new Date().toDateString();
  const isTomorrow = (() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return eventDate.toDateString() === tom.toDateString();
  })();
  const dateLabel = isToday ? "Hoje" : isTomorrow ? "Amanhã" : eventDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = eventDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Countdown label
  const countdownLabel = diffMs <= 0
    ? "🔴 Acontecendo agora!"
    : diffHours >= 24
    ? `🔔 Faltam ${Math.floor(diffHours / 24)} dia${Math.floor(diffHours / 24) > 1 ? "s" : ""} e ${diffHours % 24}h`
    : diffHours >= 1
    ? `🔔 Faltam ${diffHours}h${diffMins > 0 ? ` e ${diffMins}min` : ""}`
    : `🔔 Faltam ${diffMins} minutos!`;

  const isUrgent = diffHours < 6;

  return (
    <div className="mx-5 mb-3 rounded-2xl border border-secondary/30 bg-secondary/5 p-4 relative overflow-hidden">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="font-montserrat font-bold text-foreground text-sm">
            📅 {dateLabel} às {timeLabel}
          </p>
          <p className="text-foreground font-inter text-xs font-medium mt-0.5">{event.title}</p>
          {event.location && (
            <p className="text-muted-foreground font-inter text-[10px] mt-0.5">📍 {event.location}</p>
          )}
          <p className={`font-inter text-[10px] mt-1 font-semibold ${isUrgent ? "text-destructive" : "text-secondary"}`}>
            {countdownLabel}
          </p>
        </div>
      </div>

      <button
        onClick={onNavigateToAgenda}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary/15 text-secondary font-inter text-xs font-semibold hover:bg-secondary/25 transition-colors"
      >
        Ver Agenda
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
