import { useState, useRef, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Mail, Lock, User, Phone, ChevronLeft, ChevronDown, MessageCircle, Camera } from "lucide-react";
import { z } from "zod";
import AvatarCropper from "@/components/home/AvatarCropper";

// Dynamic imports for less-used icons
const Calendar = lazy(() => import("lucide-react").then(m => ({ default: m.Calendar })));
const Users = lazy(() => import("lucide-react").then(m => ({ default: m.Users })));
const Flame = lazy(() => import("lucide-react").then(m => ({ default: m.Flame })));

const COMMUNITIES = [
  "Bom Pastor",
  "Martim Lutero",
  "Rincão Fundo",
  "Rincão Frente",
  "Linha Brasil",
  "Iriá Pira 1",
  "Iriá Pira 2",
] as const;

type Community = typeof COMMUNITIES[number];

function getCommunityArea(community: Community): "Área 1" | "Área 2" {
  const area1 = ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"];
  return area1.includes(community) ? "Área 1" : "Área 2";
}

const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().trim().min(8, "Telefone inválido").max(20),
  fatherName: z.string().trim().max(100).optional(),
  motherName: z.string().trim().max(100).optional(),
  fatherPhone: z.string().trim().max(20).optional(),
  motherPhone: z.string().trim().max(20).optional(),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(128),
  community: z.enum(COMMUNITIES, { required_error: "Selecione sua comunidade" }),
});

const inputClass = "w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all";

const IconFallback = () => <div className="w-4 h-4" />;

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [fatherPhone, setFatherPhone] = useState("");
  const [motherPhone, setMotherPhone] = useState("");
  const [croppedPhoto, setCroppedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [rawPhotoSrc, setRawPhotoSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [community, setCommunity] = useState<Community | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("A foto deve ter no máximo 5MB.");
      return;
    }
    setError(null);
    const src = URL.createObjectURL(file);
    setRawPhotoSrc(src);
    setShowCropper(true);
  }

  function handleCropComplete(blob: Blob) {
    setCroppedPhoto(blob);
    setPhotoPreview(URL.createObjectURL(blob));
    setShowCropper(false);
    setRawPhotoSrc(null);
  }

  function handleCropCancel() {
    setShowCropper(false);
    setRawPhotoSrc(null);
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || fullName.trim().length < 3) {
      setError("Nome deve ter pelo menos 3 caracteres.");
      return;
    }
    if (!birthDate) {
      setError("Informe sua data de nascimento.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setError("Telefone inválido.");
      return;
    }
    setStep(2);
  }

  function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(3);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!community) {
      setError("Selecione sua comunidade.");
      return;
    }

    const parsed = registerSchema.safeParse({
      fullName, birthDate, phone, fatherName, motherName,
      fatherPhone, motherPhone, email, password, community,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    const area = getCommunityArea(community as Community);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.fullName,
          birth_date: parsed.data.birthDate,
          phone: parsed.data.phone,
          community: parsed.data.community,
          area: area,
          father_name: parsed.data.fatherName || "",
          mother_name: parsed.data.motherName || "",
          father_phone: parsed.data.fatherPhone || "",
          mother_phone: parsed.data.motherPhone || "",
        },
      },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes("already registered")) {
        setError("Este email já está cadastrado. Faça login ou use outro email.");
      } else {
        setError("Erro ao criar conta: " + authError.message);
      }
      setLoading(false);
      return;
    }

    if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
      setError("Este email já está cadastrado. Faça login ou use outro email.");
      setLoading(false);
      return;
    }

    // Upload cropped photo if provided
    if (croppedPhoto && authData.user) {
      const path = `${authData.user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, croppedPhoto, { upsert: true, contentType: "image/jpeg" });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", authData.user.id);
      }
    }

    setLoading(false);
    navigate("/login?cadastro=sucesso");
  }

  const totalSteps = 3;
  const stepTitles = ["Seus dados", "Família e foto", "Acesso e comunidade"];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-hero)" }}>
      {/* Avatar cropper modal */}
      {showCropper && rawPhotoSrc && (
        <AvatarCropper
          imageSrc={rawPhotoSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Header */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            {step > 1 ? (
              <button onClick={() => setStep((step - 1) as 1 | 2 | 3)} className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 text-primary-foreground" />
              </button>
            ) : (
              <Link to="/login" className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 text-primary-foreground" />
              </Link>
            )}
            <div className="flex-1">
              <h1 className="font-montserrat font-black text-primary-foreground text-xl">
                {stepTitles[step - 1]}
              </h1>
              <p className="text-primary-foreground/60 font-inter text-xs">Passo {step} de {totalSteps}</p>
            </div>
          </div>

          {/* Numbered progress bar */}
          <div className="flex items-center gap-0">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-montserrat font-bold text-sm transition-all ${
                  s < step
                    ? "bg-secondary text-white"
                    : s === step
                    ? "bg-white text-secondary ring-2 ring-secondary ring-offset-2 ring-offset-transparent"
                    : "bg-white/20 text-white/50"
                }`}>
                  {s < step ? "✓" : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-1 rounded-full transition-all ${
                    s < step ? "bg-secondary" : "bg-white/20"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl p-7">
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Data de nascimento</label>
                <div className="relative">
                  <Suspense fallback={<IconFallback />}>
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </Suspense>
                  <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 9 9999-9999" className={inputClass} required />
                </div>
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive font-inter text-sm">{error}</p>
                </div>
              )}
              <button type="submit" className="w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base transition-all active:scale-95 shadow-md" style={{ background: "var(--gradient-orange)" }}>
                Continuar →
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              {/* Photo upload with crop */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-24 h-24 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden hover:border-secondary transition-colors"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
                <span className="text-xs text-muted-foreground font-inter">
                  {photoPreview ? "Toque para trocar" : "Sua foto (opcional)"}
                </span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>

              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Nome do pai</label>
                <div className="relative">
                  <Suspense fallback={<IconFallback />}>
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </Suspense>
                  <input type="text" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Nome completo do pai" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Telefone do pai</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="tel" value={fatherPhone} onChange={(e) => setFatherPhone(e.target.value)} placeholder="(51) 9 9999-9999" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Nome da mãe</label>
                <div className="relative">
                  <Suspense fallback={<IconFallback />}>
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </Suspense>
                  <input type="text" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Nome completo da mãe" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Telefone da mãe</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="tel" value={motherPhone} onChange={(e) => setMotherPhone(e.target.value)} placeholder="(51) 9 9999-9999" className={inputClass} />
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive font-inter text-sm">{error}</p>
                </div>
              )}
              <button type="submit" className="w-full py-3.5 rounded-xl font-montserrat font-bold text-primary-foreground text-base transition-all active:scale-95 shadow-md" style={{ background: "var(--gradient-orange)" }}>
                Continuar →
              </button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className={inputClass} autoComplete="email" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-10 pr-11 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-inter font-medium text-foreground mb-1.5">Sua comunidade</label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={community}
                    onChange={(e) => setCommunity(e.target.value as Community)}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-secondary transition-all appearance-none"
                    required
                  >
                    <option value="">Selecione sua comunidade...</option>
                    {COMMUNITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {community && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getCommunityArea(community as Community) === "Área 1" ? "bg-brand-green" : "bg-primary"}`} />
                    <span className="text-muted-foreground font-inter text-xs">
                      Atribuído automaticamente à <strong className="text-foreground">{getCommunityArea(community as Community)}</strong>
                    </span>
                  </div>
                )}
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
                {loading ? "Criando conta..." : "Começar minha jornada ✝️"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <p className="text-muted-foreground font-inter text-sm">
              Já tem conta?{" "}
              <Link to="/login" className="text-secondary font-bold hover:underline">Entrar</Link>
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

        <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2 backdrop-blur">
          <Suspense fallback={<IconFallback />}>
            <Flame className="w-5 h-5 text-secondary" />
          </Suspense>
          <span className="text-primary-foreground font-inter text-sm">
            Profissão de fé - Paróquia Boa Nova
          </span>
        </div>
      </div>
    </div>
  );
}
