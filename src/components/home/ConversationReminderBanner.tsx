import { useState, useEffect } from "react";
import { MessageSquare, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Banner shown on the Jornada tab when the user has
 * an upcoming personal conversation scheduled by their leader.
 */
export default function ConversationReminderBanner() {
  const { user } = useAuth();
  const [event, setEvent] = useState<{ title: string; event_date: string; description: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    checkUpcomingConversation();
  }, [user]);

  async function checkUpcomingConversation() {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("events")
      .select("title, event_date, description")
      .eq("type", "conversa")
      .gte("event_date", now)
      .order("event_date")
      .limit(10);

    // Filter client-side for target_user_id (not yet in types)
    const personal = (data ?? []).filter((e: any) => (e as any).target_user_id === user!.id);
    if (personal.length > 0) {
      setEvent(personal[0]);
    }
  }

  if (!event) return null;

  const evDate = new Date(event.event_date);
  const dateStr = evDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const timeStr = evDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-5 mt-2 rounded-2xl border border-secondary/30 bg-secondary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-bold text-foreground text-sm">
            💬 Conversa agendada!
          </p>
          <p className="text-muted-foreground font-inter text-xs mt-1 leading-relaxed">
            Seu líder agendou uma conversa com você para <strong className="text-foreground">{dateStr}</strong> às <strong className="text-foreground">{timeStr}</strong>.
          </p>
          {event.description && (
            <p className="text-muted-foreground font-inter text-[10px] mt-1 italic">
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-2 text-secondary">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-inter font-bold">Confira na sua Agenda</span>
          </div>
        </div>
      </div>
    </div>
  );
}
