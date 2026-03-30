import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const ADMIN_SISTEMA_PASSWORD = "CaminhoBoaNova2026";
const ADMIN_SISTEMA_ALLOWED_EMAILS = ["laurindosilveira@gmail.com"];

function getSessionKey(userEmail?: string | null) {
  return `admin-sistema-access:${userEmail ?? "guest"}`;
}

export default function AdminSistemaPasswordGate({ children }: { children: React.ReactNode }) {
  const { user, isSuper, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const isAllowed = !!(isSuper && user?.email && ADMIN_SISTEMA_ALLOWED_EMAILS.includes(user.email));

  useEffect(() => {
    if (!user?.email) {
      setIsUnlocked(false);
      return;
    }

    setIsUnlocked(sessionStorage.getItem(getSessionKey(user.email)) === "granted");
  }, [user?.email]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== ADMIN_SISTEMA_PASSWORD) {
      toast({
        title: "Senha incorreta",
        description: "Confira a senha de acesso da área administrativa do sistema.",
        variant: "destructive",
      });
      return;
    }

    if (user?.email) {
      sessionStorage.setItem(getSessionKey(user.email), "granted");
    }

    setIsUnlocked(true);
    setPassword("");
    toast({ title: "Acesso liberado", description: "Proteção da área do sistema validada nesta sessão." });
  }

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAllowed) return <Navigate to="/" replace />;
  if (isUnlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="font-montserrat text-2xl font-black text-foreground">
              Acesso protegido
            </CardTitle>
            <CardDescription className="font-inter text-sm text-muted-foreground">
              Digite a senha da área `/admin-sistema` para continuar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="admin-sistema-password" className="text-sm font-medium text-foreground">
                Senha
              </label>
              <Input
                id="admin-sistema-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="current-password"
                className="rounded-xl"
              />
            </div>

            <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="font-inter text-muted-foreground">
                  Esta liberação fica salva somente até fechar a aba ou o navegador.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full rounded-xl">
              Entrar na administração do sistema
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
