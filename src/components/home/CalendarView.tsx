import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type Event = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  type: string;
};

const EVENT_TYPES: Record<string, { label: string; dot: string; emoji: string }> = {
  encontro:      { label: "Encontro",          dot: "bg-primary",       emoji: "📅" },
  culto:         { label: "Culto",             dot: "bg-brand-green",   emoji: "⛪" },
  jemiac:        { label: "JEMIAC",            dot: "bg-secondary",     emoji: "✝️" },
  retiro:        { label: "Retiro",            dot: "bg-secondary",     emoji: "🏕️" },
  confirmatorio: { label: "Ens. Confirmatório", dot: "bg-primary",      emoji: "📖" },
  evento:        { label: "Evento",            dot: "bg-accent",        emoji: "🎉" },
  conversa:      { label: "Conversa Pastoral", dot: "bg-secondary",     emoji: "💬" },
};

const ALL_TYPES = Object.keys(EVENT_TYPES);

interface Props {
  events: Event[];
}

export default function CalendarView({ events }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [filterType, setFilterType] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    if (!filterType) return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  // Build map of date -> events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    filteredEvents.forEach(e => {
      const d = new Date(e.event_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    });
    return map;
  }, [filteredEvents]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad the start for the day of week (Monday = 0)
  const startDow = (getDay(monthStart) + 6) % 7; // Convert Sun=0 to Mon=0
  const paddingDays = Array.from({ length: startDow }, (_, i) => null);

  const eventsForSelectedDay = useMemo(() => {
    if (!selectedDay) return [];
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
    return (eventsByDate.get(key) || []).sort(
      (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
  }, [selectedDay, eventsByDate]);

  // Count events per type in current month for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const d = new Date(e.event_date);
      if (isSameMonth(d, currentMonth)) {
        counts[e.type] = (counts[e.type] || 0) + 1;
      }
    });
    return counts;
  }, [events, currentMonth]);

  const activeTypes = ALL_TYPES.filter(t => typeCounts[t]);

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h3 className="font-montserrat font-black text-foreground text-base capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <button
          onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Filter chips */}
      {activeTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType(null)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-montserrat font-bold transition-colors ${
              !filterType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos ({events.filter(e => isSameMonth(new Date(e.event_date), currentMonth)).length})
          </button>
          {activeTypes.map(type => {
            const info = EVENT_TYPES[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? null : type)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-montserrat font-bold transition-colors flex items-center gap-1 ${
                  filterType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span>{info?.emoji}</span>
                {info?.label} ({typeCounts[type]})
              </button>
            );
          })}
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
            <div key={d} className="py-2 text-center">
              <span className="text-[10px] font-montserrat font-bold text-muted-foreground uppercase">{d}</span>
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}
          {daysInMonth.map(day => {
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayEvents = eventsByDate.get(key) || [];
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasEvents = dayEvents.length > 0;

            // Get unique type dots (max 3)
            const uniqueTypes = [...new Set(dayEvents.map(e => e.type))].slice(0, 3);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  isSelected
                    ? "bg-primary/15"
                    : isToday
                    ? "bg-secondary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className={`text-xs font-montserrat font-bold ${
                  isSelected
                    ? "text-primary"
                    : isToday
                    ? "text-secondary font-black"
                    : "text-foreground"
                }`}>
                  {day.getDate()}
                </span>
                {hasEvents && (
                  <div className="flex gap-0.5">
                    {uniqueTypes.map(type => (
                      <span
                        key={type}
                        className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPES[type]?.dot || "bg-muted-foreground"}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div className="space-y-2">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {isSameDay(selectedDay, new Date()) ? "📍 Hoje" : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          {eventsForSelectedDay.length === 0 ? (
            <div className="bg-muted/30 rounded-2xl p-4 text-center">
              <p className="text-muted-foreground font-inter text-xs">Nenhum evento neste dia</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventsForSelectedDay.map(event => {
                const info = EVENT_TYPES[event.type] || EVENT_TYPES.evento;
                const d = new Date(event.event_date);
                return (
                  <div key={event.id} className="bg-card rounded-2xl border border-border p-3.5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${info.dot}/10`}>
                        <span className="text-lg">{info.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-montserrat font-bold px-2 py-0.5 rounded-full ${info.dot}/10 text-foreground`}>
                            {info.label}
                          </span>
                        </div>
                        <p className="font-montserrat font-bold text-foreground text-sm">{event.title}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-inter">
                            <Clock className="w-3 h-3" />
                            {format(d, "HH:mm")}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-inter">
                              <MapPin className="w-3 h-3" />
                              {event.location}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-muted-foreground font-inter text-xs mt-1.5 leading-relaxed">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
