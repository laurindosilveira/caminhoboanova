import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthorizedSystemAdmin } from "@/lib/systemAdminAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AccessState = "checking" | "allowed" | "denied";

export default function AdminSistemaPasswordGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      if (loading) return;
      if (!user?.email) {
        setAccessState("denied");
        return;
      }

      setAccessState("checking");
      const allowed = await isAuthorizedSystemAdmin();
      if (isMounted) setAccessState(allowed ? "allowed" : "denied");
    }

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [loading, user?.email]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (accessState === "allowed") return <>{children}</>;

  if (accessState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <p className="font-inter text-sm text-muted-foreground">Verificando permissao...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "var(--gradient-hero)" }}
          >
            <ShieldAlert className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle className="font-montserrat text-2xl font-black text-foreground">
              Acesso restrito
            </CardTitle>
            <CardDescription className="font-inter text-sm text-muted-foreground">
              Seu usuario nao esta autorizado a acessar a administracao do sistema.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            <p className="font-inter text-muted-foreground">
              A liberacao agora e feita pela lista segura de administradores autorizados no Supabase.
            </p>
          </div>
          <Button type="button" className="w-full rounded-xl" onClick={() => navigate("/")}>
            Voltar para o app
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
