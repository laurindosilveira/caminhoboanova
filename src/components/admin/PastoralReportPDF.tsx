import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, CheckCircle2, XCircle, Clock } from "lucide-react";

type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
  avatar_url?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  address?: string | null;
};
type Activity = { id: string; type: string; title: string; points: number; order_num: number; subtitle: string | null };

type Props = { participant: Participant; activities: Activity[] };

function parseLocalDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPtDate(value?: string | null) {
  const parsed = parseLocalDate(value);
  return parsed ? parsed.toLocaleDateString("pt-BR") : "—";
}

function getTimeOrMax(value?: string | null) {
  const parsed = parseLocalDate(value);
  return parsed ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
}

function normalizeAttendanceStatus(status: string) {
  if (status === "falta") return "faltou";
  if (status === "justificado") return "justificou";
  return status;
}

function calcAge(birthDate: string) {
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

const APTIDAO_CFG = {
  apto: { label: "🟢 Apto para a Profissão de Fé", color: "#2ECC71", bg: "#d1fae5" },
  acompanhamento: { label: "🟡 Em Acompanhamento", color: "#F59E0B", bg: "#fef3c7" },
  nao_apto: { label: "🔴 Não Apto no Momento", color: "#EF4444", bg: "#fee2e2" },
};

export default function PastoralReportPDF({ participant: p, activities }: Props) {
  const [aptidao, setAptidao] = useState<"apto" | "acompanhamento" | "nao_apto">("acompanhamento");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [attendanceData, setAttendanceData] = useState<{ present: number; absent: number; justified: number; total: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pastoralNotes, setPastoralNotes] = useState<any[]>([]);
  const [meetingEvals, setMeetingEvals] = useState<any[]>([]);
  const [attendanceDetails, setAttendanceDetails] = useState<any[]>([]);

  const completedIds = new Set(p.completed_activity_ids);
  const formacoes = activities.filter(a => a.type === "formacao");
  const devocionais = activities.filter(a => a.type === "devocional");
  const encontros = activities.filter(a => a.type === "encontro");
  const doneForm = formacoes.filter(a => completedIds.has(a.id)).length;
  const doneDev = devocionais.filter(a => completedIds.has(a.id)).length;
  const doneEnc = encontros.filter(a => completedIds.has(a.id)).length;
  const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
  const age = calcAge(p.birth_date);

  async function loadData() {
    if (loaded) return;
    setLoadingData(true);
    const now = new Date();
    const [{ data: planData }, { data: assessData }, { data: attendRec }, { data: notesData }, { data: evalsData }] = await Promise.all([
      supabase.from("discipleship_plans").select("*").eq("user_id", p.user_id).maybeSingle(),
      supabase.from("spiritual_assessments").select("*")
        .eq("user_id", p.user_id).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()).maybeSingle(),
      supabase.from("attendance").select("status, event_id").eq("user_id", p.user_id),
      supabase.from("pastoral_notes").select("*").eq("user_id", p.user_id).order("created_at", { ascending: false }),
      supabase.from("meeting_evaluations").select("*").eq("user_id", p.user_id),
    ]);
    if (planData) {
      setPlan(planData);
      if (planData.aptidao) setAptidao(planData.aptidao as any);
      if (planData.pastor_notes) setObservations(planData.pastor_notes);
    }
    setAssessment(assessData);
    setPastoralNotes(notesData ?? []);

    // Enrich attendance with event details
    const attArr = attendRec ?? [];
    if (attArr.length > 0) {
      const present = attArr.filter(a => normalizeAttendanceStatus(a.status) === "presente").length;
      const absent = attArr.filter(a => normalizeAttendanceStatus(a.status) === "faltou").length;
      const justified = attArr.filter(a => normalizeAttendanceStatus(a.status) === "justificou").length;
      setAttendanceData({ present, absent, justified, total: attArr.length });

      const eventIds = [...new Set(attArr.map(a => a.event_id))];
      const { data: eventsData } = await supabase.from("events").select("id, title, event_date").in("id", eventIds);
      const evMap = new Map((eventsData ?? []).map(e => [e.id, e]));
      setAttendanceDetails(attArr.map(a => ({
        ...a,
        event_title: evMap.get(a.event_id)?.title ?? "Evento",
        event_date: evMap.get(a.event_id)?.event_date ?? "",
      })).sort((a: any, b: any) => getTimeOrMax(a.event_date) - getTimeOrMax(b.event_date)));
    }

    // Enrich meeting evaluations with event details
    if ((evalsData ?? []).length > 0) {
      const evalEventIds = [...new Set((evalsData ?? []).map(e => e.event_id))];
      const { data: evalEventsData } = await supabase.from("events").select("id, title, event_date").in("id", evalEventIds);
      const evMap = new Map((evalEventsData ?? []).map(e => [e.id, e]));
      setMeetingEvals((evalsData ?? []).map(e => ({
        ...e,
        event_title: evMap.get(e.event_id)?.title ?? "Encontro",
        event_date: evMap.get(e.event_id)?.event_date ?? "",
      })).sort((a: any, b: any) => getTimeOrMax(a.event_date) - getTimeOrMax(b.event_date)));
    }

    setLoaded(true);
    setLoadingData(false);
  }

  async function saveAptidao() {
    await supabase.from("discipleship_plans").upsert({
      user_id: p.user_id,
      aptidao,
      pastor_notes: observations,
      health_status: plan?.health_status ?? "atencao",
    }, { onConflict: "user_id" });
  }

  async function generatePDF() {
    setLoading(true);
    await saveAptidao();
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 16;
      let y = 20;
      const pageH = 297;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 20) {
          doc.addPage();
          y = 20;
        }
      };

      const addText = (text: string, x: number, yPos: number, size: number, bold = false, color = "#1a1a1a") => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color);
        doc.text(text, x, yPos);
      };

      const addSection = (title: string) => {
        checkPage(20);
        y += 5;
        doc.setFillColor(245, 247, 255);
        doc.roundedRect(margin, y, W - margin * 2, 8, 2, 2, "F");
        addText(title, margin + 3, y + 5.5, 11, true, "#1F3C88");
        y += 13;
      };

      const addRow = (label: string, value: string) => {
        checkPage(8);
        addText(`${label}:`, margin, y, 9, true, "#555");
        const lines = doc.splitTextToSize(value || "—", W - margin * 2 - 48);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor("#111");
        doc.text(lines, margin + 45, y);
        y += Math.max(6, lines.length * 4.5);
      };

      // Try to load avatar image
      let avatarDataUrl: string | null = null;
      if (p.avatar_url) {
        try {
          const response = await fetch(p.avatar_url);
          const blob = await response.blob();
          avatarDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Could not load avatar for PDF:", e);
        }
      }

      // Header
      doc.setFillColor(31, 60, 136);
      doc.rect(0, 0, W, 38, "F");

      // Avatar in header
      if (avatarDataUrl) {
        try {
          doc.addImage(avatarDataUrl, "JPEG", W - margin - 22, 6, 26, 26);
        } catch (e) {
          console.warn("Could not embed avatar image:", e);
        }
      }

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Relatorio Confirmatorio Completo", margin, 16);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 255);
      doc.text(`${p.full_name}`, margin, 26);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 33);
      y = 48;

      // 1. Dados pessoais
      addSection("DADOS PESSOAIS");
      addRow("Nome completo", p.full_name);
      addRow("Comunidade", p.community);
      addRow("Area", p.area);
      addRow("Idade", age ? `${age} anos` : "—");
      addRow("Telefone", p.phone);
      addRow("Data de nascimento", formatPtDate(p.birth_date));
      if (p.address) addRow("Endereco", p.address);

      // 2. Dados dos pais / responsáveis
      if (p.father_name || p.mother_name) {
        addSection("PAIS / RESPONSAVEIS");
        if (p.father_name) addRow("Pai", p.father_name);
        if (p.father_phone) addRow("Telefone do pai", p.father_phone);
        if (p.mother_name) addRow("Mae", p.mother_name);
        if (p.mother_phone) addRow("Telefone da mae", p.mother_phone);
      }

      // 2. Aptidão
      addSection("APTIDAO PARA A PROFISSAO DE FE");
      const aptCfg = APTIDAO_CFG[aptidao];
      doc.setFillColor(aptidao === "apto" ? 209 : aptidao === "acompanhamento" ? 254 : 254,
        aptidao === "apto" ? 250 : aptidao === "acompanhamento" ? 243 : 226,
        aptidao === "apto" ? 229 : aptidao === "acompanhamento" ? 199 : 226);
      doc.roundedRect(margin, y - 2, W - margin * 2, 10, 2, 2, "F");
      addText(aptCfg.label, margin + 4, y + 5, 12, true,
        aptidao === "apto" ? "#065F46" : aptidao === "acompanhamento" ? "#92400E" : "#991B1B");
      y += 14;

      // 3. Progresso da Jornada
      addSection("PROGRESSO DA JORNADA");
      addRow("Progresso geral", `${p.completed_count}/${activities.length} (${pct}%)`);
      addRow("Devocionais", `${doneDev}/${devocionais.length}`);
      addRow("Formacoes", `${doneForm}/${formacoes.length}`);
      addRow("Encontros (app)", `${doneEnc}/${encontros.length}`);

      // Activity checklist
      checkPage(10);
      y += 2;
      addText("Atividades concluidas:", margin, y, 9, true, "#555");
      y += 5;
      for (const act of activities) {
        checkPage(6);
        const done = completedIds.has(act.id);
        addText(`${done ? "[X]" : "[ ]"} ${act.title}`, margin + 4, y, 8, false, done ? "#065F46" : "#999");
        y += 4.5;
      }

      // 4. Vida Espiritual
      addSection("VIDA ESPIRITUAL");
      if (assessment) {
        const EMOJIS_TEXT = ["Fraco", "Regular", "Bom", "Muito bom", "Excelente"];
        addRow("Vida de oracao", assessment.prayer_score ? `${EMOJIS_TEXT[assessment.prayer_score-1]} (${assessment.prayer_score}/5)` : "Nao avaliado");
        addRow("Sente Deus perto", assessment.presence_score ? `${EMOJIS_TEXT[assessment.presence_score-1]} (${assessment.presence_score}/5)` : "Nao avaliado");
        addRow("Lutas espirituais", assessment.struggle_score ? `${EMOJIS_TEXT[assessment.struggle_score-1]} (${assessment.struggle_score}/5)` : "Nao avaliado");
        addRow("Duvidas de fe", assessment.doubt_score ? `${EMOJIS_TEXT[assessment.doubt_score-1]} (${assessment.doubt_score}/5)` : "Nao avaliado");
        addRow("Pediu conversa pastoral", assessment.needs_pastor ? "Sim" : "Nao");
        if (assessment.notes) addRow("Observacao pessoal", assessment.notes);
      } else {
        addText("Nenhuma autoavaliacao registrada neste mes.", margin, y, 9, false, "#999");
        y += 6;
      }

      // 5. Presença nos encontros
      addSection("PRESENCA NOS ENCONTROS");
      if (attendanceData) {
        addRow("Presente", `${attendanceData.present} encontro(s)`);
        addRow("Faltou", `${attendanceData.absent} encontro(s)`);
        addRow("Justificou", `${attendanceData.justified} encontro(s)`);
        const attendPct = attendanceData.total > 0 ? Math.round((attendanceData.present / attendanceData.total) * 100) : 0;
        addRow("Taxa de presenca", `${attendPct}%`);

        // Detail per event
        if (attendanceDetails.length > 0) {
          y += 2;
          addText("Historico detalhado:", margin, y, 9, true, "#555");
          y += 5;
          for (const att of attendanceDetails) {
            checkPage(6);
            const normalizedStatus = normalizeAttendanceStatus(att.status);
            const statusTxt = normalizedStatus === "presente" ? "Presente" : normalizedStatus === "faltou" ? "Faltou" : "Justificou";
            const dateStr = formatPtDate(att.event_date);
            addText(`${dateStr} - ${att.event_title}: ${statusTxt}`, margin + 4, y, 8, false, 
              normalizedStatus === "presente" ? "#065F46" : normalizedStatus === "faltou" ? "#991B1B" : "#92400E");
            y += 4.5;
          }
        }
      } else {
        addText("Nenhum registro de presenca.", margin, y, 9, false, "#999");
        y += 6;
      }

      // 6. Avaliações dos encontros presenciais
      if (meetingEvals.length > 0) {
        addSection("AVALIACOES DOS ENCONTROS PRESENCIAIS");
        const SCORE_LABELS = ["", "Fraco", "Regular", "Bom", "Muito bom", "Excelente"];
        for (const ev of meetingEvals) {
          checkPage(25);
          const dateStr = formatPtDate(ev.event_date);
          addText(`${ev.event_title} (${dateStr})`, margin, y, 9, true, "#333");
          y += 5;
          if (ev.participation_score) addRow("  Participacao", `${SCORE_LABELS[ev.participation_score]} (${ev.participation_score}/5)`);
          if (ev.understanding_score) addRow("  Compreensao", `${SCORE_LABELS[ev.understanding_score]} (${ev.understanding_score}/5)`);
          if (ev.engagement_score) addRow("  Engajamento", `${SCORE_LABELS[ev.engagement_score]} (${ev.engagement_score}/5)`);
          if (ev.notes) addRow("  Observacoes", ev.notes);
          y += 2;
        }
      }

      // 7. Plano de discipulado
      if (plan) {
        addSection("PLANO DE DISCIPULADO");
        const healthLabels: Record<string,string> = { saudavel: "Saudavel", atencao: "Atencao", critico: "Critico" };
        addRow("Status de saude", healthLabels[plan.health_status] ?? plan.health_status);
        addRow("Prioridade pastoral", plan.is_priority ? "Sim" : "Nao");
        if (plan.objectives) addRow("Objetivos", plan.objectives);
        if (plan.next_steps) addRow("Proximos passos", plan.next_steps);
        if (plan.challenges) addRow("Desafios", plan.challenges);
        if (plan.recommendations) addRow("Recomendacoes", plan.recommendations);
        if (plan.last_contact_at) addRow("Ultimo contato", formatPtDate(plan.last_contact_at));
      }

      // 8. Notas pastorais
      if (pastoralNotes.length > 0) {
        addSection("NOTAS PASTORAIS");
        const NOTE_LABELS: Record<string,string> = {
          acompanhamento: "Acompanhamento", conversa: "Conversa pastoral",
          encontro_individual: "Encontro individual", observacao: "Observacao",
        };
        for (const note of pastoralNotes) {
          checkPage(12);
          const dateStr = formatPtDate(note.created_at);
          const typeLabel = NOTE_LABELS[note.note_type] ?? note.note_type;
          addText(`${dateStr} - ${typeLabel}`, margin, y, 8, true, "#555");
          y += 4;
          const lines = doc.splitTextToSize(note.content, W - margin * 2 - 8);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor("#333");
          for (const line of lines) {
            checkPage(5);
            doc.text(line, margin + 4, y);
            y += 3.5;
          }
          y += 3;
        }
      }

      // 9. Observações pastorais finais
      if (observations) {
        addSection("OBSERVACOES FINAIS DO DISCIPULADOR");
        const lines = doc.splitTextToSize(observations, W - margin * 2 - 6);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.setTextColor("#444");
        for (const line of lines) {
          checkPage(5);
          doc.text(line, margin + 3, y);
          y += 4.5;
        }
      }

      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(31, 60, 136);
        doc.rect(0, 285, W, 12, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 210, 255);
        doc.text("Caminho Boa Nova — Relatorio Confirmatorio Completo", margin, 292);
        doc.text(`Pag. ${i}/${pageCount}`, W - margin - 20, 292);
      }

      doc.save(`Relatorio_${p.full_name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    }
    setLoading(false);
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <p className="font-montserrat font-bold text-foreground text-sm">📄 Relatório Confirmatório Completo</p>
      </div>
      <div className="p-4 space-y-4">
        {!loaded ? (
          <button onClick={loadData} disabled={loadingData}
            className="w-full py-2.5 rounded-xl bg-muted text-foreground font-inter text-sm font-medium hover:bg-muted/70 transition-colors">
            {loadingData ? "Carregando dados..." : "Carregar dados do relatório"}
          </button>
        ) : (
          <>
            {/* Resumo do que será incluído */}
            <div className="bg-muted/30 rounded-xl p-3 space-y-1">
              <p className="font-inter text-xs font-medium text-foreground">O relatório incluirá:</p>
              <div className="grid grid-cols-2 gap-1 text-xs font-inter text-muted-foreground">
                <span>✅ Dados pessoais</span>
                <span>✅ Foto do discípulo</span>
                <span>✅ Dados dos pais</span>
                <span>✅ Progresso ({pct}%)</span>
                <span>✅ Presença ({attendanceData ? `${attendanceData.present}/${attendanceData.total}` : "—"})</span>
                <span>✅ Autoavaliação</span>
                <span>✅ {meetingEvals.length} avaliação(ões) de encontro</span>
                <span>✅ {pastoralNotes.length} nota(s) pastoral(is)</span>
                <span>✅ Plano de discipulado</span>
                <span>✅ Checklist de atividades</span>
              </div>
            </div>

            {/* Aptidão selector */}
            <div>
              <p className="font-inter text-xs font-medium text-foreground mb-2">🏁 Aptidão para a Profissão de Fé</p>
              <div className="grid grid-cols-1 gap-2">
                {(["apto", "acompanhamento", "nao_apto"] as const).map(key => {
                  const cfg = APTIDAO_CFG[key];
                  const isSelected = aptidao === key;
                  return (
                    <button key={key} onClick={() => setAptidao(key)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
                      }`}>
                      {key === "apto" ? <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" /> :
                       key === "acompanhamento" ? <Clock className="w-5 h-5 text-accent-foreground flex-shrink-0" /> :
                       <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                      <span className={`font-inter text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Observações pastorais */}
            <div>
              <p className="font-inter text-xs font-medium text-foreground mb-1.5">📝 Observações finais (incluídas no relatório)</p>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Registre a maturidade espiritual, dúvidas, desafios e recomendações..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Download button */}
            <button
              onClick={generatePDF}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70 transition-all"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Download className="w-4 h-4" />
              {loading ? "Gerando PDF..." : "📄 Baixar Relatório Completo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
