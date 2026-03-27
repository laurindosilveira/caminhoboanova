import { useState, useEffect } from "react";
import { X, ExternalLink, BookOpen } from "lucide-react";

interface BibleModalProps {
  reference: string;
  open: boolean;
  onClose: () => void;
}

export default function BibleModal({ reference, open, onClose }: BibleModalProps) {
  const [iframeError, setIframeError] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setIframeLoading(true);
      setIframeError(false);
    }
  }, [open, reference]);
  const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=NVI-PT&interface=print`;
  const externalUrl = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=NVI-PT`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-auto max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-8 duration-300">
        {/* Decorative top bar */}
        <div className="mx-auto w-12 h-1.5 rounded-full bg-white/30 mb-2 sm:hidden" />

        <div className="bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header with gradient */}
          <div className="flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 border border-white/20">
                  <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-primary-foreground/60 font-inter text-[10px] uppercase tracking-wider font-semibold">Bíblia NVI</p>
                  <h3 className="font-montserrat font-bold text-primary-foreground text-sm truncate">{reference}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Abrir no site"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary-foreground/80" />
                </a>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4 text-primary-foreground/80" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {!iframeError ? (
              <div className="relative" style={{ height: "65vh" }}>
                {iframeLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card z-10">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-muted-foreground font-inter text-sm">Carregando texto...</p>
                  </div>
                )}
                <iframe
                  src={url}
                  className="w-full h-full border-0"
                  title={`Bíblia - ${reference}`}
                  onLoad={() => setIframeLoading(false)}
                  onError={() => { setIframeError(true); setIframeLoading(false); }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-10 text-center" style={{ minHeight: "40vh" }}>
                <div className="w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-5">
                  <BookOpen className="w-7 h-7 text-secondary" />
                </div>
                <p className="font-montserrat font-bold text-foreground text-base mb-2">Não foi possível carregar</p>
                <p className="text-muted-foreground font-inter text-sm mb-6 max-w-[260px]">
                  O texto não pôde ser exibido aqui. Abra no navegador para ler.
                </p>
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-xl font-montserrat font-bold text-sm text-primary-foreground shadow-md transition-all active:scale-95"
                  style={{ background: "var(--gradient-orange)" }}
                >
                  Abrir no navegador →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
