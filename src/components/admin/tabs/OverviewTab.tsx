import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, ChevronRight, Calendar, BookOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Activity = { id: string; type: string; title: string; points: number; order_num: number; subtitle: string | null };
type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  completed_lesson_count?: number;
  completed_devotional_count?: number;
  completed_event_count?: number;
  faith_points?: number;
};
type PlanInfo = { health_status: string; is_priority: boolean; needs_pastor?: boolean };

type Props = {
  participants: Participant[];
  activities: Activity[];
  plans: Record<string, PlanInfo>;
  onSelectParticipant: (p: Participant) => void;
};

type EventInfo = { id: string; title: string; event_date: string; type: string };
type AttendanceEntry = { user_id: string; status: string };

function whatsappUrl(phone: string): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 ${s}`}>
      <span className="font-montserrat font-black text-primary">{name.charAt(0)}</span>
    </div>
  );
}

export default function OverviewTab({ participants, activities, plans, onSelectParticipant }: Props) {
  const { profile } = useAuth();

  const [lastActivity, setLastActivity] = useState<Record<string, Date | null>>({});
  const [weeklyDevCount, setWeeklyDevCount] = useState<Record<string, number>>({});
  const [lastEvent, setLastEvent] = useState<EventInfo | null>(null);
  const [lastEventAttendance, setLastEventAttendance] = useState<AttendanceEntry[]>([]);
  const [nextEvent, setNextEvent] = useState<EventInfo | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const myArea = profile?.area || participants[0]?.area || "";
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ids = participants.map(p => p.user_id);

  useEffect(() => {
    if (!myArea) { setLoadingData(false); return; }
    async function fetchData() {
      setLoadingData(true);
      const queries: Promise<any>[] = [
        supabase.from("events").select("id, title, event_date, type")
          .eq("area", myArea as any)
          .lt("event_date", now.toISOString())
          .order("event_date", { ascending: false })
          .limit(1),
        supabase.from("events").select("id, title, event_date, type")
          .eq("area", myArea as any)
          .gt("event_date", now.toISOString())
          .order("event_date", { ascending: true })
          .limit(1),
      ];

      if (ids.length > 0) {
        queries.push(
          supabase.from("devotional_progress").select("user_id, completed_at").in("user_id", ids),
          supabase.from("user_progress").select("user_id, completed_at").in("user_id", ids),
        );
      }

      const results = await Promise.all(queries);
      const lastEvData = results[0]?.data;
      const nextEvData = results[1]?.data;
      const devData = results[2]?.data ?? [];
      const progressData = results[3]?.data ?? [];

      // Last activity per user
      const actMap: Record<string, Date | null> = {};
      ids.forEach(id => { actMap[id] = null; });
      (devData as { user_id: string; completed_at: string }[]).forEach(d => {
        const dt = new Date(d.completed_at);
        if (!actMap[d.user_id] || dt > actMap[d.user_id]!) actMap[d.user_id] = dt;
      });
      (progressData as { user_id: string; completed_at: string }[]).forEach(p => {
        const dt = new Date(p.completed_at);
        if (!actMap[p.user_id] || dt > actMap[p.user_id]!) actMap[p.user_id] = dt;
      });
      setLastActivity(actMap);

      // Weekly devotionals
      const weekMap: Record<string, number> = {};
      (devData as { user_id: string; completed_at: string }[]).forEach(d => {
        if (new Date(d.completed_at) >= sevenDaysAgo) {
          weekMap[d.user_id] = (weekMap[d.user_id] || 0) + 1;
        }
      });
      setWeeklyDevCount(weekMap);

      // Last event
      const ev: EventInfo | null = lastEvData?.[0] ?? null;
      setLastEvent(ev);
      if (ev) {
        const { data: attData, error: attError } = await supabase
          .from("attendance")
          .select("user_id, status")
          .eq("event_id", ev.id);
        if (attError) toast.error("Erro ao carregar presença do último encontro.");
        setLastEventAttendance(attData ?? []);
      }

      setNextEvent(nextEvData?.[0] ?? null);
      setLoadingData(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length, myArea]);

  // Derived data
  const activeThisWeek = Object.keys(weeklyDevCount).length;

  // People who need attention: inactive 7+ days OR needs_pastor
  const contactList = participants
    .map(p => {
      const last = lastActivity[p.user_id];
      const days = last !== undefined ? (last ? differenceInDays(now, last) : null) : undefined;
      const needsPastor = plans[p.user_id]?.needs_pastor ?? false;
      const reasons: { label: string; urgent: boolean }[] = [];
      if (needsPastor) reasons.push({ label: "Pediu conversa pastoral", urgent: true });
      if (days === undefined) return null; // data still loading
      if (days === null) reasons.push({ label: "Nunca teve atividade", urgent: true });
      else if (days >= 14) reasons.push({ label: `${days} dias sem atividade`, urgent: true });
      else if (days >= 7) reasons.push({ label: `${days} dias sem atividade`, urgent: false });
      if (reasons.length === 0) return null;
      return { ...p, days, needsPastor, reasons };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => {
      if (a.needsPastor !== b.needsPastor) return a.needsPastor ? -1 : 1;
      const da = a.days ?? 9999;
      const db = b.days ?? 9999;
      return db - da;
    });

  // Last event attendance
  const presentIds = new Set(
    lastEventAttendance
      .filter(a => a.status === "presente" || a.status === "pendente_presente")
      .map(a => a.user_id)
  );
  const presentParticipants = participants.filter(p => presentIds.has(p.user_id));
  const absentParticipants = lastEvent ? participants.filter(p => !presentIds.has(p.user_id)) : [];

  // All participants sorted by last activity (most inactive first)
  const sortedParticipants = [...participants].sort((a, b) => {
    const da = lastActivity[a.user_id];
    const db = lastActivity[b.user_id];
    if (da === undefined && db === undefined) return 0;
    if (da == null) return -1;
    if (db == null) return 1;
    return da.getTime() - db.getTime();
  });

  if (loadingData && participants.length > 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">

      {/* ── HERO ── */}
      <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }} />
        <p className="text-primary-foreground/60 font-inter text-xs mb-1">Visão geral da área</p>
        <h2 className="font-montserrat font-black text-primary-foreground text-xl mb-3">
          Painel do Discipulador
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total na área", value: participants.length },
            { label: "Ativos esta semana", value: activeThisWeek },
            { label: "Precisam de atenção", value: contactList.length },
          ].map(s => (
            <div key={s.label} className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
              <p className="font-montserrat font-black text-primary-foreground text-xl leading-none">{s.value}</p>
              <p className="text-primary-foreground/50 text-[9px] font-inter mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUEM CONTATAR ── */}
      {contactList.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-montserrat font-bold text-foreground text-sm">Contatar agora</p>
            <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
              {contactList.length} aluno{contactList.length !== 1 ? "s" : ""} precisam de atenção
            </p>
          </div>
          <div className="divide-y divide-border">
            {contactList.map(p => {
              const wa = whatsappUrl(p.phone);
              return (
                <div key={p.user_id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => onSelectParticipant(p)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <Avatar name={p.full_name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-inter text-sm font-medium text-foreground truncate">{p.full_name}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {p.reasons.map((r, i) => (
                          <span
                            key={i}
                            className={`text-[10px] font-inter font-medium px-1.5 py-0.5 rounded-full ${
                              r.urgent
                                ? "bg-destructive/10 text-destructive"
                                : "bg-accent/20 text-accent-foreground"
                            }`}
                          >
                            {r.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="w-9 h-9 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 hover:bg-brand-green/20 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-brand-green" />
                    </a>
                  ) : (
                    <div className="w-9 h-9" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PRÓXIMO ENCONTRO ── */}
      {nextEvent && (
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground font-inter text-[10px] mb-0.5">Próximo encontro</p>
            <p className="font-inter text-sm font-semibold text-foreground truncate">{nextEvent.title}</p>
            <p className="text-primary font-inter text-xs font-medium">
              {format(new Date(nextEvent.event_date), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      )}

      {/* ── ÚLTIMO ENCONTRO ── */}
      {lastEvent && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-montserrat font-bold text-foreground text-sm">Último encontro</p>
            <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
              {lastEvent.title} · {format(new Date(lastEvent.event_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            {/* Presentes */}
            <div>
              <p className="text-brand-green font-inter text-xs font-semibold mb-2">
                Presentes ({presentParticipants.length})
              </p>
              <div className="space-y-1.5">
                {presentParticipants.slice(0, 6).map(p => (
                  <button
                    key={p.user_id}
                    onClick={() => onSelectParticipant(p)}
                    className="flex items-center gap-1.5 w-full text-left hover:opacity-70 transition-opacity"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green flex-shrink-0" />
                    <span className="text-[11px] font-inter text-foreground truncate">{p.full_name}</span>
                  </button>
                ))}
                {presentParticipants.length > 6 && (
                  <p className="text-[10px] font-inter text-muted-foreground pl-3">
                    +{presentParticipants.length - 6} mais
                  </p>
                )}
                {presentParticipants.length === 0 && (
                  <p className="text-[10px] font-inter text-muted-foreground">Nenhum registro</p>
                )}
              </div>
            </div>
            {/* Ausentes */}
            <div>
              <p className="text-destructive font-inter text-xs font-semibold mb-2">
                Ausentes ({absentParticipants.length})
              </p>
              <div className="space-y-1.5">
                {absentParticipants.slice(0, 6).map(p => {
                  const wa = whatsappUrl(p.phone);
                  return (
                    <div key={p.user_id} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                      <button
                        onClick={() => onSelectParticipant(p)}
                        className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
                      >
                        <span className="text-[11px] font-inter text-foreground truncate block">{p.full_name}</span>
                      </button>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="hover:text-brand-green transition-colors"
                        >
                          <MessageCircle className="w-3 h-3 text-muted-foreground hover:text-brand-green" />
                        </a>
                      )}
                    </div>
                  );
                })}
                {absentParticipants.length > 6 && (
                  <p className="text-[10px] font-inter text-muted-foreground pl-3">
                    +{absentParticipants.length - 6} mais
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEVOCIONAIS ESTA SEMANA ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-montserrat font-bold text-foreground text-sm">Devocionais esta semana</p>
            <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
              {activeThisWeek === 0
                ? "Nenhum nos últimos 7 dias"
                : `${activeThisWeek} de ${participants.length} participante${participants.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-brand-green" />
          </div>
        </div>
        {activeThisWeek > 0 ? (
          <div className="divide-y divide-border max-h-52 overflow-y-auto">
            {participants
              .filter(p => weeklyDevCount[p.user_id] > 0)
              .sort((a, b) => (weeklyDevCount[b.user_id] || 0) - (weeklyDevCount[a.user_id] || 0))
              .map(p => (
                <button
                  key={p.user_id}
                  onClick={() => onSelectParticipant(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <Avatar name={p.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-xs font-medium text-foreground truncate">{p.full_name}</p>
                    <p className="text-muted-foreground font-inter text-[10px]">{p.community}</p>
                  </div>
                  <span className="font-montserrat font-bold text-xs text-brand-green flex-shrink-0">
                    {weeklyDevCount[p.user_id]} dev.
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            }
          </div>
        ) : (
          <p className="text-center text-muted-foreground font-inter text-xs py-6">
            Nenhum devocional concluído nos últimos 7 dias.
          </p>
        )}
      </div>

      {/* ── TODOS OS DISCÍPULOS ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">Todos os discípulos</p>
          <span className="ml-auto text-[10px] font-inter text-muted-foreground">
            {participants.length} total
          </span>
        </div>
        <div className="divide-y divide-border">
          {sortedParticipants.map(p => {
            const last = lastActivity[p.user_id];
            const wa = whatsappUrl(p.phone);
            const daysAgo = last ? differenceInDays(now, last) : null;
            const lastLabel =
              daysAgo === null
                ? "Nunca teve atividade"
                : daysAgo === 0
                ? "Ativo hoje"
                : `Última atividade há ${daysAgo} dia${daysAgo !== 1 ? "s" : ""}`;
            const isInactive = daysAgo === null || daysAgo >= 7;

            return (
              <div key={p.user_id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => onSelectParticipant(p)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="relative">
                    <Avatar name={p.full_name} />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                      daysAgo === 0 ? "bg-brand-green"
                      : daysAgo !== null && daysAgo < 7 ? "bg-primary"
                      : "bg-muted-foreground/40"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-inter text-sm font-medium text-foreground truncate">{p.full_name}</p>
                    <p className={`font-inter text-[10px] ${isInactive ? "text-destructive/80" : "text-muted-foreground"}`}>
                      {lastLabel}{p.community ? ` · ${p.community}` : ""}
                    </p>
                  </div>
                </button>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center flex-shrink-0 hover:bg-brand-green/15 transition-colors group"
                  >
                    <MessageCircle className="w-4 h-4 text-muted-foreground group-hover:text-brand-green transition-colors" />
                  </a>
                ) : (
                  <div className="w-9 h-9" />
                )}
              </div>
            );
          })}
          {participants.length === 0 && (
            <p className="text-center text-muted-foreground font-inter text-sm py-8">
              Nenhum participante encontrado.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
