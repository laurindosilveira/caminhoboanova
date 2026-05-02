import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, User, Search, ShieldCheck, ShieldOff, CalendarDays, MapPin, ChevronRight, X, Save, Phone, Cake, Home, Users, GraduationCap, Clock, Download, Trash2, Mail, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WhatsAppPhoneInput from "@/components/ui/WhatsAppPhoneInput";
import { validateBRPhone, type PhoneValidation } from "@/lib/phoneValidation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import TurmasManagement from "./TurmasManagement";
import WaitingRoom from "./WaitingRoom";

type Turma = { id: string; name: string; year: number; area: string | null };

type UserEntry = {
  user_id: string;
  full_name: string;
  email: string;
  community: string;
  area: string;
  phone: string;
  whatsapp_number: string | null;
  whatsapp_validation_status: "valid" | "invalid" | "pending" | null;
  whatsapp_last_blocked_reason: string | null;
  birth_date: string;
  father_name: string;
  mother_name: string;
  father_phone: string;
  mother_phone: string;
  address: string;
  turma_id: string | null;
  role: "admin" | "lider" | "user";
  admin_area: string | null;
  created_year: number;
};

const ROLE_CFG = {
  admin: {
    label: "Administrador",
    icon: <ShieldCheck className="w-4 h-4" />,
    badge: "bg-primary/10 text-primary border-primary/30",
  },
  lider: {
    label: "Líder",
    icon: <ShieldCheck className="w-4 h-4" />,
    badge: "bg-accent/20 text-accent-foreground border-accent/30",
  },
  user: {
    label: "Participante",
    icon: <User className="w-4 h-4" />,
    badge: "bg-muted text-muted-foreground border-border",
  },
};

import { AREAS, AREA_COMMUNITIES } from "@/config/areas";

type UsersTabProps = {
  onSelectTurma?: (turma: { id: string; name: string; area: string | null; year: number }) => void;
};

export default function UsersTab({ onSelectTurma }: UsersTabProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<"users" | "turmas" | "waiting">("users");
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [promotingUser, setPromotingUser] = useState<UserEntry | null>(null);
  const [promotingRole, setPromotingRole] = useState<"admin" | "lider" | null>(null);
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", whatsapp_number: "", birth_date: "", community: "", area: "", father_name: "", mother_name: "", father_phone: "", mother_phone: "", address: "", turma_id: "" });
  const [editWaValidation, setEditWaValidation] = useState<PhoneValidation>(() => validateBRPhone(""));
  const [revalidating, setRevalidating] = useState(false);
  const [waStatus, setWaStatus] = useState<{ status: string; reason: string | null } | null>(null);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }, { data: turmasData, error: turmasError }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, community, area, phone, birth_date, father_name, mother_name, father_phone, mother_phone, address, created_at, turma_id").order("full_name"),
      supabase.from("user_roles").select("user_id, role, admin_area"),
      supabase.from("turmas").select("id, name, year, area").eq("is_active", true).order("year", { ascending: false }),
    ]);

    if (profilesError) {
      setUsers([]);
      setAvailableYears([]);
      setTurmas(turmasData ?? []);
      setLoading(false);
      toast({ title: "Erro ao carregar usuarios", description: profilesError.message, variant: "destructive" });
      return;
    }

    if (rolesError) {
      toast({ title: "Aviso ao carregar permissoes", description: rolesError.message, variant: "destructive" });
    }

    if (turmasError) {
      toast({ title: "Aviso ao carregar turmas", description: turmasError.message, variant: "destructive" });
    }

    setTurmas(turmasData ?? []);

    const userIds = (profiles ?? []).map(p => p.user_id);
    const whatsappByUser: Record<string, {
      whatsapp_number: string | null;
      whatsapp_validation_status: UserEntry["whatsapp_validation_status"];
      whatsapp_last_blocked_reason: string | null;
    }> = {};

    if (userIds.length > 0) {
      const { data: whatsappRows } = await supabase
        .from("profiles")
        .select("user_id, whatsapp_number, whatsapp_validation_status, whatsapp_last_blocked_reason")
        .in("user_id", userIds) as any;

      (whatsappRows ?? []).forEach((row: any) => {
        whatsappByUser[row.user_id] = {
          whatsapp_number: row.whatsapp_number ?? null,
          whatsapp_validation_status: row.whatsapp_validation_status ?? null,
          whatsapp_last_blocked_reason: row.whatsapp_last_blocked_reason ?? null,
        };
      });
    }

    const roleMap: Record<string, { role: "admin" | "lider" | "user"; admin_area: string | null }> = {};
    (roles ?? []).forEach(r => {
      const existing = roleMap[r.user_id];
      if (!existing || (r.role === "admin" && existing.role !== "admin")) {
        roleMap[r.user_id] = { role: r.role as "admin" | "lider" | "user", admin_area: r.admin_area ?? null };
      }
    });

    const combined: UserEntry[] = (profiles ?? []).map(p => ({
      ...p,
      email: (p as any).email ?? "",
      father_name: (p as any).father_name ?? "",
      mother_name: (p as any).mother_name ?? "",
      father_phone: (p as any).father_phone ?? "",
      mother_phone: (p as any).mother_phone ?? "",
      address: (p as any).address ?? "",
      whatsapp_number: whatsappByUser[p.user_id]?.whatsapp_number ?? null,
      whatsapp_validation_status: whatsappByUser[p.user_id]?.whatsapp_validation_status ?? null,
      whatsapp_last_blocked_reason: whatsappByUser[p.user_id]?.whatsapp_last_blocked_reason ?? null,
      turma_id: p.turma_id ?? null,
      role: roleMap[p.user_id]?.role ?? "user",
      admin_area: roleMap[p.user_id]?.admin_area ?? null,
      created_year: new Date(p.created_at).getFullYear(),
    }));

    const years = [...new Set(combined.map(u => u.created_year))].sort((a, b) => b - a);
    setAvailableYears(years);
    setUsers(combined);
    setLoading(false);
  }

  async function promoteToRole(u: UserEntry, targetRole: "admin" | "lider", area: string | null) {
    setSaving(u.user_id);
    const { error } = await supabase.from("user_roles").upsert({
      user_id: u.user_id, role: targetRole, admin_area: area,
    }, { onConflict: "user_id,role" });

    if (error) {
      // If conflict because user already has a different role row, update it
      const { error: err2 } = await supabase.from("user_roles")
        .update({ role: targetRole, admin_area: area })
        .eq("user_id", u.user_id);
      if (err2) {
        toast({ title: "Erro", description: err2.message, variant: "destructive" });
        setSaving(null);
        setPromotingUser(null);
        setPromotingRole(null);
        return;
      }
    }
    setUsers(prev => prev.map(p => p.user_id === u.user_id ? { ...p, role: targetRole, admin_area: area } : p));
    const roleLabel = targetRole === "admin" ? "Administrador" : "Líder";
    toast({ title: `✅ ${roleLabel} ativado`, description: `${u.full_name} agora é ${roleLabel}${area ? ` de ${area}` : ""}.` });
    setSaving(null);
    setPromotingUser(null);
    setPromotingRole(null);
  }

  async function demoteToUser(u: UserEntry) {
    setSaving(u.user_id);
    // Delete the admin/lider role row instead of updating, since a "user" row already exists
    const { error } = await supabase.from("user_roles")
      .delete()
      .eq("user_id", u.user_id)
      .in("role", ["admin", "lider"]);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setUsers(prev => prev.map(p => p.user_id === u.user_id ? { ...p, role: "user", admin_area: null } : p));
      toast({ title: "✅ Voltou a participante", description: `${u.full_name} agora é Participante.` });
    }
    setSaving(null);
  }

  function handleToggle(u: UserEntry) {
    if (u.role === "admin" || u.role === "lider") demoteToUser(u);
    else setPromotingUser(u);
  }

  function openEditUser(u: UserEntry) {
    setEditingUser(u);
    const waNum = u.whatsapp_number ?? "";
    setEditForm({
      full_name: u.full_name,
      phone: u.phone,
      whatsapp_number: waNum,
      birth_date: u.birth_date,
      community: u.community,
      area: u.area,
      father_name: u.father_name,
      mother_name: u.mother_name,
      father_phone: u.father_phone,
      mother_phone: u.mother_phone,
      address: u.address,
      turma_id: u.turma_id ?? "",
    });
    setEditWaValidation(validateBRPhone(waNum));
    setWaStatus(
      u.whatsapp_validation_status
        ? { status: u.whatsapp_validation_status, reason: u.whatsapp_last_blocked_reason }
        : null
    );
  }

  async function handleRevalidateWhatsApp() {
    if (!editingUser) return;
    setRevalidating(true);

    // 1. Salva o número atual antes de revalidar
    const waNum = editForm.whatsapp_number.trim() || null;
    await supabase.from("profiles").update({ whatsapp_number: waNum }).eq("user_id", editingUser.user_id);

    // 2. Chama a RPC de revalidação no banco
    const { data, error } = await supabase.rpc("revalidate_user_whatsapp", {
      _target_user_id: editingUser.user_id,
    });

    setRevalidating(false);

    if (error) {
      toast({ title: "Erro ao revalidar", description: error.message, variant: "destructive" });
      return;
    }

    const result = data as { status: string; e164: string | null; reason: string | null };
    setWaStatus({ status: result.status, reason: result.reason });

    // Atualiza lista local
    setUsers(prev => prev.map(u =>
      u.user_id === editingUser.user_id
        ? {
            ...u,
            whatsapp_number: waNum,
            whatsapp_validation_status: result.status as UserEntry["whatsapp_validation_status"],
            whatsapp_last_blocked_reason: result.reason,
          }
        : u
    ));

    if (result.status === "valid") {
      toast({ title: "✅ WhatsApp válido", description: `Número ${result.e164} confirmado.` });
    } else {
      toast({
        title: "❌ Número inválido",
        description: result.reason ?? "Verifique o número e tente novamente.",
        variant: "destructive",
      });
    }
  }

  async function saveEditUser() {
    if (!editingUser) return;
    setSavingEdit(true);

    // Determine correct area based on community
    const newArea = Object.entries(AREA_COMMUNITIES).find(([_, comms]) =>
      comms.includes(editForm.community)
    )?.[0] ?? editForm.area;

    const waNum = editForm.whatsapp_number.trim() || null;
    // Marca validação do WhatsApp ao salvar (sem sobrescrever status de revalidação explícita)
    const waValidNow = waNum ? editWaValidation : null;

    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name,
      phone: editForm.phone,
      whatsapp_number: waNum,
      whatsapp_validation_status: waNum
        ? (waValidNow?.valid ? "valid" : "invalid")
        : null,
      whatsapp_last_blocked_reason: waNum && !waValidNow?.valid
        ? (waValidNow?.hint ?? "Formato inválido")
        : null,
      whatsapp_last_blocked_at: waNum && !waValidNow?.valid ? new Date().toISOString() : null,
      birth_date: editForm.birth_date,
      community: editForm.community as any,
      area: newArea as any,
      father_name: editForm.father_name,
      mother_name: editForm.mother_name,
      father_phone: editForm.father_phone,
      mother_phone: editForm.mother_phone,
      address: editForm.address,
      turma_id: editForm.turma_id || null,
      enrollment_status: editForm.turma_id ? "approved" : "pending",
    } as any).eq("user_id", editingUser.user_id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setUsers(prev => prev.map(p =>
        p.user_id === editingUser.user_id
          ? {
              ...p,
              full_name: editForm.full_name,
              phone: editForm.phone,
              whatsapp_number: waNum,
              whatsapp_validation_status: waNum ? (waValidNow?.valid ? "valid" : "invalid") : null,
              birth_date: editForm.birth_date,
              community: editForm.community,
              area: newArea,
              turma_id: editForm.turma_id || null,
            }
          : p
      ));
      toast({ title: "✅ Perfil atualizado", description: `Dados de ${editForm.full_name} salvos.` });
      setEditingUser(null);
    }
    setSavingEdit(false);
  }

  async function deleteUser() {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: deletingUser.user_id },
      });
      if (res.error || res.data?.error) {
        toast({ title: "Erro ao deletar", description: res.data?.error || res.error?.message, variant: "destructive" });
      } else {
        setUsers(prev => prev.filter(u => u.user_id !== deletingUser.user_id));
        toast({ title: "🗑️ Usuário deletado", description: `${deletingUser.full_name} foi removido do sistema.` });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setIsDeleting(false);
    setDeletingUser(null);
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.community.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()));
    const matchesYear = selectedYear ? u.created_year === selectedYear : true;
    return matchesSearch && matchesYear;
  });

  const admins = filtered.filter(u => u.role === "admin");
  const lideres = filtered.filter(u => u.role === "lider");
  const regular = filtered.filter(u => u.role === "user");

  // Get communities for the selected area in edit form
  const editCommunities = AREA_COMMUNITIES[editForm.area] ?? [];

  if (subTab === "turmas") return (
    <div className="space-y-5">
      <SubTabNav active={subTab} onChange={setSubTab} />
      <TurmasManagement onSelectTurma={onSelectTurma} />
    </div>
  );

  if (subTab === "waiting") return (
    <div className="space-y-5">
      <SubTabNav active={subTab} onChange={setSubTab} />
      <WaitingRoom />
    </div>
  );

  return (
    <div className="space-y-5">
      <SubTabNav active={subTab} onChange={setSubTab} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-montserrat font-black text-foreground text-lg">Gerenciar Usuários</h2>
            <p className="text-muted-foreground text-xs font-inter">Gerencie funções e permissões</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/exportar-dados")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-montserrat font-bold transition-all border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou comunidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-2xl border-border" />
      </div>

      {/* Year filter */}
      {availableYears.length > 0 && (
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setSelectedYear(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${!selectedYear ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              Todos
            </button>
            {availableYears.map(year => (
              <button key={year} onClick={() => setSelectedYear(year)}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all ${selectedYear === year ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Role selection modal for promoting */}
      {promotingUser && !promotingRole && (
        <div className="bg-card border-2 border-primary/30 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-montserrat font-bold text-foreground text-sm">
            Definir função de <span className="text-primary">{promotingUser.full_name}</span>
          </p>
          <p className="text-muted-foreground font-inter text-xs">Qual função atribuir?</p>
          <div className="flex gap-2">
            <button onClick={() => setPromotingRole("lider")}
              className="flex-1 flex flex-col items-center gap-1 px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl text-sm font-montserrat font-bold text-accent-foreground transition-all">
              <ShieldCheck className="w-5 h-5" />
              Líder
              <span className="text-[10px] font-inter font-normal text-muted-foreground">Acesso: Cursos e Usuários</span>
            </button>
            <button onClick={() => setPromotingRole("admin")}
              className="flex-1 flex flex-col items-center gap-1 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-sm font-montserrat font-bold text-primary transition-all">
              <ShieldCheck className="w-5 h-5" />
              Admin
              <span className="text-[10px] font-inter font-normal text-muted-foreground">Acesso completo</span>
            </button>
          </div>
          <button onClick={() => { setPromotingUser(null); setPromotingRole(null); }} className="w-full text-center text-xs font-inter text-muted-foreground hover:text-foreground transition-colors py-1">Cancelar</button>
        </div>
      )}

      {/* Area selection for admin role */}
      {promotingUser && promotingRole === "admin" && (
        <div className="bg-card border-2 border-primary/30 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-montserrat font-bold text-foreground text-sm">
            Selecione a turma para <span className="text-primary">{promotingUser.full_name}</span>
          </p>
          <p className="text-muted-foreground font-inter text-xs">Qual área este administrador vai liderar?</p>
          <div className="flex gap-2">
            {AREAS.map(area => (
              <button key={area} onClick={() => promoteToRole(promotingUser, "admin", area)} disabled={saving === promotingUser.user_id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-sm font-montserrat font-bold text-primary transition-all disabled:opacity-50">
                <MapPin className="w-4 h-4" />{area}
              </button>
            ))}
          </div>
          <button onClick={() => setPromotingRole(null)} className="w-full text-center text-xs font-inter text-muted-foreground hover:text-foreground transition-colors py-1">Voltar</button>
        </div>
      )}

      {/* Area selection for lider role */}
      {promotingUser && promotingRole === "lider" && (
        <div className="bg-card border-2 border-accent/30 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="font-montserrat font-bold text-foreground text-sm">
            Selecione a turma para <span className="text-accent-foreground">{promotingUser.full_name}</span>
          </p>
          <p className="text-muted-foreground font-inter text-xs">Qual área este líder vai acompanhar?</p>
          <div className="flex gap-2">
            {AREAS.map(area => (
              <button key={area} onClick={() => promoteToRole(promotingUser, "lider", area)} disabled={saving === promotingUser.user_id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-xl text-sm font-montserrat font-bold text-accent-foreground transition-all disabled:opacity-50">
                <MapPin className="w-4 h-4" />{area}
              </button>
            ))}
          </div>
          <button onClick={() => setPromotingRole(null)} className="w-full text-center text-xs font-inter text-muted-foreground hover:text-foreground transition-colors py-1">Voltar</button>
        </div>
      )}

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground text-base">Editar perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Nome completo</label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Cake className="w-3 h-3" /> Nascimento</label>
                <Input type="date" value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            {/* WhatsApp exclusivo com revalidação */}
            <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-inter font-medium text-muted-foreground flex items-center gap-1.5">
                  💬 WhatsApp (para lembretes automáticos)
                </label>
                {/* Badge de status */}
                {waStatus && (
                  <span className={`flex items-center gap-1 text-[10px] font-inter font-bold px-2 py-0.5 rounded-full ${
                    waStatus.status === "valid"
                      ? "bg-brand-green/15 text-brand-green"
                      : "bg-destructive/15 text-destructive"
                  }`}>
                    {waStatus.status === "valid"
                      ? <><CheckCircle2 className="w-3 h-3" /> Válido</>
                      : <><AlertCircle className="w-3 h-3" /> Inválido</>
                    }
                  </span>
                )}
              </div>

              <WhatsAppPhoneInput
                value={editForm.whatsapp_number}
                onChange={(formatted, validation) => {
                  setEditForm(f => ({ ...f, whatsapp_number: formatted }));
                  setEditWaValidation(validation);
                  // Limpa status anterior quando usuário edita
                  if (waStatus) setWaStatus(null);
                }}
                showValidationAlways={editForm.whatsapp_number.length > 0}
              />

              {/* Motivo do bloqueio anterior */}
              {waStatus?.status === "invalid" && waStatus.reason && (
                <p className="text-[10px] font-inter text-destructive/80 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  Último erro: {waStatus.reason}
                </p>
              )}

              {/* Botão Revalidar */}
              <button
                type="button"
                onClick={handleRevalidateWhatsApp}
                disabled={revalidating || editForm.whatsapp_number.length < 10}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-montserrat font-bold border border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${revalidating ? "animate-spin" : ""}`} />
                {revalidating ? "Revalidando..." : "Revalidar WhatsApp"}
              </button>
            </div>

            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Área</label>
              <div className="flex gap-2">
                {AREAS.map(area => (
                  <button key={area} onClick={() => {
                    const newComms = AREA_COMMUNITIES[area] ?? [];
                    setEditForm(f => ({ ...f, area, community: newComms.includes(f.community) ? f.community : newComms[0] ?? "" }));
                  }}
                    className={`flex-1 py-2 rounded-xl text-xs font-montserrat font-bold transition-all border ${
                      editForm.area === area ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}>
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Comunidade</label>
              <select value={editForm.community} onChange={e => setEditForm(f => ({ ...f, community: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                {editCommunities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Home className="w-3 h-3" /> Endereço</label>
              <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="rounded-xl" placeholder="Rua, nº, bairro, cidade" />
            </div>

            {/* Turma selector */}
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Turma</label>
              <select value={editForm.turma_id} onChange={e => setEditForm(f => ({ ...f, turma_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none">
                <option value="">Sem turma (Sala de espera)</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.name} ({t.year})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Nome do pai</label>
                <Input value={editForm.father_name} onChange={e => setEditForm(f => ({ ...f, father_name: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Contato pai</label>
                <Input value={editForm.father_phone} onChange={e => setEditForm(f => ({ ...f, father_phone: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Nome da mãe</label>
                <Input value={editForm.mother_name} onChange={e => setEditForm(f => ({ ...f, mother_name: e.target.value }))} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Contato mãe</label>
                <Input value={editForm.mother_phone} onChange={e => setEditForm(f => ({ ...f, mother_phone: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={saveEditUser} disabled={savingEdit || !editForm.full_name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-montserrat font-bold text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}>
              <Save className="w-4 h-4" />
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </button>
            <button onClick={() => { setDeletingUser(editingUser); setEditingUser(null); }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-montserrat font-bold text-destructive bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-all"
              title="Deletar usuário">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat font-bold">Deletar usuário?</AlertDialogTitle>
            <AlertDialogDescription className="font-inter text-sm">
              Tem certeza que deseja deletar <span className="font-bold text-foreground">{deletingUser?.full_name}</span>? 
              Esta ação é irreversível e removerá todos os dados do usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-montserrat font-bold" disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} disabled={isDeleting}
              className="rounded-xl font-montserrat font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deletando..." : "Sim, deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="bg-muted rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : (
        <>
          {admins.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-montserrat font-bold text-muted-foreground uppercase tracking-wide">Administradores ({admins.length})</span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {admins.map((u, i) => (
                  <UserRow key={u.user_id} user={u} isLast={i === admins.length - 1} isSaving={saving === u.user_id}
                    onToggle={() => handleToggle(u)} onEdit={() => openEditUser(u)} />
                ))}
              </div>
            </div>
          )}

          {lideres.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="text-xs font-montserrat font-bold text-muted-foreground uppercase tracking-wide">Líderes ({lideres.length})</span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {lideres.map((u, i) => (
                  <UserRow key={u.user_id} user={u} isLast={i === lideres.length - 1} isSaving={saving === u.user_id}
                    onToggle={() => handleToggle(u)} onEdit={() => openEditUser(u)} />
                ))}
              </div>
            </div>
          )}

          {regular.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-montserrat font-bold text-muted-foreground uppercase tracking-wide">Participantes ({regular.length})</span>
              </div>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {regular.map((u, i) => (
                  <UserRow key={u.user_id} user={u} isLast={i === regular.length - 1} isSaving={saving === u.user_id}
                    onToggle={() => handleToggle(u)} onEdit={() => openEditUser(u)} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground font-inter text-sm">Nenhum usuário encontrado.</div>
          )}
        </>
      )}
    </div>
  );
}

function UserRow({
  user: u, isLast, isSaving, onToggle, onEdit,
}: {
  user: UserEntry; isLast: boolean; isSaving: boolean; onToggle: () => void; onEdit: () => void;
}) {
  const cfg = ROLE_CFG[u.role];
  const initials = u.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-border" : ""} ${isSaving ? "opacity-60" : ""}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-montserrat font-black text-sm ${
        u.role === "admin" ? "bg-primary text-primary-foreground" : u.role === "lider" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
        <p className="font-montserrat font-bold text-foreground text-sm truncate">{u.full_name}</p>
        <p className="text-muted-foreground text-xs font-inter truncate">
          {u.community} · {u.area}
          {u.role === "admin" && u.admin_area && (
            <span className="text-primary font-medium"> · Lidera {u.admin_area}</span>
          )}
          {u.role === "lider" && u.admin_area && (
            <span className="text-accent-foreground font-medium"> · Líder {u.admin_area}</span>
          )}
        </p>
        {u.email && (
          <p className="text-muted-foreground text-[10px] font-inter flex items-center gap-1 truncate">
            <Mail className="w-3 h-3 flex-shrink-0" />{u.email}
          </p>
        )}
      </div>
      <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 flex-shrink-0 mr-1" title="Editar">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
      <button onClick={onToggle} disabled={isSaving}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-montserrat font-bold transition-all disabled:opacity-50 ${cfg.badge}`}>
        {(u.role === "admin" || u.role === "lider") ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        {u.role === "admin" ? "Remover" : u.role === "lider" ? "Remover" : "Promover"}
      </button>
    </div>
  );
}

type SubTabType = "users" | "turmas" | "waiting";
const SUB_TABS: { id: SubTabType; label: string; icon: typeof Shield }[] = [
  { id: "users", label: "Usuários", icon: Shield },
  { id: "turmas", label: "Turmas", icon: GraduationCap },
  { id: "waiting", label: "Sala de Espera", icon: Clock },
];

function SubTabNav({ active, onChange }: { active: SubTabType; onChange: (t: SubTabType) => void }) {
  return (
    <div className="flex gap-1.5 bg-muted rounded-2xl p-1">
      {SUB_TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-montserrat font-bold transition-all ${
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
