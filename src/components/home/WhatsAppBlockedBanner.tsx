import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  /** Called when the user clicks "Corrigir agora" — should navigate to Configurações tab */
  onNavigateToSettings: () => void;
};

export default function WhatsAppBlockedBanner({ onNavigateToSettings }: Props) {
  const { profile } = useAuth();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.user_id) return;

    // Check if user has whatsapp_enabled + validation_status = invalid
    supabase
      .from("profiles")
      .select("whatsapp_validation_status, whatsapp_last_blocked_reason")
      .eq("user_id", profile.user_id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_validation_status === "invalid") {
          setReason(data.whatsapp_last_blocked_reason ?? null);
          setShow(true);
        }
      });

    // Also check if whatsapp_enabled is true in notification_preferences
    supabase
      .from("notification_preferences")
      .select("whatsapp_enabled")
      .eq("user_id", profile.user_id)
      .maybeSingle()
      .then(({ data }) => {
        // Only show if user opted in to WhatsApp reminders
        if (!data?.whatsapp_enabled) setShow(false);
      });
  }, [profile?.user_id]);

  if (!show || dismissed) return null;

  return (
    <div className="mx-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-bold text-amber-800 dark:text-amber-300 text-sm leading-snug">
            WhatsApp bloqueado
          </p>
          <p className="font-inter text-amber-700 dark:text-amber-400 text-xs mt-1 leading-relaxed">
            Seus lembretes automáticos não estão sendo entregues porque seu número de WhatsApp está inválido.
          </p>
          {reason && (
            <p className="font-inter text-amber-600 dark:text-amber-500 text-[11px] mt-1 leading-relaxed">
              Motivo: {reason}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          aria-label="Fechar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={onNavigateToSettings}
        className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-inter font-semibold text-xs transition-colors"
      >
        Corrigir número agora
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
