import { Link } from "react-router-dom";
import { Mail, CheckCircle } from "lucide-react";

export default function VerifyEmail() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur border-2 border-white/30 flex items-center justify-center mx-auto mb-6 shadow-xl">
          <span className="text-4xl">✝️</span>
        </div>

        <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-7 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9 text-brand-green" />
          </div>

          <h2 className="font-montserrat font-black text-foreground text-2xl mb-2">
            Conta criada! 🎉
          </h2>
          <p className="text-muted-foreground font-inter text-sm mb-2">
            Enviamos um email de confirmação para o seu endereço.
          </p>
          <div className="bg-muted rounded-2xl p-4 my-4 flex items-start gap-3">
            <Mail className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <p className="text-foreground font-inter text-sm text-left">
              Verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
            </p>
          </div>
          <p className="text-muted-foreground font-inter text-xs mb-6">
            Não recebeu? Verifique a pasta de spam.
          </p>

          <Link
            to="/login"
            className="inline-block w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base text-center transition-all active:scale-95 shadow-md"
            style={{ background: "var(--gradient-orange)" }}
          >
            Ir para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
