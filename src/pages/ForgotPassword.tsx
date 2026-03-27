import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ChevronLeft, CheckCircle } from "lucide-react";
import { z } from "zod";

const forgotSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
});

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (authError) {
      setError("Erro ao enviar email: " + authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm mb-6 flex items-center gap-3">
          <Link to="/login" className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-primary-foreground" />
          </Link>
          <h1 className="font-montserrat font-black text-primary-foreground text-xl">Recuperar senha</h1>
        </div>

        <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-7">
          {!sent ? (
            <>
              <div className="mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <h2 className="font-montserrat font-black text-foreground text-xl mb-1">Esqueceu sua senha?</h2>
                <p className="text-muted-foreground font-inter text-sm">
                  Sem problemas! Digite seu email e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                    <p className="text-destructive font-inter text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base transition-all active:scale-95 disabled:opacity-60 shadow-md"
                  style={{ background: "var(--gradient-orange)" }}
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-brand-green" />
              </div>
              <h2 className="font-montserrat font-black text-foreground text-xl mb-2">Email enviado!</h2>
              <p className="text-muted-foreground font-inter text-sm mb-6">
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <Link
                to="/login"
                className="inline-block w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base text-center transition-all active:scale-95 shadow-md"
                style={{ background: "var(--gradient-orange)" }}
              >
                Voltar ao login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
