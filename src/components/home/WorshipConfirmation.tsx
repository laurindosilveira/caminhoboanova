import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getEventEmoji, getEventLabel } from "@/config/eventTypes";

type EventItem = {
  id: string;
  title: string;
  event_date: string;
  type: string;
  location?: string | null;
  community?: string | null;
};

type AttendanceRecord = { event_id: string; status: string };

type Props = {
  events: EventItem[];
  attendanceRecords: AttendanceRecord[];
  onCheckIn: (eventId: string, status: "pendente_presente" | "pendente_falta", justification?: string) => void;
};

const STATUS_CFG: Record<string, { icon: string; label: string; cls: string }> = {
  pendente_presente: { icon: "⏳", label: "Presença aguardando aprovação", cls: "bg-accent/20 text-accent-foreground" },
  pendente_falta:    { icon: "⏳", label: "Justificativa aguardando aprovação", cls: "bg-accent/20 text-accent-foreground" },
  presente:          { icon: "✅", label: "Presença confirmada", cls: "bg-brand-green/10 text-brand-green" },
  justificou:        { icon: "🟡", label: "Falta justificada", cls: "bg-accent/20 text-accent-foreground" },
  faltou:            { icon: "❌", label: "Ausência registrada", cls: "bg-destructive/10 text-destructive" },
};

export default function WorshipConfirmation({ events, attendanceRecords, onCheckIn }: Props) {
  const [justificationOpen, setJustificationOpen] = useState<string | null>(null);
  const [justificationTexts, setJustificationTexts] = useState<Record<string, string>>({});

  const now = new Date();

  // Show events up to 7 days before and 2 days after
  const checkInEvents = events.filter(e => {
    const diffHours = (now.getTime() - new Date(e.event_date).getTime()) / 3600000;
    return diffHours >= -168 && diffHours <= 48;
  });

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-montserrat font-black text-foreground text-base">Confirmar Presença</h3>
          <p className="text-muted-foreground text-xs font-inter">Selecione o evento que você participou</p>
        </div>
      </div>

      {/* Event list */}
      {checkInEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground font-inter text-sm">
          <span className="text-4xl block mb-3">📅</span>
          <p className="font-semibold">Nenhum evento disponível no momento</p>
          <p className="text-xs mt-1 max-w-xs mx-auto">
            Os eventos aparecem aqui até 7 dias antes e 2 dias após sua realização.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkInEvents.map(event => {
            const existing = attendanceRecords.find(a => a.event_id === event.id);
            const statusCfg = existing ? (STATUS_CFG[existing.status] ?? STATUS_CFG.pendente_presente) : null;
            const isJustifying = justificationOpen === event.id;
            const justText = justificationTexts[event.id] ?? "";
            const dateObj = new Date(event.event_date);
            const emoji = getEventEmoji(event.type);
            const label = getEventLabel(event.type);

            return (
              <div key={event.id} className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
                {/* Event info */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                    {emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-sm leading-tight">{event.title}</p>
                    <p className="font-inter text-xs text-muted-foreground mt-0.5">
                      {format(dateObj, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {(event.community || event.location) && (
                      <p className="font-inter text-[10px] text-muted-foreground mt-0.5">
                        {event.community ?? event.location}
                      </p>
                    )}
                    <span className="inline-block mt-1 text-[10px] font-inter font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {label}
                    </span>
                  </div>
                </div>

                {/* Status or action buttons */}
                {existing ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${statusCfg!.cls}`}>
                    <span className="text-sm">{statusCfg!.icon}</span>
                    <span className="font-inter text-xs font-semibold">{statusCfg!.label}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCheckIn(event.id, "pendente_presente")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-green/10 text-brand-green hover:bg-brand-green/20 active:scale-95 transition-all"
                      >
                        <span className="text-sm">✅</span>
                        <span className="font-inter text-xs font-semibold">Confirmar Presença</span>
                      </button>
                      <button
                        onClick={() => setJustificationOpen(isJustifying ? null : event.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all active:scale-95 ${
                          isJustifying
                            ? "bg-accent/30 text-accent-foreground"
                            : "bg-accent/10 text-accent-foreground hover:bg-accent/20"
                        }`}
                      >
                        <span className="text-sm">📝</span>
                        <span className="font-inter text-xs font-semibold">Justificar Falta</span>
                      </button>
                    </div>

                    {isJustifying && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <textarea
                          value={justText}
                          onChange={e =>
                            setJustificationTexts(prev => ({ ...prev, [event.id]: e.target.value }))
                          }
                          placeholder="Descreva o motivo da ausência..."
                          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                          rows={2}
                          maxLength={300}
                        />
                        <button
                          onClick={() => {
                            onCheckIn(event.id, "pendente_falta", justText || undefined);
                            setJustificationOpen(null);
                          }}
                          disabled={!justText.trim()}
                          className="w-full py-2 rounded-xl bg-accent/15 text-accent-foreground hover:bg-accent/25 transition-colors font-inter text-xs font-semibold disabled:opacity-50"
                        >
                          Enviar justificativa
                        </button>
                      </div>
                    )}
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
