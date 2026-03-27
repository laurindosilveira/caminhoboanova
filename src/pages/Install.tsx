import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Smartphone, Download, ArrowLeft } from "lucide-react";

const ANDROID_STEPS = [
  { icon: "🌐", title: "Abra no Chrome", desc: "Acesse o app pelo navegador Google Chrome no seu celular." },
  { icon: "⋮", title: "Toque no menu (⋮)", desc: "No canto superior direito, toque nos três pontinhos." },
  { icon: "📲", title: 'Selecione "Instalar app"', desc: 'Ou "Adicionar à tela inicial". Confirme a instalação.' },
  { icon: "✅", title: "Pronto!", desc: "O app aparecerá na sua tela inicial como um app normal." },
];

const IOS_STEPS = [
  { icon: "🧭", title: "Abra no Safari", desc: "Acesse o app pelo navegador Safari (obrigatório no iPhone)." },
  { icon: "📤", title: "Toque em Compartilhar", desc: "Na barra inferior, toque no ícone de compartilhar (quadrado com seta para cima)." },
  { icon: "➕", title: '"Adicionar à Tela de Início"', desc: "Role as opções e selecione esta opção." },
  { icon: "✏️", title: "Confirme o nome", desc: 'Toque em "Adicionar" no canto superior direito.' },
  { icon: "✅", title: "Pronto!", desc: "O app aparecerá na sua tela inicial como um app real." },
];

// Store the beforeinstallprompt event globally
let deferredPrompt: any = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

export default function Install() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Check if install prompt is available
    setCanInstall(!!deferredPrompt);

    // Listen for new prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
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

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        setCanInstall(false);
      }
      deferredPrompt = null;
    } catch (err) {
      console.warn("Install prompt failed:", err);
    } finally {
      setInstalling(false);
    }
  }

  const steps = platform === "android" ? ANDROID_STEPS : IOS_STEPS;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 pt-8 pb-6" style={{ background: "var(--gradient-hero)" }}>
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-primary-foreground/70 font-inter text-xs mb-4 hover:text-primary-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-montserrat font-black text-primary-foreground text-xl">Instalar o App</h1>
              <p className="text-primary-foreground/60 font-inter text-xs">
                Tenha o Caminho sempre à mão no seu celular
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Already installed banner */}
        {isInstalled && (
          <div className="bg-brand-green/10 border border-brand-green/20 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-montserrat font-bold text-foreground text-sm">App já instalado!</p>
              <p className="font-inter text-xs text-muted-foreground">O Caminho Boa Nova já está na sua tela inicial.</p>
            </div>
          </div>
        )}

        {/* Install button (Android/Chrome only) */}
        {canInstall && !isInstalled && (
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-montserrat font-bold text-base text-primary-foreground transition-all disabled:opacity-50 shadow-lg active:scale-[0.98]"
            style={{ background: "var(--gradient-hero)" }}
          >
            {installing ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Instalando...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Instalar Agora
              </>
            )}
          </button>
        )}

        {/* Benefits */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="font-montserrat font-bold text-foreground text-sm mb-3">✨ Por que instalar?</p>
          <div className="space-y-2">
            {[
              { icon: "⚡", text: "Abre rápido, direto da tela inicial" },
              { icon: "🔔", text: "Receba notificações e lembretes" },
              { icon: "📴", text: "Funciona mesmo offline" },
              { icon: "🔄", text: "Atualiza automaticamente" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/30">
                <span className="text-lg">{b.icon}</span>
                <p className="font-inter text-sm text-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Manual instructions (shown when install button not available or as fallback) */}
        {!canInstall && !isInstalled && (
          <>
            {!platform ? (
              <div className="space-y-3">
                <p className="font-montserrat font-bold text-foreground text-sm text-center">
                  Instale manualmente — qual é o seu celular?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlatform("android")}
                    className="flex flex-col items-center gap-3 p-5 bg-card rounded-2xl border-2 border-border hover:border-brand-green/50 hover:bg-brand-green/5 transition-all"
                  >
                    <span className="text-4xl">🤖</span>
                    <div className="text-center">
                      <p className="font-montserrat font-bold text-foreground text-sm">Android</p>
                      <p className="text-muted-foreground font-inter text-[10px] mt-0.5">Samsung, Motorola, Xiaomi...</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setPlatform("ios")}
                    className="flex flex-col items-center gap-3 p-5 bg-card rounded-2xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <span className="text-4xl">🍎</span>
                    <div className="text-center">
                      <p className="font-montserrat font-bold text-foreground text-sm">iPhone</p>
                      <p className="text-muted-foreground font-inter text-[10px] mt-0.5">iOS 16.4 ou superior</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setPlatform(null)}
                  className="flex items-center gap-1.5 text-primary font-inter text-xs hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Trocar plataforma
                </button>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="font-montserrat font-bold text-foreground text-sm mb-4">
                    {platform === "android" ? "🤖 Passos para Android" : "🍎 Passos para iPhone"}
                  </p>
                  <div className="space-y-1">
                    {steps.map((step, i) => (
                      <div key={i} className="flex gap-3 pb-4 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg leading-none">{step.icon}</span>
                          </div>
                          {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pt-1 pb-2">
                          <p className="font-montserrat font-bold text-foreground text-sm">{step.title}</p>
                          <p className="font-inter text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {platform === "ios" && (
                  <div className="bg-accent/20 border border-accent/30 rounded-2xl p-4">
                    <p className="font-inter text-xs text-foreground">
                      <strong>⚠️ Importante:</strong> No iPhone, as notificações push só funcionam a partir do <strong>iOS 16.4</strong> e somente quando o app é instalado na tela inicial via Safari.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* If install button available, still show manual as collapsible fallback */}
        {canInstall && !isInstalled && !platform && (
          <button
            onClick={() => setPlatform("android")}
            className="w-full text-center text-xs font-inter text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Não apareceu? Veja como instalar manualmente →
          </button>
        )}

        <div className="text-center py-4">
          <p className="text-muted-foreground font-inter text-xs">
            Precisa de ajuda? Fale com seu líder ou pastor. 🙏
          </p>
        </div>
      </main>
    </div>
  );
}
