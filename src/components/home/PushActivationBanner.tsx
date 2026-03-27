import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requestNotificationPermission } from "@/lib/notifications";
import { subscribeToWebPush, isWebPushSubscribed } from "@/lib/webPush";

/**
 * Banner shown on the Jornada tab when an admin/leader
 * has sent a push activation reminder to this user.
 * Includes a one-tap "Ativar notificações" button.
 */
export default function PushActivationBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkReminder();
  }, [user]);

  async function checkReminder() {
    // If already subscribed to push, no need to show
    const alreadySubscribed = await isWebPushSubscribed();
    if (alreadySubscribed) return;

    // Check for undismissed reminders
    const { data } = await supabase
      .from("push_activation_reminders" as any)
      .select("id")
      .eq("target_user_id", user!.id)
      .is("dismissed_at", null)
      .limit(1);

    if (data && data.length > 0) {
      setReminderId((data[0] as any).id);
      setVisible(true);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      // Request notification permission
      const granted = await requestNotificationPermission();
      if (!granted) {
        setActivating(false);
        return;
      }

      // Get VAPID key and subscribe
      const { data: vapidData } = await supabase.functions.invoke("get-vapid-key");
      if (vapidData?.publicKey) {
        await subscribeToWebPush(vapidData.publicKey);
      }

      // Enable master notifications in preferences
      await supabase.from("notification_preferences").upsert({
        user_id: user!.id,
        master_enabled: true,
        devocional: true,
        eventos: true,
        streak: true,
        mensagens: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      }, { onConflict: "user_id" });

      // Dismiss the reminder
      if (reminderId) {
        await supabase
          .from("push_activation_reminders" as any)
          .update({ dismissed_at: new Date().toISOString() } as any)
          .eq("id", reminderId);
      }

      setVisible(false);
    } catch (err) {
      console.error("Failed to activate push:", err);
    } finally {
      setActivating(false);
    }
  }

  async function handleDismiss() {
    if (reminderId) {
      await supabase
        .from("push_activation_reminders" as any)
        .update({ dismissed_at: new Date().toISOString() } as any)
        .eq("id", reminderId);
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mx-5 mt-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-bold text-foreground text-sm">
            Ative suas notificações! 🔔
          </p>
          <p className="text-muted-foreground font-inter text-xs mt-1 leading-relaxed">
            Seu líder pediu para você ativar as notificações. Assim você ficará por dentro de tudo que acontece na sua caminhada!
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-inter font-bold text-primary-foreground disabled:opacity-50 transition-all"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Bell className="w-3.5 h-3.5" />
              {activating ? "Ativando..." : "Ativar Notificações"}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-inter hover:bg-muted/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
