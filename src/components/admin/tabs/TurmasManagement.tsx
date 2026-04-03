import { useState, useEffect } from "react";
import { AREAS } from "@/config/areas";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GraduationCap, Calendar, Pencil, Archive, CheckCircle2, RotateCcw, ChevronDown, ChevronUp, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TurmaReportPDF from "@/components/admin/TurmaReportPDF";

type Turma = {
  id: string;
  name: string;
  area: string | null;
  year: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  member_count?: number;
};

type Props = {
  onSelectTurma?: (turma: Turma) => void;
};

export default function TurmasManagement({ onSelectTurma }: Props) {
  const { toast } = useToast();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", area: "", year: new Date().getFullYear(), description: "" });
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [archiving, setArchiving] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Turma | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedPdfData, setArchivedPdfData] = useState<Record<string, { participants: any[]; activities: any[] }>>({});
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<Turma | null>(null);
  const [resetting, setResetting] = useState(false);

  async function loadArchivedTurmaData(turmaId: string) {
    if (archivedPdfData[turmaId]) return;
    setLoadingPdf(turmaId);
    const [{ data: profiles }, { data: activitiesData }, { data: progressData }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, community, area, birth_date, phone, turma_id").eq("turma_id", turmaId),
      supabase.from("activities").select("*").order("order_num"),
      supabase.from("user_progress").select("user_id, activity_id"),
    ]);
    const participantList = (profiles ?? []).map(p => {
      const userProgress = (progressData ?? []).filter(pr => pr.user_id === p.user_id);
      return { ...p, completed_count: userProgress.length, completed_activity_ids: userProgress.map(pr => pr.activity_id) };
    });
    setArchivedPdfData(prev => ({ ...prev, [turmaId]: { participants: participantList, activities: activitiesData ?? [] } }));
    setLoadingPdf(null);
  }


  useEffect(() => { fetchTurmas(); }, []);

  async function fetchTurmas() {
    setLoading(true);
    const { data } = await supabase.from("turmas").select("*").order("year", { ascending: false }).order("name");
    
    const { data: profiles } = await supabase.from("profiles").select("turma_id");
    const countMap: Record<string, number> = {};
    (profiles ?? []).forEach(p => {
      if (p.turma_id) countMap[p.turma_id] = (countMap[p.turma_id] ?? 0) + 1;
    });

    setTurmas((data ?? []).map(t => ({ ...t, member_count: countMap[t.id] ?? 0 })));
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setCreating(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("turmas").insert({
      name: form.name.trim(),
      area: form.area || null,
      year: form.year,
      description: form.description.trim() || null,
      created_by: user.user?.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Turma criada", description: `"${form.name}" foi adicionada.` });
      setForm({ name: "", area: "", year: new Date().getFullYear(), description: "" });
      setShowCreate(false);
      fetchTurmas();
    }
    setCreating(false);
  }

  async function handleEdit() {
    if (!editingTurma || !editForm.name.trim()) return;
    const { error } = await supabase.from("turmas").update({
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
    }).eq("id", editingTurma.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Turma atualizada" });
      setEditingTurma(null);
      fetchTurmas();
    }
  }

  async function handleDelete(turma: Turma) {
    if (turma.member_count && turma.member_count > 0) {
      toast({ title: "Não é possível excluir", description: `A turma "${turma.name}" possui ${turma.member_count} membro(s). Remova-os antes.`, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("turmas").delete().eq("id", turma.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "🗑️ Turma removida", description: `"${turma.name}" foi excluída.` });
      fetchTurmas();
    }
  }

  async function handleArchive(turma: Turma) {
    setArchiving(turma.id);
    
    // Fetch profiles in this turma with their confirmation_year
    const { data: turmaProfiles } = await supabase
      .from("profiles")
      .select("user_id, confirmation_year")
      .eq("turma_id", turma.id);
    
    const allProfiles = turmaProfiles ?? [];
    const secondYearUsers = allProfiles.filter(p => (p as any).confirmation_year === 2);

    if (secondYearUsers.length === 0) {
      toast({ 
        title: "Nenhum aluno do 2º ano", 
        description: "Não há alunos do 2º ano para confirmar nesta turma.", 
        variant: "destructive" 
      });
      setArchiving(null);
      setConfirmArchive(null);
      return;
    }

    // Create an archived copy turma for the 2nd year students
    const { data: user } = await supabase.auth.getUser();
    const archiveName = `${turma.name} — CONFIRMADOS`;
    const { data: newTurma, error: createError } = await supabase.from("turmas").insert({
      name: archiveName,
      area: turma.area,
      year: turma.year,
      description: `Grupo confirmado em ${new Date().toLocaleDateString("pt-BR")}. ${secondYearUsers.length} confirmando(s).`,
      is_active: false,
      created_by: user.user?.id,
    }).select("id").single();

    if (createError || !newTurma) {
      toast({ title: "Erro ao criar arquivo", description: createError?.message ?? "Erro desconhecido", variant: "destructive" });
      setArchiving(null);
      setConfirmArchive(null);
      return;
    }

    // Move 2nd year users to the archived turma
    await supabase.from("profiles").update({ turma_id: newTurma.id } as any)
      .in("user_id", secondYearUsers.map(p => p.user_id));

    // 1st year users stay in the original turma (unchanged)
    const firstYearCount = allProfiles.length - secondYearUsers.length;

    toast({ 
      title: "📦 Grupo confirmado!", 
      description: `"${archiveName}" criado com ${secondYearUsers.length} confirmando(s). ${firstYearCount} aluno(s) do 1º ano permanecem na turma "${turma.name}".`
    });
    
    fetchTurmas();
    setArchiving(null);
    setConfirmArchive(null);
  }

  async function handleResetJourney(turma: Turma) {
    setResetting(true);
    
    // Get all user IDs in this turma
    const { data: turmaProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("turma_id", turma.id);
    
    const userIds = (turmaProfiles ?? []).map(p => p.user_id);
    
    if (userIds.length === 0) {
      toast({ title: "Nenhum membro", description: "Esta turma não possui membros.", variant: "destructive" });
      setResetting(false);
      setConfirmReset(null);
      return;
    }

    // Delete all progress, lesson responses, devotional progress, achievement unlocks for these users
    await Promise.all([
      supabase.from("user_progress").delete().in("user_id", userIds),
      supabase.from("lesson_responses").delete().in("user_id", userIds),
      supabase.from("devotional_progress").delete().in("user_id", userIds),
      supabase.from("achievement_unlocks").delete().in("user_id", userIds),
      supabase.from("attendance").delete().in("user_id", userIds),
      supabase.from("worship_attendance").delete().in("user_id", userIds),
    ]);

    // Close ranking seasons for the communities involved
    const { data: profiles } = await supabase.from("profiles").select("community").in("user_id", userIds);
    const communities = [...new Set((profiles ?? []).map(p => p.community))];
    
    toast({ 
      title: "🔄 Jornada reiniciada!", 
      description: `Progresso de ${userIds.length} aluno(s) da turma "${turma.name}" foi zerado.` 
    });
    
    setResetting(false);
    setConfirmReset(null);
  }

  async function handleReactivate(turma: Turma) {
    setArchiving(turma.id);
    const { error } = await supabase.from("turmas").update({ is_active: true }).eq("id", turma.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Turma reativada", description: `"${turma.name}" voltou a ficar ativa.` });
      fetchTurmas();
    }
    setArchiving(null);
  }

  const currentYear = new Date().getFullYear();

  const activeTurmas = turmas.filter(t => t.is_active);
  const archivedTurmas = turmas.filter(t => !t.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-montserrat font-black text-foreground text-lg">Turmas</h2>
            <p className="text-muted-foreground text-xs font-inter">Gerencie as turmas de ensino</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold text-primary-foreground transition-all active:scale-95"
          style={{ background: "var(--gradient-hero)" }}>
          <Plus className="w-4 h-4" /> Nova turma
        </button>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground text-base">Criar nova turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Nome da turma</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Confirmatório 2026/1" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Área (opcional)</label>
              <div className="flex gap-2">
                <button onClick={() => setForm(f => ({ ...f, area: "" }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-montserrat font-bold transition-all border ${!form.area ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                  Todas
                </button>
                {AREAS.map(area => (
                  <button key={area} onClick={() => setForm(f => ({ ...f, area }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-montserrat font-bold transition-all border ${form.area === area ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                    {area}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ano
              </label>
              <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || currentYear }))} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição..." className="rounded-xl" />
            </div>
            <button onClick={handleCreate} disabled={creating || !form.name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-montserrat font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--gradient-hero)" }}>
              {creating ? "Criando..." : "Criar turma"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingTurma} onOpenChange={(open) => !open && setEditingTurma(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground text-base">Editar turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Nome da turma</label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-inter font-medium text-muted-foreground mb-1 block">Descrição (opcional)</label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl" />
            </div>
            <button onClick={handleEdit} disabled={!editForm.name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-montserrat font-bold text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--gradient-hero)" }}>
              Salvar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm archive dialog */}
      <Dialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground text-base">Confirmar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-montserrat font-bold text-foreground text-sm">{confirmArchive?.name}</p>
                <p className="text-muted-foreground font-inter text-xs mt-0.5">
                  {confirmArchive?.member_count ?? 0} membro{(confirmArchive?.member_count ?? 0) !== 1 ? "s" : ""} · {confirmArchive?.year}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground font-inter text-xs leading-relaxed">
              Os alunos do <strong>2º ano</strong> serão movidos para um arquivo chamado "<strong>{confirmArchive?.name} — CONFIRMADOS</strong>". Os alunos do <strong>1º ano permanecerão na turma</strong> original.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmArchive(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-montserrat font-bold bg-muted text-muted-foreground border border-border">
                Cancelar
              </button>
              <button onClick={() => confirmArchive && handleArchive(confirmArchive)}
                disabled={archiving === confirmArchive?.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-montserrat font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                {archiving === confirmArchive?.id ? "Arquivando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm reset journey dialog */}
      <Dialog open={!!confirmReset} onOpenChange={(open) => !open && setConfirmReset(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat font-bold text-foreground text-base">Reiniciar Jornada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="font-montserrat font-bold text-foreground text-sm">{confirmReset?.name}</p>
                <p className="text-muted-foreground font-inter text-xs mt-0.5">
                  {confirmReset?.member_count ?? 0} membro{(confirmReset?.member_count ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-destructive font-inter text-xs leading-relaxed font-medium">
              ⚠️ Esta ação é <strong>irreversível</strong>! Todo o progresso dos alunos será apagado:
            </p>
            <ul className="text-muted-foreground font-inter text-xs space-y-1 pl-4">
              <li>• Atividades concluídas</li>
              <li>• Respostas das lições</li>
              <li>• Devocionais completados</li>
              <li>• Conquistas desbloqueadas</li>
              <li>• Ranking / Pontos da Fé</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-montserrat font-bold bg-muted text-muted-foreground border border-border">
                Cancelar
              </button>
              <button onClick={() => confirmReset && handleResetJourney(confirmReset)}
                disabled={resetting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-montserrat font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
                {resetting ? "Reiniciando..." : "Reiniciar tudo"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Turmas list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : activeTurmas.length === 0 && archivedTurmas.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-inter text-sm">Nenhuma turma criada ainda.</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Clique em "Nova turma" para começar.</p>
        </div>
      ) : (
        <>
          {/* Active turmas */}
          {activeTurmas.length > 0 && (
            <div className="space-y-2">
              {activeTurmas.map(turma => (
                <div key={turma.id}
                  className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelectTurma?.(turma)}>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-montserrat font-bold text-foreground text-sm truncate">{turma.name}</p>
                      <p className="text-muted-foreground text-xs font-inter mt-0.5">
                        {turma.year} · {turma.area || "Todas as áreas"} · {turma.member_count ?? 0} membro{(turma.member_count ?? 0) !== 1 ? "s" : ""}
                      </p>
                      {turma.description && (
                        <p className="text-muted-foreground text-xs font-inter mt-0.5 truncate">{turma.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setEditingTurma(turma); setEditForm({ name: turma.name, description: turma.description || "" }); }}
                        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20" title="Editar turma">
                        <Pencil className="w-4 h-4 text-primary" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(turma); }}
                        className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20" title="Excluir turma">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                  {/* Archive + Reset buttons */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmArchive(turma); }}
                      disabled={archiving === turma.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-montserrat font-bold border-2 border-green-500/30 bg-green-500/5 text-green-700 hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Grupo Confirmado
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmReset(turma); }}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-montserrat font-bold border-2 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-all"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reiniciar Jornada
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTurmas.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground font-inter text-sm">Nenhuma turma ativa no momento.</p>
            </div>
          )}

          {/* Archived turmas section */}
          {archivedTurmas.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="w-full flex items-center gap-3 py-3 px-4 bg-muted/50 rounded-2xl border border-border hover:bg-muted transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <Archive className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-montserrat font-bold text-muted-foreground text-sm">Arquivo</p>
                  <p className="text-muted-foreground font-inter text-[10px]">
                    {archivedTurmas.length} turma{archivedTurmas.length !== 1 ? "s" : ""} confirmada{archivedTurmas.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {showArchive
                  ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                }
              </button>

              {showArchive && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  {archivedTurmas.map(turma => {
                    const pdfData = archivedPdfData[turma.id];
                    return (
                      <div key={turma.id} className="bg-card/50 border border-border rounded-2xl p-4 opacity-80">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                            <Archive className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-montserrat font-bold text-foreground text-sm truncate">{turma.name}</p>
                              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 text-[10px] font-montserrat font-bold flex-shrink-0">
                                ✓ Confirmado
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs font-inter mt-0.5">
                              {turma.year} · {turma.area || "Todas as áreas"} · {turma.member_count ?? 0} membro{(turma.member_count ?? 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            {pdfData ? (
                              <TurmaReportPDF participants={pdfData.participants} activities={pdfData.activities} turmaName={turma.name} />
                            ) : (
                              <button
                                onClick={() => loadArchivedTurmaData(turma.id)}
                                disabled={loadingPdf === turma.id}
                                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 flex-shrink-0 disabled:opacity-50"
                                title="Carregar relatório PDF"
                              >
                                {loadingPdf === turma.id
                                  ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                  : <Download className="w-4 h-4 text-primary" />
                                }
                              </button>
                            )}
                            <button
                              onClick={() => handleReactivate(turma)}
                              disabled={archiving === turma.id}
                              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 flex-shrink-0 disabled:opacity-50"
                              title="Reativar turma"
                            >
                              <RotateCcw className="w-4 h-4 text-primary" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
