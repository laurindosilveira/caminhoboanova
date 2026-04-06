import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  MessageSquare,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { requestNotificationPermission, isNotificationEnabled, sendNotification } from "@/lib/notifications";
import { subscribeToWebPush, isWebPushSubscribed } from "@/lib/webPush";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type NotifPrefs = {
  devocional: boolean;
  eventos: boolean;
  streak: boolean;
  mensagens: boolean;
};

const defaultPrefs: NotifPrefs = {
  devocional: true,
  eventos: true,
  streak: true,
  mensagens: true,
};

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 5);

const NOTIF_PREVIEWS: Record<string, { title: string; body: string; icon: string }> = {
  devocional: { title: "Devocional do dia", body: "Seu devocional de hoje esta disponivel!", icon: "📖" },
  eventos: { title: "Encontro amanha", body: "Nao esqueca do encontro amanha as 19h!", icon: "📅" },
  streak: { title: "Sequencia em risco!", body: "Complete o devocional para manter sua sequencia de 7 dias!", icon: "🔥" },
  mensagens: { title: "Nova mensagem", body: "Seu pastor enviou um comunicado para a turma.", icon: "💬" },
};

function NotificationPreview({ type, visible, onClose }: { type: string; visible: boolean; onClose: () => void }) {
  const preview = NOTIF_PREVIEWS[type];
  if (!visible || !preview) return null;

  return (
    <div className="mx-4 mb-2 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl p-3 shadow-lg relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-0.5">
          <X className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1 mb-2">
          <Smartphone className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] font-inter font-bold text-muted-foreground uppercase tracking-wider">Preview da notificacao</span>
        </div>
        <div className="bg-muted rounded-xl p-3 border border-border/50">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">{preview.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-montserrat font-bold text-foreground text-xs truncate">{preview.title}</p>
                <span className="text-[9px] text-muted-foreground font-inter flex-shrink-0">agora</span>
              </div>
              <p className="text-muted-foreground text-[11px] font-inter mt-0.5 leading-snug">{preview.body}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationSettings() {
  const { user } = useAuth();
  const [masterOn, setMasterOn] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs);
  const [preferredHour, setPreferredHour] = useState(7);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [previewType, setPreviewType] = useState<string | null>(null);

  const notificationOptions = [
    { key: "devocional" as const, label: "Devocional diario", desc: `Lembrete as ${preferredHour}h para o devocional`, icon: BookOpen, color: "text-brand-green" },
    { key: "eventos" as const, label: "Eventos e encontros", desc: "Avisos de eventos proximos", icon: CalendarDays, color: "text-primary" },
    { key: "streak" as const, label: "Risco de perder sequencia", desc: "Alerta quando sua sequencia esta em risco", icon: Flame, color: "text-secondary" },
    { key: "mensagens" as const, label: "Mensagens do pastor", desc: "Novas mensagens e comunicados", icon: MessageSquare, color: "text-accent-foreground" },
  ];

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setMasterOn(data.master_enabled);
        setPrefs({
          devocional: data.devocional,
          eventos: data.eventos,
          streak: data.streak,
          mensagens: data.mensagens,
        });
        setPreferredHour((data as any).preferred_hour ?? 7);
      } else {
        setMasterOn(isNotificationEnabled());
      }

      setLoading(false);
    }

    load();
  }, [user]);

  if (!("Notification" in window) || loading) return null;

  const activeCount = masterOn ? Object.values(prefs).filter(Boolean).length : 0;

  async function saveToDb(master: boolean, nextPrefs: NotifPrefs, hour?: number) {
    if (!user) return;

    await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,
        master_enabled: master,
        devocional: nextPrefs.devocional,
        eventos: nextPrefs.eventos,
        streak: nextPrefs.streak,
        mensagens: nextPrefs.mensagens,
        preferred_hour: hour ?? preferredHour,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
      }, { onConflict: "user_id" });
  }

  async function trySubscribeWebPush() {
    try {
      if (Notification.permission !== "granted") {
        setPermissionError(true);
        return;
      }

      const alreadySubscribed = await isWebPushSubscribed();
      if (alreadySubscribed) return;

      const { data, error: fnError } = await supabase.functions.invoke("get-vapid-key");
      if (fnError || !data?.publicKey) {
        console.error("Failed to get VAPID key:", fnError, data);
        setPermissionError(true);
        return;
      }

      const success = await subscribeToWebPush(data.publicKey);
      if (!success) {
        console.warn("subscribeToWebPush returned false");
        setPermissionError(true);
      }
    } catch (err) {
      console.error("Web Push subscription failed:", err);
      setPermissionError(true);
    }
  }

  async function handleToggleMaster() {
    if (masterOn) {
      setMasterOn(false);
      setExpanded(false);
      setPermissionError(false);
      setPreviewType(null);
      localStorage.setItem("caminho_notifications_enabled", "false");
      await saveToDb(false, prefs);
      return;
    }

    setPermissionError(false);
    setMasterOn(true);
    setExpanded(true);
    localStorage.setItem("caminho_notifications_enabled", "true");
    await saveToDb(true, prefs);

    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        await trySubscribeWebPush();
      } else if (Notification.permission === "denied") {
        setPermissionError(true);
      }
    } catch {
      setPermissionError(true);
    }
  }

  async function handleTestNotification() {
    await sendNotification(
      "Teste de notificacao",
      "Se voce esta vendo isso, as notificacoes estao funcionando!",
    );
  }

  async function handleTogglePref(key: keyof NotifPrefs) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await saveToDb(masterOn, updated);

    if (!prefs[key]) {
      setPreviewType(key);
      setTimeout(() => setPreviewType(null), 5000);
    } else if (previewType === key) {
      setPreviewType(null);
    }
  }

  async function handleHourChange(newHour: number) {
    setPreferredHour(newHour);
    await saveToDb(masterOn, prefs, newHour);
  }

  return (
    <div className="px-5 mt-3">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${masterOn ? "bg-brand-green/15" : "bg-muted"}`}>
            {masterOn ? <Bell className="w-5 h-5 text-brand-green" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="text-left flex-1">
            <p className="font-montserrat font-bold text-foreground text-sm">Notificacoes</p>
            <p className="text-muted-foreground text-xs font-inter">
              {masterOn ? `${activeCount} de ${notificationOptions.length} ativas` : "Notificacoes desativadas"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-[10px] font-inter font-bold ${masterOn ? "bg-brand-green/15 text-brand-green" : "bg-muted text-muted-foreground"}`}>
              {masterOn ? "ON" : "OFF"}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
            {!masterOn ? (
              <button
                onClick={handleToggleMaster}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-inter font-bold text-brand-green hover:bg-brand-green/5 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Ativar todas as notificacoes
              </button>
            ) : (
              <>
                {permissionError && (
                  <div className="mx-4 mt-3 mb-1 p-3 rounded-xl bg-accent/20 border border-accent/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-accent-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-inter text-xs font-bold text-foreground mb-1">Nao foi possivel ativar as notificacoes</p>
                        <p className="font-inter text-[11px] text-muted-foreground leading-relaxed">
                          O Android bloqueia permissoes quando ha sobreposicoes de outros apps. Para resolver:
                        </p>
                        <ul className="font-inter text-[11px] text-muted-foreground mt-1.5 space-y-1 list-none">
                          <li>Feche <strong>bolhas flutuantes</strong> (Messenger, WhatsApp)</li>
                          <li>Desative <strong>filtros de tela</strong> (modo noturno, Twilight)</li>
                          <li>Feche <strong>gravadores de tela</strong></li>
                          <li>Depois, tente ativar novamente</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <NotificationPreview
                  type={previewType ?? ""}
                  visible={!!previewType}
                  onClose={() => setPreviewType(null)}
                />

                {notificationOptions.map(({ key, label, desc, icon: Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => handleTogglePref(key)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-t border-border"
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${prefs[key] ? color : "text-muted-foreground"}`} />
                    <div className="text-left flex-1">
                      <p className={`font-inter text-sm font-semibold ${prefs[key] ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                      <p className="text-muted-foreground text-[10px] font-inter">{desc}</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-colors ${prefs[key] ? "bg-brand-green" : "bg-muted"}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                    </div>
                  </button>
                ))}

                <div className="border-t border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-inter text-sm font-semibold text-foreground">Horario do devocional</p>
                      <p className="text-muted-foreground text-[10px] font-inter">Horario preferido para o lembrete</p>
                    </div>
                    <select
                      value={preferredHour}
                      onChange={(e) => handleHourChange(Number(e.target.value))}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {HOUR_OPTIONS.map((hour) => (
                        <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleTestNotification}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-inter font-bold text-brand-green hover:bg-brand-green/5 transition-colors border-t border-border"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar notificacao de teste
                </button>

                <button
                  onClick={handleToggleMaster}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-inter font-bold text-destructive hover:bg-destructive/5 transition-colors border-t border-border"
                >
                  Desativar todas as notificacoes
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
