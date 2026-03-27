import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";

let deferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export default function InstallAppCard() {
  const navigate = useNavigate();
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsInstalled(isStandalone);
    setCanInstall(!!deferredPrompt);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
    };
    window.addEventListener("appinstalled", installHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installHandler);
    };
  }, []);

  if (isInstalled) {
    return (
      <div className="px-5 mt-3">
        <div className="w-full flex items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4">
          <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">✅</span>
          </div>
          <div className="text-left flex-1">
            <p className="font-montserrat font-bold text-foreground text-sm">App já instalado!</p>
            <p className="text-muted-foreground text-xs font-inter">O app já está na sua tela inicial</p>
          </div>
        </div>
      </div>
    );
  }

  async function handleClick() {
    if (canInstall && deferredPrompt) {
      setInstalling(true);
      try {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === "accepted") {
          setIsInstalled(true);
          setCanInstall(false);
        }
        deferredPrompt = null;
      } catch {
        navigate("/instalar");
      } finally {
        setInstalling(false);
      }
    } else {
      navigate("/instalar");
    }
  }

  return (
    <div className="px-5 mt-3">
      <button
        onClick={handleClick}
        disabled={installing}
        className="w-full flex items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 hover:bg-brand-green/10 transition-colors disabled:opacity-50"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
          {installing ? (
            <div className="w-5 h-5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
          ) : (
            <Download className="w-5 h-5 text-brand-green" />
          )}
        </div>
        <div className="text-left flex-1">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {installing ? "Instalando..." : "Instalar no celular"}
          </p>
          <p className="text-muted-foreground text-xs font-inter">Tenha o app sempre à mão, com notificações</p>
        </div>
        <span className="text-brand-green text-xs font-inter font-bold">
          {canInstall ? "Instalar" : "Ver →"}
        </span>
      </button>
    </div>
  );
}
