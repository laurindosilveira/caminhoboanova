import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export default function PersonalizedGreeting() {
  const { profile } = useAuth();
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    fetchLastActivity();
  }, []);

  async function fetchLastActivity() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: devProg }, { data: lessonResp }] = await Promise.all([
      supabase.from("devotional_progress")
        .select("completed_at, devotional_id")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(1),
      supabase.from("lesson_responses")
        .select("created_at, lesson_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const devDate = devProg?.[0]?.completed_at ? new Date(devProg[0].completed_at) : null;
    const lessonDate = lessonResp?.[0]?.created_at ? new Date(lessonResp[0].created_at) : null;

    if (devDate && (!lessonDate || devDate > lessonDate)) {
      setLastActivity("devocional");
    } else if (lessonDate) {
      setLastActivity("lição");
    }
  }

  useEffect(() => {
    const hour = new Date().getHours();
    const firstName = profile?.full_name?.split(" ")[0] || "";
    const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    let msg = `${period}, ${firstName}! `;
    if (lastActivity === "devocional") {
      msg += "Continue sua caminhada devocional 📖";
    } else if (lastActivity === "lição") {
      msg += "Ótimo progresso nos estudos! 🎓";
    } else {
      msg += "Pronto para crescer na fé? ✨";
    }
    setGreeting(msg);
  }, [profile, lastActivity]);

  if (!greeting) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      className="px-5 pt-3 pb-1"
    >
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground font-inter text-xs leading-relaxed flex-1">
          {greeting}
        </p>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-1 rounded-md hover:bg-muted/50 transition-colors" aria-label="Informações sobre pontos">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-center">
              <p className="text-xs">Complete atividades para ganhar pontos e avançar na sua jornada de fé</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </motion.div>
  );
}
