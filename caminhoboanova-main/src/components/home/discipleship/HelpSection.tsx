import { ChevronRight, CheckCircle2 } from "lucide-react";

type Props = {
  helpSent: boolean;
  showHelpModal: boolean;
  setShowHelpModal: (v: boolean) => void;
  helpType: "crise" | "conversar" | "oracao" | null;
  setHelpType: (v: "crise" | "conversar" | "oracao" | null) => void;
  helpMessage: string;
  setHelpMessage: (v: string) => void;
  helpSending: boolean;
  onSendHelp: () => void;
};

export default function HelpSection({
  helpSent, showHelpModal, setShowHelpModal,
  helpType, setHelpType, helpMessage, setHelpMessage,
  helpSending, onSendHelp,
}: Props) {
  return (
    <>
      {!helpSent ? (
        <button
          onClick={() => setShowHelpModal(true)}
          className="w-full rounded-2xl p-4 border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🕊️</span>
          </div>
          <div className="text-left flex-1">
            <p className="font-montserrat font-bold text-foreground text-sm">Pedir Ajuda</p>
            <p className="text-muted-foreground font-inter text-[10px]">
              Está em crise, quer conversar ou precisa de oração? Seu pastor será avisado.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      ) : (
        <div className="w-full rounded-2xl p-4 bg-brand-green/10 border border-brand-green/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-green/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-brand-green" />
          </div>
          <div className="text-left">
            <p className="font-montserrat font-bold text-brand-green text-sm">Pedido enviado</p>
            <p className="text-muted-foreground font-inter text-[10px]">Seu pastor foi notificado e vai entrar em contato com você.</p>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in" onClick={() => setShowHelpModal(false)}>
          <div
            className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <span className="text-3xl">🕊️</span>
              <h3 className="font-montserrat font-black text-foreground text-lg mt-2">Pedir Ajuda</h3>
              <p className="text-muted-foreground font-inter text-xs mt-1">
                Você não está sozinho. Escolha como podemos te ajudar:
              </p>
            </div>

            <div className="space-y-2">
              {([
                { type: "crise" as const, icon: "🆘", label: "Estou em crise", desc: "Preciso de ajuda urgente", bg: "bg-destructive/10 border-destructive/20", active: "ring-destructive" },
                { type: "conversar" as const, icon: "💬", label: "Quero conversar", desc: "Preciso falar com alguém", bg: "bg-primary/10 border-primary/20", active: "ring-primary" },
                { type: "oracao" as const, icon: "🙏", label: "Preciso de oração", desc: "Ore por mim, por favor", bg: "bg-accent/15 border-accent/20", active: "ring-accent" },
              ]).map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setHelpType(opt.type)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${opt.bg} ${
                    helpType === opt.type ? `ring-2 ${opt.active} scale-[1.02]` : "hover:scale-[1.01]"
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <div className="text-left">
                    <p className="font-montserrat font-bold text-foreground text-sm">{opt.label}</p>
                    <p className="font-inter text-[10px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {helpType && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <textarea
                  value={helpMessage}
                  onChange={e => setHelpMessage(e.target.value)}
                  placeholder="Quer contar mais? (opcional)"
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 font-inter text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowHelpModal(false); setHelpType(null); setHelpMessage(""); }}
                className="flex-1 py-3 rounded-xl font-inter text-sm font-semibold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={onSendHelp}
                disabled={!helpType || helpSending}
                className="flex-1 py-3 rounded-xl font-inter text-sm font-bold text-primary-foreground transition-all disabled:opacity-40"
                style={{ background: "var(--gradient-hero)" }}
              >
                {helpSending ? "Enviando..." : "🕊️ Enviar pedido"}
              </button>
            </div>

            <p className="text-center text-muted-foreground font-inter text-[10px]">
              💚 Tudo que você compartilhar é confidencial.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
