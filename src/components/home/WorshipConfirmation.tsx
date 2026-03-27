import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, User, Send, CheckCircle2, XCircle, Clock as ClockIcon, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type WorshipRecord = {
  id: string;
  worship_date: string;
  worship_time: string;
  preacher_name: string;
  status: string;
  event_type: string;
  created_at: string;
};

const EVENT_TYPE_OPTIONS = [
  { value: "culto", label: "Culto", emoji: "⛪" },
  { value: "jemiac", label: "JEMIAC", emoji: "✝️" },
  { value: "retiro", label: "Retiro", emoji: "🏕️" },
];

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "14:00", "15:00", "17:00", "18:00", "19:00", "19:30", "20:00",
];

export default function WorshipConfirmation() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [preacher, setPreacher] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<WorshipRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, []);

  async function fetchRecords() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("worship_attendance")
      .select("id, worship_date, worship_time, preacher_name, status, event_type, created_at")
      .eq("user_id", user.id)
      .order("worship_date", { ascending: false })
      .limit(20);
    setRecords(data ?? []);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!eventType || !date || !time || !preacher.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Você precisa estar logado", description: "Faça login para confirmar sua presença.", variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("worship_attendance").insert({
      user_id: user.id,
      worship_date: format(date, "yyyy-MM-dd"),
      worship_time: time,
      preacher_name: preacher.trim(),
      event_type: eventType,
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Presença enviada! 🙌", description: "Aguarde a confirmação do líder da turma." });
      setShowForm(false);
      setDate(undefined);
      setTime("");
      setPreacher("");
      setEventType("");
      fetchRecords();
    }
    setSubmitting(false);
  }

  const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pendente: { label: "Pendente", color: "text-accent-foreground", bg: "bg-accent/20", icon: <ClockIcon className="w-3 h-3" /> },
    aprovado: { label: "Aprovado", color: "text-brand-green", bg: "bg-brand-green/10", icon: <CheckCircle2 className="w-3 h-3" /> },
    rejeitado: { label: "Rejeitado", color: "text-destructive", bg: "bg-destructive/10", icon: <XCircle className="w-3 h-3" /> },
  };

  const getTypeInfo = (type: string) => EVENT_TYPE_OPTIONS.find(e => e.value === type) ?? EVENT_TYPE_OPTIONS[0];

  return (
    <div className="px-5 py-4 space-y-4">
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
        onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-montserrat font-bold text-sm text-primary-foreground transition-all hover:opacity-90"
        style={{ background: "var(--gradient-hero)" }}
      >
        <CalendarDays className="w-4 h-4" />
        {showForm ? "Cancelar" : "Confirmar presença em evento"}
      </button>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
          <p className="font-montserrat font-bold text-foreground text-sm">📋 Dados do Evento</p>

          {/* Event type selector */}
          <div className="space-y-1.5">
            <label className="font-inter text-xs font-medium text-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-primary" /> Tipo de evento
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPE_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setEventType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium border transition-all ${
                    eventType === t.value
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
          <div className="space-y-1.5">
            <label className="font-inter text-xs font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Data do evento
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl border border-border bg-background font-inter text-sm transition-colors hover:border-primary/50",
                  !date && "text-muted-foreground"
                )}>
                  {date ? format(date, "d 'de' MMMM yyyy", { locale: ptBR }) : "Selecione a data"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d > new Date()}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time selector */}
          <div className="space-y-1.5">
            <label className="font-inter text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Horário
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TIME_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium border transition-all ${
                    time === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Preacher/leader name */}
          <div className="space-y-1.5">
            <label className="font-inter text-xs font-medium text-foreground flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" /> Pregador / Líder do evento
            </label>
            <input
              value={preacher}
              onChange={e => setPreacher(e.target.value)}
              placeholder="Ex: Pastor Laurindo"
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !eventType || !date || !time || !preacher.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-montserrat font-bold text-sm text-primary-foreground disabled:opacity-50 transition-all"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Send className="w-4 h-4" />
            {submitting ? "Enviando..." : "Enviar confirmação"}
          </button>
        </div>
      )}

      {/* History */}
      {!loading && records.length > 0 && (
        <div className="space-y-2">
          <p className="font-montserrat font-bold text-foreground text-sm">Histórico</p>
          {records.map(r => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.pendente;
            const typeInfo = getTypeInfo(r.event_type);
            return (
              <div key={r.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                <span className="text-lg">{typeInfo.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm font-medium text-foreground">
                    {typeInfo.label} · {new Date(r.worship_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {r.worship_time}
                  </p>
                  <p className="font-inter text-[10px] text-muted-foreground">Pregador: {r.preacher_name}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-inter font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && records.length === 0 && !showForm && (
        <div className="text-center py-6 text-muted-foreground font-inter text-sm">
          <span className="text-3xl block mb-2">📅</span>
          <p>Nenhuma confirmação de evento registrada.</p>
          <p className="text-xs mt-1">Clique acima para confirmar sua presença!</p>
        </div>
      )}
    </div>
  );
}
