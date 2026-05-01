import { useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Moon,
  RefreshCw,
  Shield,
  Smartphone,
  X,
} from "lucide-react";
import { subscribeToWebPush } from "@/lib/webPush";
import { supabase } from "@/integrations/supabase/client";

type Props = { open: boolean; onClose: () => void };

type StepState = "idle" | "loading" | "ok" | "error";

export default function PushTroubleshootHelp({ open, onClose }: Props) {
  const [resubState, setResubState] = useState<StepState>("idle");
  const [resubMsg, setResubMsg]   = useState("");
  const [cacheState, setCacheState] = useState<StepState>("idle");

  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";

  async function handleResubscribe() {
    setResubState("loading");
    setResubMsg("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-vapid-key");
      if (fnError || !data?.publicKey) throw new Error("Não foi possível obter chave VAPID do servidor");
      const ok = await subscribeToWebPush(data.publicKey);
      if (ok) {
        setResubState("ok");
        setResubMsg("Inscrição renovada! Faça um teste de push real para confirmar.");
      } else {
        setResubState("error");
        setResubMsg("Falha ao se inscrever. Verifique se a permissão do navegador está concedida.");
      }
    } catch (e: any) {
      setResubState("error");
      setResubMsg(e.message ?? "Erro desconhecido");
    }
  }

  async function handleClearCacheAndReload() {
    setCacheState("loading");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) await reg.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const key of keys) await caches.delete(key);
      }
      setCacheState("ok");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setCacheState("error");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-card rounded-t-3xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-montserrat font-black text-foreground text-sm">Solucionar problemas</p>
              <p className="font-inter text-[10px] text-muted-foreground">Notificações push</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 pb-8">

          {/* Step 1: Permission */}
          <Step
            number={1}
            icon={<Shield className="w-4 h-4 text-primary" />}
            title="Verificar permissão do navegador"
            status={
              permission === "granted" ? "ok" :
              permission === "denied"  ? "error" : "idle"
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-inter text-muted-foreground">Status atual:</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-inter font-bold ${
                  permission === "granted"
                    ? "bg-brand-green/15 text-brand-green"
                    : permission === "denied"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {permission === "granted" ? "✓ Concedida" :
                   permission === "denied"  ? "✗ Bloqueada" : "⏳ Não solicitada"}
                </span>
              </div>

              {permission === "denied" && (
                <div className="p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
                  <p className="text-[11px] font-inter text-destructive leading-relaxed">
                    O navegador bloqueou as notificações. Para desbloquear:
                  </p>
                  <ol className="text-[11px] font-inter text-destructive/80 mt-1.5 space-y-0.5 list-decimal list-inside">
                    <li>Toque no ícone de cadeado na barra de endereço</li>
                    <li>Abra "Configurações do site" / "Permissões"</li>
                    <li>Mude "Notificações" de Bloqueado para Permitir</li>
                    <li>Recarregue a página</li>
                  </ol>
                </div>
              )}

              {permission === "default" && (
                <p className="text-[11px] font-inter text-muted-foreground">
                  Você ainda não autorizou as notificações. Ative-as no painel de Notificações acima.
                </p>
              )}
            </div>
          </Step>

          {/* Step 2: Cache */}
          <Step
            number={2}
            icon={<RefreshCw className="w-4 h-4 text-primary" />}
            title="Limpar cache e recarregar"
            status={cacheState === "ok" ? "ok" : cacheState === "error" ? "error" : "idle"}
          >
            <div className="space-y-2">
              <p className="text-[11px] font-inter text-muted-foreground leading-relaxed">
                O Service Worker pode estar desatualizado, impedindo a entrega de notificações.
                Limpar o cache corrige a maioria dos problemas.
              </p>
              <button
                onClick={handleClearCacheAndReload}
                disabled={cacheState === "loading" || cacheState === "ok"}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cacheState === "loading" ? "animate-spin" : ""}`} />
                {cacheState === "loading" ? "Limpando e recarregando..." :
                 cacheState === "ok"      ? "Cache limpo — recarregando..." :
                 "Limpar cache e recarregar"}
              </button>
              {cacheState === "error" && (
                <p className="text-[11px] font-inter text-destructive">Não foi possível limpar o cache automaticamente. Recarregue a página manualmente.</p>
              )}
            </div>
          </Step>

          {/* Step 3: Resubscribe */}
          <Step
            number={3}
            icon={<Bell className="w-4 h-4 text-primary" />}
            title="Renovar inscrição push"
            status={resubState === "ok" ? "ok" : resubState === "error" ? "error" : "idle"}
          >
            <div className="space-y-2">
              <p className="text-[11px] font-inter text-muted-foreground leading-relaxed">
                Se as notificações pararam após trocar de navegador, limpar dados ou reinstalar o app,
                renove sua inscrição push.
              </p>
              <button
                onClick={handleResubscribe}
                disabled={resubState === "loading" || permission !== "granted"}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inter font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <Bell className={`w-3.5 h-3.5 ${resubState === "loading" ? "animate-spin" : ""}`} />
                {resubState === "loading" ? "Renovando..." :
                 resubState === "ok"      ? "Inscrição renovada ✓" : "Renovar inscrição"}
              </button>
              {resubMsg && (
                <p className={`text-[11px] font-inter ${resubState === "ok" ? "text-brand-green" : "text-destructive"}`}>
                  {resubMsg}
                </p>
              )}
              {permission !== "granted" && (
                <p className="text-[11px] font-inter text-muted-foreground">
                  ⚠️ Conceda a permissão de notificações primeiro (Passo 1).
                </p>
              )}
            </div>
          </Step>

          {/* Step 4: DND / OS settings */}
          <Step
            number={4}
            icon={<Moon className="w-4 h-4 text-primary" />}
            title="Verificar modo 'Não perturbe'"
            status="idle"
          >
            <p className="text-[11px] font-inter text-muted-foreground leading-relaxed">
              Mesmo com permissão concedida, o sistema operacional pode silenciar as notificações. Verifique:
            </p>
            <ul className="mt-1.5 space-y-1">
              {[
                "Modo Não Perturbe / Focus Mode está desativado",
                "O app/navegador não está na lista de apps silenciados",
                "O volume de notificações do sistema está ativado",
                "Modos de economia de energia não estão bloqueando processos em background",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] font-inter text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Step>

          {/* Step 5: Re-auth */}
          <Step
            number={5}
            icon={<LogOut className="w-4 h-4 text-primary" />}
            title="Reautenticar"
            status="idle"
          >
            <p className="text-[11px] font-inter text-muted-foreground leading-relaxed">
              Se nada funcionou, sair e entrar novamente pode corrigir o problema de autenticação com o
              serviço de push. Após entrar, volte em Configurações e ative as notificações novamente.
            </p>
          </Step>

          {/* Step 6: Device check */}
          <Step
            number={6}
            icon={<Smartphone className="w-4 h-4 text-primary" />}
            title="Informações do dispositivo"
            status="idle"
          >
            <div className="space-y-1">
              {[
                { label: "Notificações suportadas", value: "Notification" in window ? "Sim" : "Não" },
                { label: "Service Worker", value: "serviceWorker" in navigator ? "Suportado" : "Não suportado" },
                { label: "Push API", value: "PushManager" in window ? "Suportada" : "Não suportada" },
                { label: "Permissão atual", value: typeof Notification !== "undefined" ? Notification.permission : "N/A" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[10px] font-inter text-muted-foreground">{label}</span>
                  <span className="text-[10px] font-inter font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </Step>

        </div>
      </div>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function Step({
  number,
  icon,
  title,
  status,
  children,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  status: "idle" | "ok" | "error";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      status === "ok"    ? "border-brand-green/30 bg-brand-green/5" :
      status === "error" ? "border-destructive/30 bg-destructive/5" :
      "border-border bg-muted/20"
    }`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-montserrat font-black text-[10px] ${
          status === "ok"    ? "bg-brand-green text-white" :
          status === "error" ? "bg-destructive text-white" :
          "bg-primary/10 text-primary"
        }`}>
          {status === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
           status === "error" ? <AlertCircle className="w-3.5 h-3.5" /> :
           number}
        </div>
        <div className="flex items-center gap-2 flex-1 text-left">
          {icon}
          <span className="font-inter text-sm font-semibold text-foreground">{title}</span>
        </div>
        <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
