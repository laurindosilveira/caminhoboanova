import { Toaster } from "@/components/ui/toaster";
import OfflineBanner from "@/components/home/OfflineBanner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AreaSwitchProvider } from "@/contexts/AreaSwitchContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AdminDashboard from "./pages/AdminDashboard";
import Install from "./pages/Install";
import ExportData from "./pages/ExportData";
import Apresentacao from "./pages/Apresentacao";
import MinhaIgreja from "./pages/MinhaIgreja";
import Onboarding from "./pages/Onboarding";
import AdminSistema from "./pages/AdminSistema";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl bg-white/15 backdrop-blur border-2 border-white/30 flex items-center justify-center mx-auto mb-4 animate-float">
            <span className="text-3xl">✝️</span>
          </div>
          <p className="text-primary-foreground font-inter text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={(role === "admin" || role === "lider") ? "/admin" : "/"} replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    {/* Protected routes */}
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

    {/* Public auth routes */}
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/cadastro" element={<PublicRoute><Register /></PublicRoute>} />
    <Route path="/recuperar-senha" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
    <Route path="/verificar-email" element={<VerifyEmail />} />
    <Route path="/redefinir-senha" element={<ResetPassword />} />
    <Route path="/instalar" element={<Install />} />
    <Route path="/apresentacao" element={<Apresentacao />} />
    <Route path="/exportar-dados" element={<ProtectedRoute><ExportData /></ProtectedRoute>} />
    <Route path="/minha-igreja" element={<ProtectedRoute><MinhaIgreja /></ProtectedRoute>} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/admin-sistema" element={<ProtectedRoute><AdminSistema /></ProtectedRoute>} />

    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>
      <OfflineBanner />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AreaSwitchProvider>
            <AppRoutes />
          </AreaSwitchProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
