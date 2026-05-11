import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";

type Participant = {
  user_id: string; full_name: string; community: string; area: string;
  birth_date: string; phone: string; completed_count: number; completed_activity_ids: string[];
};
type Activity = { id: string; type: string; title: string; points: number; order_num: number; subtitle: string | null };

type Props = {
  participants: Participant[];
  activities: Activity[];
  turmaName: string;
};

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

const APTIDAO_CFG: Record<string, { label: string }> = {
  apto: { label: "Apto para a Profissao de Fe" },
  acompanhamento: { label: "Em Acompanhamento" },
  nao_apto: { label: "Nao Apto no Momento" },
};

export default function TurmaReportPDF({ participants, activities, turmaName }: Props) {
  const [loading, setLoading] = useState(false);

  async function generateFullReport() {
    if (participants.length === 0) return;
    setLoading(true);

    try {
      // Fetch all data in parallel for all participants
      const userIds = participants.map(p => p.user_id);
      const now = new Date();

      const [
        { data: plansData },
        { data: assessData },
        { data: attendRec },
        { data: notesData },
        { data: evalsData },
        { data: worshipData },
        { data: devProgressData },
        { data: lessonRespData },
      ] = await Promise.all([
        supabase.from("discipleship_plans").select("*").in("user_id", userIds),
        supabase.from("spiritual_assessments").select("*").in("user_id", userIds).eq("month", now.getMonth() + 1).eq("year", now.getFullYear()),
        supabase.from("attendance").select("user_id, status, event_id").in("user_id", userIds),
        supabase.from("pastoral_notes").select("*").in("user_id", userIds).order("created_at", { ascending: false }),
        supabase.from("meeting_evaluations").select("*").in("user_id", userIds),
        supabase.from("worship_attendance").select("user_id, status, worship_date").in("user_id", userIds),
        supabase.from("devotional_progress").select("user_id, devotional_id").in("user_id", userIds),
        supabase.from("lesson_responses").select("user_id, lesson_id").in("user_id", userIds),
      ]);

      // Fetch event details for attendance
      const allEventIds = [...new Set((attendRec ?? []).map(a => a.event_id))];
      const { data: eventsData } = allEventIds.length > 0
        ? await supabase.from("events").select("id, title, event_date").in("id", allEventIds)
        : { data: [] };
      const evMap = new Map((eventsData ?? []).map(e => [e.id, e]));

      // Fetch event details for meeting evaluations
      const evalEventIds = [...new Set((evalsData ?? []).map(e => e.event_id))];
      const { data: evalEventsData } = evalEventIds.length > 0
        ? await supabase.from("events").select("id, title, event_date").in("id", evalEventIds)
        : { data: [] };
      const evalEvMap = new Map((evalEventsData ?? []).map(e => [e.id, e]));

      // Index data by user_id
      const plansMap = new Map((plansData ?? []).map(p => [p.user_id, p]));
      const assessMap = new Map((assessData ?? []).map(a => [a.user_id, a]));
      const attendMap = new Map<string, typeof attendRec>();
      for (const a of (attendRec ?? [])) {
        if (!attendMap.has(a.user_id)) attendMap.set(a.user_id, []);
        attendMap.get(a.user_id)!.push(a);
      }
      const notesMap = new Map<string, typeof notesData>();
      for (const n of (notesData ?? [])) {
        if (!notesMap.has(n.user_id)) notesMap.set(n.user_id, []);
        notesMap.get(n.user_id)!.push(n);
      }
      const evalsMap = new Map<string, any[]>();
      for (const e of (evalsData ?? [])) {
        if (!evalsMap.has(e.user_id)) evalsMap.set(e.user_id, []);
        evalsMap.get(e.user_id)!.push(e);
      }
      const worshipMap = new Map<string, any[]>();
      for (const w of (worshipData ?? [])) {
        if (!worshipMap.has(w.user_id)) worshipMap.set(w.user_id, []);
        worshipMap.get(w.user_id)!.push(w);
      }
      const devCountMap = new Map<string, number>();
      for (const d of (devProgressData ?? [])) {
        devCountMap.set(d.user_id, (devCountMap.get(d.user_id) ?? 0) + 1);
      }
      const lessonCountMap = new Map<string, number>();
      for (const l of (lessonRespData ?? [])) {
        const key = `${l.user_id}_${l.lesson_id}`;
        if (!lessonCountMap.has(l.user_id)) lessonCountMap.set(l.user_id, 0);
        // Count unique lessons
      }
      // Count unique lessons per user
      const lessonUniqueMap = new Map<string, Set<string>>();
      for (const l of (lessonRespData ?? [])) {
        if (!lessonUniqueMap.has(l.user_id)) lessonUniqueMap.set(l.user_id, new Set());
        lessonUniqueMap.get(l.user_id)!.add(l.lesson_id);
      }

      // Generate PDF
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 16;
      const pageH = 297;
      let y = 20;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 20) { doc.addPage(); y = 20; }
      };

      const addText = (text: string, x: number, yPos: number, size: number, bold = false, color = "#1a1a1a") => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(color);
        doc.text(text, x, yPos);
      };

      const addSection = (title: string) => {
        checkPage(20);
        y += 4;
        doc.setFillColor(245, 247, 255);
        doc.roundedRect(margin, y, W - margin * 2, 8, 2, 2, "F");
        addText(title, margin + 3, y + 5.5, 10, true, "#1F3C88");
        y += 12;
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

      // ===== Cover page =====
      doc.setFillColor(31, 60, 136);
      doc.rect(0, 0, W, 60, "F");
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Relatorio Completo da Turma", margin, 25);
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(200, 210, 255);
      doc.text(turmaName, margin, 36);
      doc.text(`${participants.length} confirmando(s)`, margin, 45);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 54);

      y = 70;

      // ===== Summary table =====
      addSection("RESUMO GERAL");
      
      const sortedParticipants = [...participants].sort((a, b) => a.full_name.localeCompare(b.full_name));

      // Table header
      checkPage(10);
      doc.setFillColor(31, 60, 136);
      doc.rect(margin, y, W - margin * 2, 7, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Nome", margin + 2, y + 5);
      doc.text("Comunidade", margin + 58, y + 5);
      doc.text("Idade", margin + 100, y + 5);
      doc.text("Progresso", margin + 118, y + 5);
      doc.text("Presenca", margin + 142, y + 5);
      doc.text("Aptidao", margin + 162, y + 5);
      y += 9;

      for (let i = 0; i < sortedParticipants.length; i++) {
        const p = sortedParticipants[i];
        checkPage(7);
        if (i % 2 === 0) {
          doc.setFillColor(248, 249, 252);
          doc.rect(margin, y - 4, W - margin * 2, 6, "F");
        }
        const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
        const age = calcAge(p.birth_date);
        const att = attendMap.get(p.user_id) ?? [];
        const present = att.filter((a: any) => normalizeAttendanceStatus(a.status) === "presente").length;
        const attPct = att.length > 0 ? Math.round((present / att.length) * 100) : 0;
        const plan = plansMap.get(p.user_id);
        const aptLabel = plan?.aptidao ? (APTIDAO_CFG[plan.aptidao]?.label?.split(" ")[0] ?? "—") : "—";

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor("#111");
        doc.text(p.full_name.substring(0, 28), margin + 2, y);
        doc.text(p.community.substring(0, 18), margin + 58, y);
        doc.text(age ? `${age}` : "—", margin + 100, y);
        doc.setTextColor(pct >= 70 ? "#065F46" : pct > 0 ? "#92400E" : "#991B1B");
        doc.text(`${pct}%`, margin + 118, y);
        doc.setTextColor(attPct >= 70 ? "#065F46" : attPct > 0 ? "#92400E" : "#991B1B");
        doc.text(`${attPct}%`, margin + 142, y);
        doc.setTextColor("#111");
        doc.text(aptLabel, margin + 162, y);
        y += 6;
      }

      // ===== Individual reports =====
      for (const p of sortedParticipants) {
        doc.addPage();
        y = 20;

        const completedIds = new Set(p.completed_activity_ids);
        const formacoes = activities.filter(a => a.type === "formacao");
        const devocionais = activities.filter(a => a.type === "devocional");
        const encontros = activities.filter(a => a.type === "encontro");
        const doneForm = formacoes.filter(a => completedIds.has(a.id)).length;
        const doneDev = devocionais.filter(a => completedIds.has(a.id)).length;
        const doneEnc = encontros.filter(a => completedIds.has(a.id)).length;
        const pct = activities.length > 0 ? Math.round((p.completed_count / activities.length) * 100) : 0;
        const age = calcAge(p.birth_date);

        // Participant header
        doc.setFillColor(31, 60, 136);
        doc.rect(0, 0, W, 30, "F");
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(p.full_name, margin, 14);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 210, 255);
        doc.text(`${p.community} · ${p.area}`, margin, 23);
        y = 38;

        // Dados pessoais
        addSection("DADOS PESSOAIS");
        addRow("Nome completo", p.full_name);
        addRow("Comunidade", p.community);
        addRow("Area", p.area);
        addRow("Idade", age ? `${age} anos` : "—");
        addRow("Telefone", p.phone);
        addRow("Data de nascimento", formatPtDate(p.birth_date));

        // Aptidão
        const plan = plansMap.get(p.user_id);
        addSection("APTIDAO PARA A PROFISSAO DE FE");
        const aptKey = (plan?.aptidao ?? "acompanhamento") as keyof typeof APTIDAO_CFG;
        addText(APTIDAO_CFG[aptKey]?.label ?? "Em Acompanhamento", margin, y, 11, true,
          aptKey === "apto" ? "#065F46" : aptKey === "nao_apto" ? "#991B1B" : "#92400E");
        y += 8;

        // Progresso
        addSection("PROGRESSO DA JORNADA");
        addRow("Progresso geral", `${p.completed_count}/${activities.length} (${pct}%)`);
        addRow("Devocionais (app)", `${doneDev}/${devocionais.length}`);
        addRow("Formacoes", `${doneForm}/${formacoes.length}`);
        addRow("Encontros (app)", `${doneEnc}/${encontros.length}`);
        addRow("Devocionais concluidos", `${devCountMap.get(p.user_id) ?? 0}`);
        addRow("Licoes respondidas", `${lessonUniqueMap.get(p.user_id)?.size ?? 0}`);

        // Activity checklist
        y += 2;
        addText("Atividades:", margin, y, 8, true, "#555");
        y += 4;
        for (const act of activities) {
          checkPage(5);
          const done = completedIds.has(act.id);
          addText(`${done ? "[X]" : "[ ]"} ${act.title}`, margin + 4, y, 7, false, done ? "#065F46" : "#999");
          y += 4;
        }

        // Vida Espiritual
        const assessment = assessMap.get(p.user_id);
        addSection("VIDA ESPIRITUAL");
        if (assessment) {
          const LABELS = ["Fraco", "Regular", "Bom", "Muito bom", "Excelente"];
          addRow("Vida de oracao", assessment.prayer_score ? `${LABELS[assessment.prayer_score-1]} (${assessment.prayer_score}/5)` : "—");
          addRow("Presenca de Deus", assessment.presence_score ? `${LABELS[assessment.presence_score-1]} (${assessment.presence_score}/5)` : "—");
          addRow("Lutas espirituais", assessment.struggle_score ? `${LABELS[assessment.struggle_score-1]} (${assessment.struggle_score}/5)` : "—");
          addRow("Duvidas de fe", assessment.doubt_score ? `${LABELS[assessment.doubt_score-1]} (${assessment.doubt_score}/5)` : "—");
          addRow("Pediu conversa pastoral", assessment.needs_pastor ? "Sim" : "Nao");
          if (assessment.notes) addRow("Observacao", assessment.notes);
        } else {
          addText("Nenhuma autoavaliacao registrada neste mes.", margin, y, 8, false, "#999");
          y += 5;
        }

        // Presença
        addSection("PRESENCA NOS ENCONTROS");
        const userAtt = attendMap.get(p.user_id) ?? [];
        if (userAtt.length > 0) {
          const present = userAtt.filter((a: any) => normalizeAttendanceStatus(a.status) === "presente").length;
          const absent = userAtt.filter((a: any) => normalizeAttendanceStatus(a.status) === "faltou").length;
          const justified = userAtt.filter((a: any) => normalizeAttendanceStatus(a.status) === "justificou").length;
          const attPct = Math.round((present / userAtt.length) * 100);
          addRow("Presente", `${present} encontro(s)`);
          addRow("Faltou", `${absent} encontro(s)`);
          addRow("Justificou", `${justified} encontro(s)`);
          addRow("Taxa de presenca", `${attPct}%`);

          y += 2;
          addText("Historico:", margin, y, 8, true, "#555");
          y += 4;
          const sorted = [...userAtt].sort((a: any, b: any) => {
            const da = evMap.get(a.event_id)?.event_date ?? "";
            const db = evMap.get(b.event_id)?.event_date ?? "";
            return getTimeOrMax(da) - getTimeOrMax(db);
          });
          for (const att of sorted) {
            checkPage(5);
            const ev = evMap.get(att.event_id);
            const normalizedStatus = normalizeAttendanceStatus(att.status);
            const statusTxt = normalizedStatus === "presente" ? "Presente" : normalizedStatus === "faltou" ? "Faltou" : "Justificou";
            const dateStr = formatPtDate(ev?.event_date);
            addText(`${dateStr} - ${ev?.title ?? "Evento"}: ${statusTxt}`, margin + 4, y, 7, false,
              normalizedStatus === "presente" ? "#065F46" : normalizedStatus === "faltou" ? "#991B1B" : "#92400E");
            y += 4;
          }
        } else {
          addText("Nenhum registro de presenca.", margin, y, 8, false, "#999");
          y += 5;
        }

        // Cultos
        const userWorship = worshipMap.get(p.user_id) ?? [];
        if (userWorship.length > 0) {
          addSection("PRESENCA EM CULTOS");
          const approved = userWorship.filter((w: any) => w.status === "aprovado").length;
          addRow("Cultos confirmados", `${approved} de ${userWorship.length} registro(s)`);
        }

        // Avaliações de encontros
        const userEvals = evalsMap.get(p.user_id) ?? [];
        if (userEvals.length > 0) {
          addSection("AVALIACOES DOS ENCONTROS");
          const SCORE_LABELS = ["", "Fraco", "Regular", "Bom", "Muito bom", "Excelente"];
          for (const ev of userEvals) {
            checkPage(20);
            const evInfo = evalEvMap.get(ev.event_id);
            const dateStr = formatPtDate(evInfo?.event_date);
            addText(`${evInfo?.title ?? "Encontro"} (${dateStr})`, margin, y, 8, true, "#333");
            y += 4;
            if (ev.participation_score) addRow("  Participacao", `${SCORE_LABELS[ev.participation_score]} (${ev.participation_score}/5)`);
            if (ev.understanding_score) addRow("  Compreensao", `${SCORE_LABELS[ev.understanding_score]} (${ev.understanding_score}/5)`);
            if (ev.engagement_score) addRow("  Engajamento", `${SCORE_LABELS[ev.engagement_score]} (${ev.engagement_score}/5)`);
            if (ev.notes) addRow("  Obs", ev.notes);
            y += 2;
          }
        }

        // Plano de discipulado
        if (plan) {
          addSection("PLANO DE DISCIPULADO");
          const healthLabels: Record<string, string> = { saudavel: "Saudavel", atencao: "Atencao", critico: "Critico" };
          addRow("Status de saude", healthLabels[plan.health_status] ?? plan.health_status);
          addRow("Prioridade pastoral", plan.is_priority ? "Sim" : "Nao");
          if (plan.objectives) addRow("Objetivos", plan.objectives);
          if (plan.next_steps) addRow("Proximos passos", plan.next_steps);
          if (plan.challenges) addRow("Desafios", plan.challenges);
          if (plan.recommendations) addRow("Recomendacoes", plan.recommendations);
          if (plan.last_contact_at) addRow("Ultimo contato", formatPtDate(plan.last_contact_at));
          if (plan.pastor_notes) addRow("Observacoes", plan.pastor_notes);
        }

        // Notas pastorais
        const userNotes = notesMap.get(p.user_id) ?? [];
        if (userNotes.length > 0) {
          addSection("NOTAS PASTORAIS");
          const NOTE_LABELS: Record<string, string> = {
            acompanhamento: "Acompanhamento", conversa: "Conversa pastoral",
            encontro_individual: "Encontro individual", observacao: "Observacao",
          };
          for (const note of userNotes) {
            checkPage(10);
            const dateStr = formatPtDate(note.created_at);
            addText(`${dateStr} - ${NOTE_LABELS[note.note_type] ?? note.note_type}`, margin, y, 7, true, "#555");
            y += 4;
            const lines = doc.splitTextToSize(note.content, W - margin * 2 - 8);
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor("#333");
            for (const line of lines) {
              checkPage(4);
              doc.text(line, margin + 4, y);
              y += 3.5;
            }
            y += 2;
          }
        }
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(31, 60, 136);
        doc.rect(0, 285, W, 12, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 210, 255);
        doc.text("Caminho Boa Nova — Relatorio Completo da Turma", margin, 292);
        doc.text(`Pag. ${i}/${pageCount}`, W - margin - 20, 292);
      }

      const safeName = turmaName.replace(/[^a-zA-Z0-9À-ú ]/g, "").replace(/\s+/g, "_");
      doc.save(`Relatorio_Turma_${safeName}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={generateFullReport}
      disabled={loading || participants.length === 0}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-primary-foreground font-inter text-xs font-medium transition-colors disabled:opacity-50"
      title="Baixar relatório completo da turma em PDF"
    >
      <Download className="w-4 h-4" />
      {loading ? "Gerando..." : "Relatório PDF"}
    </button>
  );
}
