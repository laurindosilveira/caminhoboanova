import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Save, X, User, Phone, Calendar, MapPin, ChevronDown, Home, Users, Camera, GraduationCap, CheckCircle2, AlertCircle, Shield, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import WhatsAppPhoneInput from "@/components/ui/WhatsAppPhoneInput";
import { validateBRPhone, type PhoneValidation } from "@/lib/phoneValidation";

import { ALL_COMMUNITIES, getAreaForCommunity } from "@/config/areas";
const COMMUNITIES = ALL_COMMUNITIES as unknown as readonly [string, ...string[]];

const CONFIRMATION_YEARS = [
  { value: "", label: "Não definido" },
  { value: "1", label: "1º Ano" },
  { value: "2", label: "2º Ano" },
];

const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Nome deve ter ao menos 3 caracteres").max(100, "Máximo 100 caracteres"),
  phone: z.string().trim().min(8, "Telefone inválido").max(20, "Máximo 20 caracteres"),
  whatsapp_number: z.string().max(20).optional(),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  community: z.enum(COMMUNITIES, { required_error: "Selecione uma comunidade" }),
  father_name: z.string().max(100).optional(),
  mother_name: z.string().max(100).optional(),
  father_phone: z.string().max(20).optional(),
  mother_phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  confirmation_year: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function FieldStatus({ error, isDirty, isValid }: { error?: string; isDirty: boolean; isValid: boolean }) {
  if (error) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3 text-destructive" />
        <p className="text-[11px] text-destructive font-inter">{error}</p>
      </div>
    );
  }
  if (isDirty && isValid) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <CheckCircle2 className="w-3 h-3 text-brand-green" />
        <p className="text-[11px] text-brand-green font-inter">Válido</p>
      </div>
    );
  }
  return null;
}

export default function EditProfileForm() {
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validação em tempo real do WhatsApp (fora do react-hook-form para maior controle)
  const [phoneValidation, setPhoneValidation] = useState<PhoneValidation>(
    () => validateBRPhone((profile as any)?.phone ?? "")
  );
  const [waValidation, setWaValidation] = useState<PhoneValidation>(
    () => validateBRPhone((profile as any)?.whatsapp_number ?? "")
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, dirtyFields, touchedFields },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      whatsapp_number: (profile as any)?.whatsapp_number ?? "",
      birth_date: profile?.birth_date ?? "",
      community: (profile?.community as (typeof COMMUNITIES)[number]) ?? undefined,
      father_name: profile?.father_name ?? "",
      mother_name: profile?.mother_name ?? "",
      father_phone: profile?.father_phone ?? "",
      mother_phone: profile?.mother_phone ?? "",
      address: profile?.address ?? "",
      confirmation_year: profile?.confirmation_year ? String(profile.confirmation_year) : "",
    },
  });

  // Watch values for real-time validation feedback
  const watchedValues = watch();

  function handleCancel() {
    reset({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      whatsapp_number: (profile as any)?.whatsapp_number ?? "",
      birth_date: profile?.birth_date ?? "",
      community: (profile?.community as (typeof COMMUNITIES)[number]) ?? undefined,
      father_name: profile?.father_name ?? "",
      mother_name: profile?.mother_name ?? "",
      father_phone: profile?.father_phone ?? "",
      mother_phone: profile?.mother_phone ?? "",
      address: profile?.address ?? "",
      confirmation_year: profile?.confirmation_year ? String(profile.confirmation_year) : "",
    });
    setPhoneValidation(validateBRPhone(profile?.phone ?? ""));
    setWaValidation(validateBRPhone((profile as any)?.whatsapp_number ?? ""));
    setIsEditing(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Foto muito grande", description: "Máximo de 5MB.", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: "Foto atualizada!" });
    } catch (err) {
      console.error("Erro ao enviar foto:", err);
      toast({ title: "Erro ao enviar foto", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    if (!user?.id) return;
    setSaving(true);
    try {
      const areaVal = getAreaForCommunity(values.community);

      // Marca status de validação do WhatsApp ao salvar
      const waNum = values.whatsapp_number?.trim() ?? "";
      const waValid = waNum ? validateBRPhone(waNum) : null;

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: values.full_name,
            phone: values.phone,
            whatsapp_number: waNum || null,
            whatsapp_validation_status: waNum
              ? (waValid?.valid ? "valid" : "invalid")
              : null,
            whatsapp_last_blocked_reason: waNum && !waValid?.valid
              ? (waValid?.hint ?? "Formato inválido")
              : null,
            whatsapp_last_blocked_at: waNum && !waValid?.valid ? new Date().toISOString() : null,
            birth_date: values.birth_date,
            community: values.community,
            area: areaVal as "Área 1" | "Área 2",
            father_name: values.father_name ?? "",
            mother_name: values.mother_name ?? "",
            father_phone: values.father_phone ?? "",
            mother_phone: values.mother_phone ?? "",
            address: values.address ?? "",
            confirmation_year: values.confirmation_year ? parseInt(values.confirmation_year) : null,
          } as any,
          { onConflict: "user_id" }
        );

      if (error) throw error;
      await refreshProfile();
      toast({ title: "Perfil atualizado!", description: "Suas informações foram salvas com sucesso." });
      setIsEditing(false);
    } catch (err: unknown) {
      console.error("Erro ao salvar perfil:", err);
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = (profile as any)?.avatar_url;

  const PhotoSection = () => (
    <div className="flex flex-col items-center gap-2 py-4">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadingPhoto}
        className="relative w-20 h-20 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden hover:border-secondary transition-colors group"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Foto" className="w-full h-full object-cover" />
        ) : (
          <User className="w-8 h-8 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
          <Camera className="w-5 h-5 text-white" />
        </div>
        {uploadingPhoto && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
            <span className="animate-spin w-5 h-5 border-2 border-white/40 border-t-white rounded-full" />
          </div>
        )}
      </button>
      <span className="text-xs text-muted-foreground font-inter">
        {avatarUrl ? "Toque para alterar a foto" : "Adicionar foto"}
      </span>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
    </div>
  );

  const inputClass = (fieldName: keyof ProfileFormValues) => {
    const hasError = !!errors[fieldName];
    const isDirty = !!dirtyFields[fieldName];
    const isValid = isDirty && !hasError;
    return `w-full h-10 rounded-xl border px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 transition-colors ${
      hasError
        ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5"
        : isValid
        ? "border-brand-green focus-visible:ring-brand-green/30 bg-brand-green/5"
        : "border-input bg-background focus-visible:ring-ring"
    }`;
  };

  if (!isEditing) {
    return (
      <div className="px-5 mt-4 space-y-3">
        {/* Personal Info Card */}
        <SectionCard
          icon={<User className="w-4 h-4 text-primary" />}
          title="Dados Pessoais"
          action={
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-xs font-inter text-primary bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary/20 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
          }
        >
          <PhotoSection />
          <div className="divide-y divide-border">
            <InfoRow icon={<User className="w-4 h-4 text-muted-foreground" />} label="Nome completo" value={profile?.full_name ?? "—"} />
            <InfoRow icon={<Phone className="w-4 h-4 text-muted-foreground" />} label="Telefone" value={profile?.phone ?? "—"} />
            <InfoRow
              icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
              label="Data de nascimento"
              value={
                profile?.birth_date
                  ? new Date(profile.birth_date + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <InfoRow icon={<MapPin className="w-4 h-4 text-muted-foreground" />} label="Comunidade" value={profile?.community ?? "—"} />
            <InfoRow icon={<MapPin className="w-4 h-4 text-muted-foreground" />} label="Área" value={profile?.area ?? "—"} />
            <InfoRow icon={<Home className="w-4 h-4 text-muted-foreground" />} label="Endereço" value={profile?.address || "—"} />
            <InfoRow icon={<GraduationCap className="w-4 h-4 text-muted-foreground" />} label="Ano Confirmatório" value={profile?.confirmation_year ? `${profile.confirmation_year}º Ano` : "Não definido"} />
          </div>
        </SectionCard>

        {/* Family Card */}
        <SectionCard
          icon={<Heart className="w-4 h-4 text-secondary" />}
          title="Dados Familiares"
        >
          <div className="divide-y divide-border">
            <InfoRow icon={<Users className="w-4 h-4 text-muted-foreground" />} label="Nome do pai" value={profile?.father_name || "—"} />
            <InfoRow icon={<Phone className="w-4 h-4 text-muted-foreground" />} label="Contato do pai" value={profile?.father_phone || "—"} />
            <InfoRow icon={<Users className="w-4 h-4 text-muted-foreground" />} label="Nome da mãe" value={profile?.mother_name || "—"} />
            <InfoRow icon={<Phone className="w-4 h-4 text-muted-foreground" />} label="Contato da mãe" value={profile?.mother_phone || "—"} />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="px-5 mt-4 space-y-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Personal Info Edit Card */}
        <SectionCard
          icon={<Pencil className="w-4 h-4 text-primary" />}
          title="Editar Dados Pessoais"
          action={
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 text-xs font-inter text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Cancelar
            </button>
          }
        >
          <PhotoSection />

          <div className="p-4 space-y-4">
            {/* Nome */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Nome completo *</label>
              <input
                {...register("full_name")}
                placeholder="Seu nome completo"
                className={inputClass("full_name")}
              />
              <FieldStatus
                error={errors.full_name?.message}
                isDirty={!!dirtyFields.full_name}
                isValid={!!dirtyFields.full_name && !errors.full_name}
              />
            </div>

            {/* Telefone principal com máscara */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">
                Telefone / WhatsApp *
              </label>
              <WhatsAppPhoneInput
                value={watchedValues.phone ?? ""}
                onChange={(formatted, validation) => {
                  // Atualiza o campo do form e o estado de validação
                  const syntheticEvent = {
                    target: { value: formatted, name: "phone" },
                  } as React.ChangeEvent<HTMLInputElement>;
                  register("phone").onChange(syntheticEvent);
                  setPhoneValidation(validation);
                }}
                showValidationAlways={!!dirtyFields.phone}
              />
              {errors.phone && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 text-destructive" />
                  <p className="text-[11px] text-destructive font-inter">{errors.phone.message}</p>
                </div>
              )}
            </div>

            {/* WhatsApp exclusivo (opcional — quando diferente do phone) */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground flex items-center gap-1.5">
                Número do WhatsApp
                <span className="text-[10px] text-muted-foreground/60 font-normal">(opcional — se diferente do telefone)</span>
              </label>
              <WhatsAppPhoneInput
                value={watchedValues.whatsapp_number ?? ""}
                onChange={(formatted, validation) => {
                  const syntheticEvent = {
                    target: { value: formatted, name: "whatsapp_number" },
                  } as React.ChangeEvent<HTMLInputElement>;
                  register("whatsapp_number").onChange(syntheticEvent);
                  setWaValidation(validation);
                }}
                showValidationAlways={!!dirtyFields.whatsapp_number}
                placeholder="(00) 00000-0000"
              />
              {/* Indicação visual quando o número exclusivo substitui o principal */}
              {waValidation.valid && watchedValues.whatsapp_number && (
                <p className="text-[10px] font-inter text-brand-green px-1">
                  ✓ Os lembretes automáticos usarão este número
                </p>
              )}
            </div>

            {/* Data de nascimento */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Data de nascimento *</label>
              <input
                type="date"
                {...register("birth_date")}
                className={inputClass("birth_date")}
              />
              <FieldStatus
                error={errors.birth_date?.message}
                isDirty={!!dirtyFields.birth_date}
                isValid={!!dirtyFields.birth_date && !errors.birth_date}
              />
            </div>

            {/* Comunidade */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Comunidade *</label>
              <div className="relative">
                <select
                  {...register("community")}
                  className={`${inputClass("community")} pr-8 appearance-none`}
                >
                  <option value="">Selecione sua comunidade</option>
                  {COMMUNITIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              <FieldStatus
                error={errors.community?.message}
                isDirty={!!dirtyFields.community}
                isValid={!!dirtyFields.community && !errors.community}
              />
            </div>

            {/* Endereço */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Endereço</label>
              <input
                {...register("address")}
                placeholder="Rua, nº, bairro, cidade"
                className={inputClass("address")}
              />
            </div>

            {/* Ano Confirmatório */}
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Ano do Ensino Confirmatório</label>
              <div className="relative">
                <select
                  {...register("confirmation_year")}
                  className={`${inputClass("confirmation_year")} pr-8 appearance-none`}
                >
                  {CONFIRMATION_YEARS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Family Edit Card */}
        <SectionCard
          icon={<Heart className="w-4 h-4 text-secondary" />}
          title="Dados Familiares"
        >
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Nome do pai</label>
              <input {...register("father_name")} placeholder="Nome completo do pai" className={inputClass("father_name")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Contato do pai</label>
              <input {...register("father_phone")} placeholder="(00) 00000-0000" className={inputClass("father_phone")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Nome da mãe</label>
              <input {...register("mother_name")} placeholder="Nome completo da mãe" className={inputClass("mother_name")} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Contato da mãe</label>
              <input {...register("mother_phone")} placeholder="(00) 00000-0000" className={inputClass("mother_phone")} />
            </div>
          </div>
        </SectionCard>

        {/* Save button */}
        <button
          type="submit"
          disabled={saving || Object.keys(errors).length > 0}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl font-montserrat font-bold text-sm text-primary-foreground transition-opacity disabled:opacity-60"
          style={{ background: "var(--gradient-hero)" }}
        >
          {saving ? (
            <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </form>
    </div>
  );
}

function SectionCard({ icon, title, action, children }: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-montserrat font-bold text-foreground text-sm">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground text-xs font-inter">{label}</p>
        <p className="text-foreground text-sm font-inter font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
