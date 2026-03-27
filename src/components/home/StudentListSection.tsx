import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, ChevronDown, ChevronUp, Phone, MapPin, Calendar, BookOpen, GraduationCap, Heart, CheckCircle2, Clock, AlertCircle, Pencil, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StudentProfile {
  user_id: string;
  full_name: string;
  community: string;
  area: string;
  birth_date: string;
  phone: string;
  father_name?: string;
  mother_name?: string;
  father_phone?: string;
  mother_phone?: string;
  address?: string;
  turma_id?: string | null;
  confirmation_year?: number | null;
}

interface Turma {
  id: string;
  name: string;
  area: string | null;
}

interface StudentStats {
  completedActivities: number;
  totalActivities: number;
  attendancePresent: number;
  attendanceTotal: number;
  worshipApproved: number;
  devotionalsCompleted: number;
  lessonResponses: number;
  healthStatus?: string;
  isPriority?: boolean;
  needsPastor?: boolean;
}

function calcAge(birthDate: string) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

const HEALTH_CFG: Record<string, { label: string; bg: string; text: string }> = {
  saudavel: { label: "🟢 Saudável", bg: "bg-brand-green/10", text: "text-brand-green" },
  atencao: { label: "🟡 Atenção", bg: "bg-accent/20", text: "text-accent-foreground" },
  critico: { label: "🔴 Necessita cuidado", bg: "bg-destructive/10", text: "text-destructive" },
};

export default function StudentListSection() {
  const { profile, role } = useAuth();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudentProfile>>({});
  const [saving, setSaving] = useState(false);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  const canView = role === "admin" || role === "lider";

  useEffect(() => {
    if (!canView || !profile?.turma_id || !expanded) return;
    
    async function fetchStudents() {
      setLoading(true);
      const [{ data }, { data: turmasData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, community, area, birth_date, phone, father_name, mother_name, father_phone, mother_phone, address, turma_id, confirmation_year")
          .eq("turma_id", profile!.turma_id!)
          .neq("user_id", profile!.user_id)
          .order("full_name"),
        supabase.from("turmas").select("id, name, area").eq("is_active", true).order("name"),
      ]);

      setTurmas(turmasData ?? []);
      
      // Filter out admins/leaders
      if (data && data.length > 0) {
        const userIds = data.map(d => d.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds)
          .in("role", ["admin", "lider"]);
        
        const adminIds = new Set((roles ?? []).map(r => r.user_id));
        setStudents(data.filter(d => !adminIds.has(d.user_id)) as StudentProfile[]);
      } else {
        setStudents([]);
      }
      setLoading(false);
    }
    fetchStudents();
  }, [canView, profile?.turma_id, expanded]);

  async function loadStudentDetails(student: StudentProfile) {
    setSelectedStudent(student);
    setEditing(false);
    setLoadingStats(true);
    setStudentStats(null);

    const now = new Date();
    const [
      { count: progressCount },
      { count: activityCount },
      { data: attendanceData },
      { count: worshipCount },
      { count: devotionalCount },
      { count: lessonCount },
      { data: planData },
      { data: assessData },
    ] = await Promise.all([
      supabase.from("user_progress").select("*", { count: "exact", head: true }).eq("user_id", student.user_id),
      supabase.from("activities").select("*", { count: "exact", head: true }),
      supabase.from("attendance").select("status").eq("user_id", student.user_id),
      supabase.from("worship_attendance").select("*", { count: "exact", head: true }).eq("user_id", student.user_id).eq("status", "aprovado"),
      supabase.from("devotional_progress").select("*", { count: "exact", head: true }).eq("user_id", student.user_id),
      supabase.from("lesson_responses").select("*", { count: "exact", head: true }).eq("user_id", student.user_id),
      supabase.from("discipleship_plans").select("health_status, is_priority").eq("user_id", student.user_id).maybeSingle(),
      supabase.from("spiritual_assessments").select("needs_pastor").eq("user_id", student.user_id).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).maybeSingle(),
    ]);

    const present = (attendanceData ?? []).filter(a => a.status === "presente").length;

    setStudentStats({
      completedActivities: progressCount ?? 0,
      totalActivities: activityCount ?? 0,
      attendancePresent: present,
      attendanceTotal: (attendanceData ?? []).length,
      worshipApproved: worshipCount ?? 0,
      devotionalsCompleted: devotionalCount ?? 0,
      lessonResponses: lessonCount ?? 0,
      healthStatus: planData?.health_status,
      isPriority: planData?.is_priority ?? false,
      needsPastor: assessData?.needs_pastor ?? false,
    });
    setLoadingStats(false);
  }

  function startEditing() {
    if (!selectedStudent) return;
    setEditForm({
      full_name: selectedStudent.full_name,
      phone: selectedStudent.phone,
      birth_date: selectedStudent.birth_date,
      address: selectedStudent.address ?? "",
      father_name: selectedStudent.father_name ?? "",
      mother_name: selectedStudent.mother_name ?? "",
      father_phone: selectedStudent.father_phone ?? "",
      mother_phone: selectedStudent.mother_phone ?? "",
      confirmation_year: selectedStudent.confirmation_year,
      turma_id: selectedStudent.turma_id,
    });
    setEditing(true);
  }

  async function saveEdits() {
    if (!selectedStudent) return;
    setSaving(true);
    const newTurmaId = editForm.turma_id ?? selectedStudent.turma_id;
    const turmaChanged = newTurmaId !== selectedStudent.turma_id;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name?.trim() || selectedStudent.full_name,
        phone: editForm.phone?.trim() || selectedStudent.phone,
        birth_date: editForm.birth_date || selectedStudent.birth_date,
        address: editForm.address?.trim() ?? "",
        father_name: editForm.father_name?.trim() ?? "",
        mother_name: editForm.mother_name?.trim() ?? "",
        father_phone: editForm.father_phone?.trim() ?? "",
        mother_phone: editForm.mother_phone?.trim() ?? "",
        confirmation_year: editForm.confirmation_year ?? null,
        turma_id: newTurmaId,
      } as any)
      .eq("user_id", selectedStudent.user_id);

    if (error) {
      toast.error("Erro ao salvar alterações");
      console.error(error);
    } else {
      const updated = {
        ...selectedStudent,
        full_name: editForm.full_name?.trim() || selectedStudent.full_name,
        phone: editForm.phone?.trim() || selectedStudent.phone,
        birth_date: editForm.birth_date || selectedStudent.birth_date,
        address: editForm.address?.trim() ?? "",
        father_name: editForm.father_name?.trim() ?? "",
        mother_name: editForm.mother_name?.trim() ?? "",
        father_phone: editForm.father_phone?.trim() ?? "",
        mother_phone: editForm.mother_phone?.trim() ?? "",
        confirmation_year: editForm.confirmation_year ?? null,
        turma_id: newTurmaId,
      };
      setSelectedStudent(updated);
      if (turmaChanged) {
        // Remove from list since student moved to another turma
        setStudents(prev => prev.filter(s => s.user_id !== updated.user_id));
        const turmaName = turmas.find(t => t.id === newTurmaId)?.name ?? "outra turma";
        toast.success(`${updated.full_name} transferido para "${turmaName}"`);
        setSelectedStudent(null);
      } else {
        setStudents(prev => prev.map(s => s.user_id === updated.user_id ? updated : s));
        toast.success("Dados atualizados com sucesso!");
      }
      setEditing(false);
    }
    setSaving(false);
  }

  if (!canView) return null;

  const age = selectedStudent ? calcAge(selectedStudent.birth_date) : null;
  const healthCfg = studentStats?.healthStatus ? HEALTH_CFG[studentStats.healthStatus] ?? HEALTH_CFG.atencao : null;
  const progressPct = studentStats && studentStats.totalActivities > 0 ? Math.round((studentStats.completedActivities / studentStats.totalActivities) * 100) : 0;

  return (
    <div className="mx-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 shadow-sm hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-montserrat font-bold text-foreground text-sm">Alunos da Turma</p>
            <p className="text-muted-foreground text-xs font-inter">
              {expanded ? "Toque para fechar" : "Toque para ver todos os alunos"}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-top-2 duration-200">
          {loading ? (
            <div className="p-6 text-center">
              <p className="text-muted-foreground text-sm font-inter animate-pulse">Carregando alunos...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-2xl mb-1">📚</p>
              <p className="text-muted-foreground text-sm font-inter">Nenhum aluno encontrado na turma.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {students.map((s) => {
                const studentAge = calcAge(s.birth_date);
                return (
                  <button
                    key={s.user_id}
                    onClick={() => loadStudentDetails(s)}
                    className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                      <span className="text-xs font-montserrat font-black text-primary-foreground">
                        {s.full_name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-montserrat font-bold text-foreground text-sm truncate">{s.full_name}</p>
                      <p className="text-muted-foreground text-[11px] font-inter">
                        {s.community}{studentAge ? ` · ${studentAge} anos` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground text-sm">→</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Student Details Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) { setSelectedStudent(null); setEditing(false); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                <span className="text-sm font-montserrat font-black text-primary-foreground">
                  {selectedStudent?.full_name[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-montserrat font-bold text-foreground text-base">{selectedStudent?.full_name}</p>
                <p className="text-muted-foreground text-xs font-inter font-normal">
                  {selectedStudent?.community} · {selectedStudent?.area}
                </p>
              </div>
              {!editing && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={startEditing} title="Editar dados">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingStats ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm font-inter animate-pulse">Carregando informações...</p>
            </div>
          ) : editing && selectedStudent ? (
            /* ===== EDIT MODE ===== */
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome completo</label>
                <Input value={editForm.full_name ?? ""} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} className="text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Telefone</label>
                  <Input value={editForm.phone ?? ""} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Data de nascimento</label>
                  <Input type="date" value={editForm.birth_date ?? ""} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Endereço</label>
                <Input value={editForm.address ?? ""} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Ano de confirmação</label>
                <Input type="number" min={1} max={3} value={editForm.confirmation_year ?? ""} onChange={e => setEditForm(f => ({ ...f, confirmation_year: e.target.value ? Number(e.target.value) : null }))} className="text-sm" placeholder="1 ou 2" />
              </div>
              <div>
                <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Turma</label>
                <select
                  value={editForm.turma_id ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, turma_id: e.target.value || null }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sem turma</option>
                  {turmas.map(t => (
                    <option key={t.id} value={t.id}>{t.name}{t.area ? ` (${t.area})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome do pai</label>
                  <Input value={editForm.father_name ?? ""} onChange={e => setEditForm(f => ({ ...f, father_name: e.target.value }))} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Telefone do pai</label>
                  <Input value={editForm.father_phone ?? ""} onChange={e => setEditForm(f => ({ ...f, father_phone: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Nome da mãe</label>
                  <Input value={editForm.mother_name ?? ""} onChange={e => setEditForm(f => ({ ...f, mother_name: e.target.value }))} className="text-sm" />
                </div>
                <div>
                  <label className="text-xs font-inter font-semibold text-muted-foreground mb-1 block">Telefone da mãe</label>
                  <Input value={editForm.mother_phone ?? ""} onChange={e => setEditForm(f => ({ ...f, mother_phone: e.target.value }))} className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={saveEdits} disabled={saving}>
                  <Save className="w-3.5 h-3.5" /> {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          ) : studentStats && selectedStudent ? (
            <div className="space-y-4 mt-2">
              {/* Health & Priority badges */}
              <div className="flex flex-wrap gap-2">
                {healthCfg && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-inter font-semibold ${healthCfg.bg} ${healthCfg.text}`}>
                    {healthCfg.label}
                  </span>
                )}
                {studentStats.isPriority && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-destructive/10 text-destructive">
                    ⚡ Prioridade pastoral
                  </span>
                )}
                {studentStats.needsPastor && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-inter font-semibold bg-accent/20 text-accent-foreground">
                    🙏 Precisa conversar com pastor
                  </span>
                )}
              </div>

              {/* Personal Info */}
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <p className="font-montserrat font-bold text-foreground text-xs uppercase tracking-wide mb-2">Informações Pessoais</p>
                <div className="grid grid-cols-2 gap-2 text-xs font-inter">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{age ? `${age} anos` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <a href={`tel:${selectedStudent.phone}`} className="text-primary hover:underline">{selectedStudent.phone || "—"}</a>
                  </div>
                  {selectedStudent.address && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{selectedStudent.address}</span>
                    </div>
                  )}
                  {selectedStudent.confirmation_year && (
                    <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{selectedStudent.confirmation_year}º ano de confirmação</span>
                    </div>
                  )}
                </div>

                {/* Parents */}
                {(selectedStudent.father_name || selectedStudent.mother_name) && (
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {selectedStudent.father_name && (
                      <div className="text-xs font-inter text-muted-foreground">
                        <span className="font-semibold">Pai:</span> {selectedStudent.father_name}
                        {selectedStudent.father_phone && (
                          <a href={`tel:${selectedStudent.father_phone}`} className="ml-1.5 text-primary hover:underline">
                            {selectedStudent.father_phone}
                          </a>
                        )}
                      </div>
                    )}
                    {selectedStudent.mother_name && (
                      <div className="text-xs font-inter text-muted-foreground">
                        <span className="font-semibold">Mãe:</span> {selectedStudent.mother_name}
                        {selectedStudent.mother_phone && (
                          <a href={`tel:${selectedStudent.mother_phone}`} className="ml-1.5 text-primary hover:underline">
                            {selectedStudent.mother_phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Stats */}
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="font-montserrat font-bold text-foreground text-xs uppercase tracking-wide mb-3">Progresso na Jornada</p>
                
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs font-inter mb-1">
                    <span className="text-muted-foreground">Atividades completas</span>
                    <span className="font-semibold text-foreground">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressPct}%`, background: "var(--gradient-hero)" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-inter">
                    {studentStats.completedActivities} de {studentStats.totalActivities}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card rounded-lg p-2.5 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                      <span className="text-[10px] text-muted-foreground font-inter">Presenças</span>
                    </div>
                    <p className="font-montserrat font-bold text-foreground text-sm">
                      {studentStats.attendancePresent}/{studentStats.attendanceTotal}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-2.5 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-inter">Devocionais</span>
                    </div>
                    <p className="font-montserrat font-bold text-foreground text-sm">
                      {studentStats.devotionalsCompleted}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-2.5 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Heart className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-inter">Cultos</span>
                    </div>
                    <p className="font-montserrat font-bold text-foreground text-sm">
                      {studentStats.worshipApproved}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg p-2.5 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-inter">Estudos</span>
                    </div>
                    <p className="font-montserrat font-bold text-foreground text-sm">
                      {studentStats.lessonResponses}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
