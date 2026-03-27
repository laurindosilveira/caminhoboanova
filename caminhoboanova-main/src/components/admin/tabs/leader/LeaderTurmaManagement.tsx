import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { GraduationCap, CheckCircle2, RefreshCw, Users, Archive, ChevronDown, ChevronUp, Download, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TurmaReportPDF from "@/components/admin/TurmaReportPDF";

type Turma = {
  id: string;
  name: string;
  area: string | null;
  year: number;
  description: string | null;
  is_active: boolean;
  member_count?: number;
};

export default function LeaderTurmaManagement() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const { toast } = useToast();
  const [turma, setTurma] = useState<Turma | null>(null);
  const [archivedTurmas, setArchivedTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedPdfData, setArchivedPdfData] = useState<Record<string, { participants: any[]; activities: any[] }>>({});
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  useEffect(() => {
    fetchTurma();
  }, [profile?.turma_id]);

  async function fetchTurma() {
    if (!profile?.turma_id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: turmaData }, { data: allTurmas }] = await Promise.all([
      supabase.from("turmas").select("*").eq("id", profile.turma_id).single(),
      supabase.from("turmas").select("*").eq("is_active", false).order("year", { ascending: false }),
    ]);

    if (turmaData) {
      const { data: profiles } = await supabase.from("profiles").select("turma_id").eq("turma_id", turmaData.id);
      setTurma({ ...turmaData, member_count: profiles?.length ?? 0 });
    }

    // Filter archived turmas by same area
    const myArea = effectiveArea || profile?.area;
    const filtered = (allTurmas ?? []).filter(t => t.area === myArea);
    const { data: allProfiles } = await supabase.from("profiles").select("turma_id");
    const countMap: Record<string, number> = {};
    (allProfiles ?? []).forEach(p => {
      if (p.turma_id) countMap[p.turma_id] = (countMap[p.turma_id] ?? 0) + 1;
    });
    setArchivedTurmas(filtered.map(t => ({ ...t, member_count: countMap[t.id] ?? 0 })));

    setLoading(false);
  }

  async function handleArchive() {
    if (!turma) return;
    setArchiving(true);

    const { data: turmaProfiles } = await supabase
      .from("profiles")
      .select("user_id, confirmation_year")
      .eq("turma_id", turma.id);

    const allProfiles = turmaProfiles ?? [];
    const secondYearUsers = allProfiles.filter(p => (p as any).confirmation_year === 2);

    if (secondYearUsers.length === 0) {
      toast({ title: "Nenhum aluno do 2º ano", description: "Não há alunos do 2º ano para confirmar nesta turma.", variant: "destructive" });
      setArchiving(false);
      setConfirmArchive(false);
      return;
    }

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
      setArchiving(false);
      setConfirmArchive(false);
      return;
    }

    await supabase.from("profiles").update({ turma_id: newTurma.id } as any)
      .in("user_id", secondYearUsers.map(p => p.user_id));

    const firstYearCount = allProfiles.length - secondYearUsers.length;
    toast({
      title: "📦 Grupo confirmado!",
      description: `"${archiveName}" criado com ${secondYearUsers.length} confirmando(s). ${firstYearCount} aluno(s) do 1º ano permanecem.`
    });

    fetchTurma();
    setArchiving(false);
    setConfirmArchive(false);
  }

  async function handleResetJourney() {
    if (!turma) return;
    setResetting(true);

    const { data: turmaProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("turma_id", turma.id);

    const userIds = (turmaProfiles ?? []).map(p => p.user_id);

    if (userIds.length === 0) {
      toast({ title: "Nenhum membro", description: "Esta turma não possui membros.", variant: "destructive" });
      setResetting(false);
      setConfirmReset(false);
      return;
    }

    await Promise.all([
      supabase.from("user_progress").delete().in("user_id", userIds),
      supabase.from("lesson_responses").delete().in("user_id", userIds),
      supabase.from("devotional_progress").delete().in("user_id", userIds),
      supabase.from("achievement_unlocks").delete().in("user_id", userIds),
      supabase.from("attendance").delete().in("user_id", userIds),
      supabase.from("worship_attendance").delete().in("user_id", userIds),
    ]);

    toast({
      title: "🔄 Jornada reiniciada!",
      description: `Progresso de ${userIds.length} aluno(s) da turma "${turma.name}" foi zerado.`
    });

    setResetting(false);
    setConfirmReset(false);
  }

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

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <p className="text-muted-foreground text-sm font-inter animate-pulse">Carregando dados da turma...</p>
      </div>
    );
  }

  if (!turma) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
          <GraduationCap className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Você não está vinculado a nenhuma turma.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-montserrat font-black text-foreground text-base">Gerência da Turma</h2>
          <p className="text-muted-foreground text-xs font-inter">Confirmação e reinício de jornada</p>
        </div>
      </div>

      {/* Current turma card */}
      <div className="bg-card border-2 border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-4">
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
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setConfirmArchive(true)}
            disabled={archiving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-montserrat font-bold border-2 border-green-500/30 bg-green-500/5 text-green-700 hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Grupo Confirmado
          </button>
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-montserrat font-bold border-2 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reiniciar Jornada
          </button>
        </div>
      </div>

      {/* Confirm archive dialog */}
      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
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
                <p className="font-montserrat font-bold text-foreground text-sm">{turma.name}</p>
                <p className="text-muted-foreground font-inter text-xs mt-0.5">
                  {turma.member_count ?? 0} membro{(turma.member_count ?? 0) !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground font-inter text-xs leading-relaxed">
              Os alunos do <strong>2º ano</strong> serão movidos para um arquivo chamado "<strong>{turma.name} — CONFIRMADOS</strong>". Os alunos do <strong>1º ano permanecerão na turma</strong> original.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmArchive(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-montserrat font-bold bg-muted text-muted-foreground border border-border">
                Cancelar
              </button>
              <button onClick={handleArchive}
                disabled={archiving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-montserrat font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                {archiving ? "Arquivando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm reset dialog */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
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
                <p className="font-montserrat font-bold text-foreground text-sm">{turma.name}</p>
                <p className="text-muted-foreground font-inter text-xs mt-0.5">
                  {turma.member_count ?? 0} membro{(turma.member_count ?? 0) !== 1 ? "s" : ""}
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
              <button onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-montserrat font-bold bg-muted text-muted-foreground border border-border">
                Cancelar
              </button>
              <button onClick={handleResetJourney}
                disabled={resetting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-montserrat font-bold text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 transition-colors">
                <RefreshCw className="w-4 h-4" />
                {resetting ? "Reiniciando..." : "Reiniciar tudo"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archived turmas */}
      {archivedTurmas.length > 0 && (
        <div className="mt-2">
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
              {archivedTurmas.map(at => {
                const pdfData = archivedPdfData[at.id];
                return (
                  <div key={at.id} className="bg-card/50 border border-border rounded-2xl p-4 opacity-80">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Archive className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-montserrat font-bold text-foreground text-sm truncate">{at.name}</p>
                          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 text-[10px] font-montserrat font-bold flex-shrink-0">
                            ✓ Confirmado
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs font-inter mt-0.5">
                          {at.year} · {at.member_count ?? 0} membro{(at.member_count ?? 0) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {pdfData ? (
                          <TurmaReportPDF participants={pdfData.participants} activities={pdfData.activities} turmaName={at.name} />
                        ) : (
                          <button
                            onClick={() => loadArchivedTurmaData(at.id)}
                            disabled={loadingPdf === at.id}
                            className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 flex-shrink-0 disabled:opacity-50"
                            title="Carregar relatório PDF"
                          >
                            {loadingPdf === at.id
                              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              : <Download className="w-4 h-4 text-primary" />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
