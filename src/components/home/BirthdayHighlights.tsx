import { useEffect, useMemo, useState } from "react";
import { Cake, PartyPopper, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BirthdayPerson {
  user_id?: string;
  full_name: string;
  birth_date: string;
  community?: string | null;
  day: number;
}

interface BirthdayHighlightsProps {
  area: string;
  variant?: "journey" | "community";
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function mapBirthdayRows(rows: any[] | null | undefined, currentMonth: number): BirthdayPerson[] {
  return (rows ?? [])
    .filter((person) => {
      if (!person.birth_date) return false;
      return parseLocalDate(person.birth_date).getMonth() + 1 === currentMonth;
    })
    .map((person) => ({
      user_id: person.user_id,
      full_name: person.full_name,
      birth_date: person.birth_date,
      community: person.community,
      day: parseLocalDate(person.birth_date).getDate(),
    }))
    .sort((a, b) => a.day - b.day || a.full_name.localeCompare(b.full_name, "pt-BR"));
}

export default function BirthdayHighlights({ area, variant = "community" }: BirthdayHighlightsProps) {
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const monthName = today.toLocaleString("pt-BR", { month: "long" });

  useEffect(() => {
    if (!area) {
      setBirthdays([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchBirthdays() {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("get_area_birthdays", {
        _area: area,
        _month: currentMonth,
      });

      if (cancelled) return;

      let monthlyBirthdays = mapBirthdayRows(data, currentMonth);

      if (error) {
        console.warn("BirthdayHighlights: RPC failed, falling back to profiles query", error.message);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("user_id, full_name, birth_date, community, area")
          .eq("area", area as any);

        if (fallbackError) {
          console.warn("BirthdayHighlights: profiles fallback failed", fallbackError.message);
        }

        monthlyBirthdays = mapBirthdayRows(fallbackData, currentMonth);
      }

      setBirthdays(monthlyBirthdays);
      setLoading(false);
    }

    fetchBirthdays();
    return () => {
      cancelled = true;
    };
  }, [area, currentMonth]);

  const todaysBirthdays = birthdays.filter((birthday) => birthday.day === currentDay);

  if (loading) return null;

  if (variant === "journey" && birthdays.length === 0) {
    return null;
  }

  if (variant === "journey") {
    return (
      <section className="px-5 mb-3">
        <div className="rounded-2xl border border-secondary/25 bg-gradient-to-br from-secondary/15 via-card to-primary/10 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0">
                {todaysBirthdays.length > 0 ? (
                  <PartyPopper className="w-5 h-5 text-secondary" />
                ) : (
                  <Cake className="w-5 h-5 text-secondary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-montserrat font-black text-foreground text-sm">
                  Aniversariantes de {monthName}
                </p>
                <p className="font-inter text-xs text-muted-foreground">
                  {todaysBirthdays.length > 0
                    ? "Hoje e especial na sua area"
                    : `${birthdays.length} pessoa${birthdays.length !== 1 ? "s" : ""} celebrando este mes`}
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-secondary flex-shrink-0" />
          </div>

          {todaysBirthdays.length > 0 && (
            <div className="mb-3 space-y-2">
              {todaysBirthdays.map((birthday) => (
                <div key={`today-${birthday.full_name}-${birthday.birth_date}`} className="rounded-xl bg-secondary/10 border border-secondary/20 px-3 py-2.5">
                  <p className="font-montserrat font-bold text-foreground text-sm truncate">
                    {birthday.full_name}
                  </p>
                  <p className="font-inter text-xs text-muted-foreground">
                    Aniversariante de hoje{birthday.community ? ` - ${birthday.community}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {birthdays.slice(0, todaysBirthdays.length > 0 ? 4 : 5).map((birthday) => {
              const isToday = birthday.day === currentDay;
              return (
                <div key={`${birthday.full_name}-${birthday.birth_date}`} className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
                  <span className={`w-9 text-center font-montserrat font-black text-sm ${isToday ? "text-secondary" : "text-foreground"}`}>
                    {String(birthday.day).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-inter font-semibold text-card-foreground text-xs truncate">{birthday.full_name}</p>
                    {isToday && <p className="font-inter text-[10px] text-secondary font-bold">Hoje</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Cake className="w-4 h-4 text-secondary" />
        <span className="font-montserrat font-bold text-foreground text-sm">
          Aniversariantes de {monthName}
        </span>
      </div>
      {birthdays.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <p className="text-muted-foreground text-sm font-inter">Nenhum aniversariante este mes.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {birthdays.map((birthday, index) => {
            const isToday = birthday.day === currentDay;
            return (
              <div
                key={`${birthday.full_name}-${birthday.birth_date}`}
                className={`flex items-center gap-3 px-4 py-3 ${index < birthdays.length - 1 ? "border-b border-border" : ""} ${isToday ? "bg-secondary/5" : ""}`}
              >
                {isToday ? (
                  <PartyPopper className="w-4 h-4 text-secondary flex-shrink-0" />
                ) : (
                  <Cake className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-montserrat font-black text-card-foreground text-sm flex-shrink-0">
                  {String(birthday.day).padStart(2, "0")}/{String(currentMonth).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat text-card-foreground text-sm truncate">
                    {birthday.full_name}
                    {isToday && <span className="text-secondary text-xs font-inter ml-1">(hoje!)</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
