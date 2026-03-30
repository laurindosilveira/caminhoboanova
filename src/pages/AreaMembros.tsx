import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function AreaMembros() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full rounded-2xl border border-border p-6 bg-card shadow-lg text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Área de membros</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Esta é a área de login multi-igrejas. Toque em continuar para acessar o formulário de autenticação.
        </p>

        <button
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:brightness-110 transition"
        >
          Entrar na Área de Membros
        </button>
      </div>
    </div>
  );
}
