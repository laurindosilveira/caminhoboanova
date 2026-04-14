import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Send, CheckCircle2, XCircle, Clock as ClockIcon, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EVENT_TYPES, getEventEmoji, getEventLabel } from "@/config/eventTypes";
import { useToast } from "@/hooks/use-toast";

type EventItem = {
  id: string;
  title: string;
  event_date: string;
  type: string;
  location?: string | null;
  community?: string | null;
};

type AttendanceRecord = { event_id: string; status: string };

type WorshipRecord = {
  id: string;
  worship_date: string;
  worship_time: string;
  preacher_name: string;
  status: string;
  event_type: string;
};

type Props = {
  events: EventItem[];
  attendanceRecords: AttendanceRecord[];
  onCheckIn: (eventId: string, status: "pendente_presente" | "pendente_falta", justification?: string) => void;
};

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "14:00", "15:00", "17:00", "18:00", "19:00", "19:30", "20:00",
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendente:  { label: "Pendente",  color: "text-accent-foreground", bg: "bg-accent/20",      icon: <ClockIcon className="w-3 h-3" /> },
  aprovado:  { label: "Aprovado",  color: "text-brand-green",       bg: "bg-brand-green/10", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejeitado: { label: "Rejeitado", color: "text-destructive",       bg: "bg-destructive/10", icon: <XCircle className="w-3 h-3" /> },
};

const ATT_STATUS_CFG: Record<string, { icon: string; label: string; cls: string }> = {
  pendente_presente: { icon: "⏳", label: "Aguardando aprovação",          cls: "bg-accent/20 text-accent-foreground" },
  pendente_falta:    { icon: "⏳", label: "Justificativa aguardando",       cls: "bg-accent/20 text-accent-foreground" },
  presente:          { icon: "✅", label: "Presença confirmada",            cls: "bg-brand-green/10 text-brand-green" },
  justificou:        { icon: "🟡", label: "Falta justificada",              cls: "bg-accent/20 text-accent-foreground" },
  faltou:            { icon: "❌", label: "Ausência registrada",            cls: "bg-destructive/10 text-destructive" },
};

export default function WorshipConfirmation({ events, attendanceRecords, onCheckIn }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Selected agenda event
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showJustification, setShowJustification] = useState(false);
  const [justificationText, setJustificationText] = useState("");

  // Manual form (if event not in list)
  const [showManual, setShowManual] = useState(false);
  const [manualType, setManualType] = useState("");
  const [manualDate, setManualDate] = useState<Date | undefined>();
  const [manualTime, setManualTime] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  // Past worship_attendance records (manual)
  const [worshipRecords, setWorshipRecords] = useState<WorshipRecord[]>([]);
  const [loadedRecords, setLoadedRecords] = useState(false);

  const now = new Date();

  // Only show events that have already happened (up to 14 days back).
  // Event stays visible until user confirms or justifies — status badge shown after action.
  const checkInEvents = events.filter(e => {
    const diffHours = (now.getTime() - new Date(e.event_date).getTime()) / 3600000;
    return diffHours >= 0 && diffHours <= 336; // 0h to 14 days after event
  });

  async function openModal() {
    setOpen(true);
    setSelectedEventId(null);
    setShowJustification(false);
    setJustificationText("");
    setShowManual(false);

    if (!loadedRecords) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("worship_attendance")
          .select("id, worship_date, worship_time, preacher_name, status, event_type")
          .eq("user_id", user.id)
          .order("worship_date", { ascending: false })
          .limit(10);
        setWorshipRecords(data ?? []);
        setLoadedRecords(true);
      }
    }
  }

  function handleSelectEvent(id: string) {
    setSelectedEventId(id);
    setShowJustification(false);
    setJustificationText("");
    setShowManual(false);
  }

  function handleConfirm() {
    if (!selectedEventId) return;
    onCheckIn(selectedEventId, "pendente_presente");
    setOpen(false);
    reset();
  }

  function handleJustify() {
    if (!selectedEventId) return;
    onCheckIn(selectedEventId, "pendente_falta", justificationText || undefined);
    setOpen(false);
    reset();
  }

  async function handleManualSubmit() {
    if (!manualType || !manualDate || !manualTime) {
      toast({ title: "Selecione o tipo de evento, a data e o horário", variant: "destructive" });
      return;
    }
    setSubmittingManual(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmittingManual(false); return; }

    const { error } = await supabase.from("worship_attendance").insert({
      user_id: user.id,
      worship_date: format(manualDate, "yyyy-MM-dd"),
      worship_time: manualTime,
      preacher_name: getEventLabel(manualType),
      event_type: manualType,
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Presença enviada!", description: "Aguarde a confirmação do líder da turma." });
      setOpen(false);
      reset();
      setLoadedRecords(false); // refresh on next open
    }
    setSubmittingManual(false);
  }

  function reset() {
    setSelectedEventId(null);
    setShowJustification(false);
    setJustificationText("");
    setShowManual(false);
    setManualType("");
    setManualDate(undefined);
    setManualTime("");
  }

  const selectedEvent = checkInEvents.find(e => e.id === selectedEventId);
  const existingRecord = selectedEventId
    ? attendanceRecords.find(a => a.event_id === selectedEventId)
    : null;

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-montserrat font-black text-foreground text-base">Presença em Eventos</h3>
          <p className="text-muted-foreground text-xs font-inter">Confirme sua participação em eventos</p>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={openModal}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-montserrat font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-95"
        style={{ background: "var(--gradient-hero)" }}
      >
        <CalendarDays className="w-4 h-4" />
        Confirmar presença em evento
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); reset(); } }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="font-montserrat font-black text-foreground text-base">
              Confirmar Presença
            </DialogTitle>
            <p className="text-muted-foreground text-xs font-inter mt-0.5">
              Selecione o evento que você participou
            </p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

            {/* Event list */}
            {checkInEvents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground font-inter text-sm">
                <span className="text-3xl block mb-2">📅</span>
                <p className="font-semibold text-foreground">Nenhum evento recente</p>
                <p className="text-xs mt-1">Use o campo abaixo para enviar manualmente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-inter text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Eventos disponíveis
                </p>
                {checkInEvents.map(event => {
                  const attRecord = attendanceRecords.find(a => a.event_id === event.id);
                  const isSelected = selectedEventId === event.id;
                  const dateObj = new Date(event.event_date);

                  return (
                    <button
                      key={event.id}
                      onClick={() => handleSelectEvent(event.id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
                        {getEventEmoji(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-montserrat font-bold text-foreground text-sm leading-tight truncate">
                          {event.title}
                        </p>
                        <p className="font-inter text-xs text-muted-foreground mt-0.5">
                          {format(dateObj, "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {attRecord && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-inter font-semibold px-2 py-0.5 rounded-full mt-1 ${ATT_STATUS_CFG[attRecord.status]?.cls ?? ""}`}>
                            {ATT_STATUS_CFG[attRecord.status]?.icon} {ATT_STATUS_CFG[attRecord.status]?.label}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actions for selected event */}
            {selectedEvent && !existingRecord && (
              <div className="space-y-2 pt-1">
                <p className="font-inter text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sua participação em "{selectedEvent.title}"
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-brand-green/10 text-brand-green hover:bg-brand-green/20 active:scale-95 transition-all font-inter text-sm font-semibold"
                  >
                    ✅ Confirmar Presença
                  </button>
                  <button
                    onClick={() => setShowJustification(v => !v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 font-inter text-sm font-semibold ${
                      showJustification
                        ? "bg-accent/30 text-accent-foreground"
                        : "bg-accent/10 text-accent-foreground hover:bg-accent/20"
                    }`}
                  >
                    📝 Justificar Falta
                  </button>
                </div>
                {showJustification && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <textarea
                      value={justificationText}
                      onChange={e => setJustificationText(e.target.value)}
                      placeholder="Descreva o motivo da ausência..."
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      rows={3}
                      maxLength={300}
                    />
                    <button
                      onClick={handleJustify}
                      disabled={!justificationText.trim()}
                      className="w-full py-3 rounded-2xl bg-accent/15 text-accent-foreground hover:bg-accent/25 transition-colors font-inter text-sm font-semibold disabled:opacity-50"
                    >
                      Enviar justificativa
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedEvent && existingRecord && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${ATT_STATUS_CFG[existingRecord.status]?.cls ?? ""}`}>
                <span>{ATT_STATUS_CFG[existingRecord.status]?.icon}</span>
                <span className="font-inter text-sm font-semibold">{ATT_STATUS_CFG[existingRecord.status]?.label}</span>
              </div>
            )}

            {/* Manual fallback */}
            <div className="border-t border-border pt-4">
              <button
                onClick={() => setShowManual(v => !v)}
                className="w-full flex items-center justify-between py-2 text-sm font-inter text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Evento não está na lista?</span>
                <ChevronRight className={`w-4 h-4 transition-transform ${showManual ? "rotate-90" : ""}`} />
              </button>

              {showManual && (
                <div className="space-y-4 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Event type */}
                  <div>
                    <label className="font-inter text-xs font-medium text-foreground mb-1.5 block">Tipo de evento *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {EVENT_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setManualType(t.value)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-inter font-medium border transition-all ${
                            manualType === t.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date picker */}
                  <div>
                    <label className="font-inter text-xs font-medium text-foreground mb-1.5 block">Data do evento *</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl border border-border bg-background font-inter text-sm transition-colors hover:border-primary/50",
                          !manualDate && "text-muted-foreground"
                        )}>
                          {manualDate
                            ? format(manualDate, "d 'de' MMMM yyyy", { locale: ptBR })
                            : "Selecione a data"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={manualDate}
                          onSelect={setManualDate}
                          disabled={(d) => d > new Date()}
                          className={cn("p-3 pointer-events-auto")}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time */}
                  <div>
                    <label className="font-inter text-xs font-medium text-foreground mb-1.5 block">Horário *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_OPTIONS.map(t => (
                        <button
                          key={t}
                          onClick={() => setManualTime(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium border transition-all ${
                            manualTime === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleManualSubmit}
                    disabled={submittingManual || !manualType || !manualDate || !manualTime}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-montserrat font-bold text-sm text-primary-foreground disabled:opacity-50 transition-all active:scale-95"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    <Send className="w-4 h-4" />
                    {submittingManual ? "Enviando..." : "Enviar confirmação"}
                  </button>
                </div>
              )}
            </div>

            {/* Worship attendance history */}
            {worshipRecords.length > 0 && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="font-inter text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Histórico (envios manuais)
                </p>
                {worshipRecords.map(r => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pendente;
                  return (
                    <div key={r.id} className="bg-muted/30 rounded-xl border border-border p-3 flex items-center gap-3">
                      <span className="text-lg">{getEventEmoji(r.event_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter text-sm font-medium text-foreground truncate">{r.preacher_name}</p>
                        <p className="font-inter text-[10px] text-muted-foreground">
                          {new Date(r.worship_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {r.worship_time}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-inter font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
