import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Mail, Lock, Flame, MessageCircle } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(128),
});

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cadastroSucesso = searchParams.get("cadastro") === "sucesso";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);

    // First check if user exists by trying to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (authError) {
      // Differentiate error types
      const msg = authError.message?.toLowerCase() || "";
      if (msg.includes("invalid login credentials")) {
        // Check if user exists by attempting password reset (won't send if no user)
        // Supabase doesn't differentiate natively, but we can provide better UX
        setError("Email ou senha incorretos. Verifique seus dados e tente novamente.");
      } else if (msg.includes("email not confirmed")) {
        setError("Seu email ainda não foi confirmado. Verifique sua caixa de entrada.");
      } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
        setError("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
      } else {
        setError("Erro ao entrar: " + authError.message);
      }
      setLoading(false);
      return;
    }

    // Auto-redirect based on role
    if (authData.user) {
      const [{ data: isAdmin }, { data: isLider }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: authData.user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: authData.user.id, _role: "lider" }),
      ]);

      if (isAdmin || isLider) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Logo area */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur border-2 border-white/30 flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-4xl">✝️</span>
          </div>
          <h1 className="font-montserrat font-black text-3xl text-primary-foreground">Caminho</h1>
          <p className="text-primary-foreground/70 font-inter text-sm mt-1">Crescendo na fé, juntos.</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-7">
          <h2 className="font-montserrat font-black text-foreground text-2xl mb-1">Entrar</h2>
          <p className="text-muted-foreground font-inter text-sm mb-6">Bem-vindo de volta à sua jornada!</p>

          {cadastroSucesso && (
            <div className="bg-brand-green/10 border border-brand-green/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-brand-green font-inter text-sm font-medium">
                ✅ Conta criada com sucesso! Faça login para começar.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-inter font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-inter font-medium text-foreground mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link to="/recuperar-senha" className="text-secondary font-inter text-sm font-medium hover:underline">
                Esqueci minha senha
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3" role="alert" id="login-error">
                <p className="text-destructive font-inter text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base transition-all active:scale-95 disabled:opacity-60 shadow-md"
              style={{ background: "var(--gradient-orange)" }}
            >
              {loading ? "Entrando..." : "Entrar na Jornada"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground font-inter text-sm">
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="text-secondary font-bold hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* WhatsApp help */}
        <a
          href="https://wa.me/5555984395290?text=Oi!%20Estou%20tentando%20usar%20o%20app%20do%20Ensino%20Confirmat%C3%B3rio%20e%20estou%20tendo%20dificuldade.%20Pode%20me%20ajudar%3F"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center gap-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 rounded-2xl px-5 py-3 backdrop-blur transition-colors"
        >
          <MessageCircle className="w-5 h-5 text-[#25D366]" />
          <span className="text-primary-foreground font-inter text-sm font-medium">
            Precisa de ajuda? Fale conosco
          </span>
        </a>

        {/* Bottom badge */}
        <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 backdrop-blur">
          <Flame className="w-5 h-5 text-secondary" />
          <span className="text-primary-foreground font-inter text-sm">
            Profissão de fé - Paróquia Boa Nova
          </span>
        </div>
      </div>
    </div>
  );
}
