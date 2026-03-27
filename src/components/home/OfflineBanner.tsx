import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-secondary text-secondary-foreground px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top duration-300"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="font-inter text-xs font-semibold">Você está offline — usando dados salvos</span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 p-1 rounded-lg hover:bg-secondary-foreground/20 transition-colors"
        aria-label="Tentar reconectar"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 text-secondary-foreground/60 hover:text-secondary-foreground text-xs font-inter"
        aria-label="Fechar aviso de offline"
      >
        ✕
      </button>
    </div>
  );
}
