import { useState, useEffect, useCallback, useRef } from "react";
import BibleModal from "./BibleModal";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, BookOpen, MessageCircle, Target,
  Pen, Heart, CheckCircle2, Save, Play, Link, Volume2, Download, FileText, Share2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  topics: string[] | null;
  course_id: string;
};

type Response = { [key: string]: string };

type LessonContent = {
  greeting: string;
  icebreaker: string;
  summary: string;
  bible_texts: string[];
  questions: string[];
  practice: string;
  prayer_prompt: string;
  video_link: string;
  audio_link: string;
  pdf_link: string;
};

function getDefaultContent(lessonNum: number): LessonContent {
  return {
    greeting: `Bem-vindo à lição ${lessonNum}! Que este tempo seja de crescimento e encontro com Deus.`,
    icebreaker: "Pergunta inicial: O que você mais aprendeu na lição anterior?",
    summary: "Conteúdo desta lição em preparação pelo seu pastor. Fique atento às próximas atualizações!",
    bible_texts: ["Salmos 119:105", "2 Timóteo 3:16-17"],
    questions: [
      "Como você está aplicando o que aprendeu na última lição?",
      "O que mais te desafia na sua caminhada com Deus?",
      "Que oração você tem feito ultimamente?",
    ],
    practice: "Esta semana: Aplique algo aprendido nesta lição em uma situação real do seu dia a dia.",
    prayer_prompt: "Escreva uma oração sobre o que você aprendeu hoje e como deseja crescer.",
    video_link: "",
    audio_link: "",
    pdf_link: "",
  };
}

type Props = {
  lesson: Lesson;
  onBack: () => void;
  isAdmin?: boolean;
  targetUserId?: string;
  isLateAccess?: boolean;
  overrideId?: string | null;
  awardedPoints?: number | null;
};

export default function JourneyLessonView({ lesson, onBack, isAdmin = false, targetUserId, isLateAccess = false, overrideId = null, awardedPoints = null }: Props) {
  const [content, setContent] = useState<LessonContent>(getDefaultContent(lesson.order_num));
  const [responses, setResponses] = useState<Response>({});
  const [bibleRef, setBibleRef] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [audioListened, setAudioListened] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [showCompletionAnim, setShowCompletionAnim] = useState(false);
  const hasLoadedResponses = useRef(false);

  // Load lesson content from DB — checks turma override first, then global content
  useEffect(() => {
    async function loadContent() {
      const defaults = getDefaultContent(lesson.order_num);

      // 1. Load global content
      const { data: globalData } = await supabase
        .from("lesson_content")
        .select("*")
        .eq("lesson_id", lesson.id)
        .maybeSingle();

      const global: LessonContent = globalData ? {
        greeting: globalData.greeting || defaults.greeting,
        icebreaker: globalData.icebreaker || defaults.icebreaker,
        summary: globalData.summary || defaults.summary,
        bible_texts: globalData.bible_texts?.length ? globalData.bible_texts : defaults.bible_texts,
        questions: globalData.questions?.length ? globalData.questions : defaults.questions,
        practice: globalData.practice || defaults.practice,
        prayer_prompt: globalData.prayer_prompt || defaults.prayer_prompt,
        video_link: globalData.video_link ?? "",
        audio_link: globalData.audio_link ?? "",
        pdf_link: (globalData as any).pdf_link ?? "",
      } : defaults;

      // 2. Check for turma-specific override
      const { data: { user } } = await supabase.auth.getUser();
      const uid = targetUserId ?? user?.id;
      if (uid) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("turma_id")
          .eq("user_id", uid)
          .maybeSingle();

        if (profileData?.turma_id) {
          const { data: override } = await supabase
            .from("turma_lesson_content")
            .select("*")
            .eq("turma_id", profileData.turma_id)
            .eq("lesson_id", lesson.id)
            .maybeSingle();

          if (override) {
            // Merge: override fields take priority over global when set
            setContent({
              greeting: override.greeting || global.greeting,
              icebreaker: override.icebreaker || global.icebreaker,
              summary: override.summary || global.summary,
              bible_texts: override.bible_texts?.length ? override.bible_texts : global.bible_texts,
              questions: override.questions?.length ? override.questions : global.questions,
              practice: override.practice || global.practice,
              prayer_prompt: override.prayer_prompt || global.prayer_prompt,
              video_link: override.video_link ?? global.video_link,
              audio_link: override.audio_link ?? global.audio_link,
              pdf_link: (override as any).pdf_link ?? global.pdf_link,
            });
            setContentLoaded(true);
            return;
          }
        }
      }

      setContent(global);
      setContentLoaded(true);
    }
    loadContent();
  }, [lesson.id, lesson.order_num, targetUserId]);

  // Load user responses
  useEffect(() => {
    async function loadResponses() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = targetUserId ?? user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("lesson_responses")
        .select("question_key, response")
        .eq("lesson_id", lesson.id)
        .eq("user_id", uid);
      if (data) {
        const map: Response = {};
        data.forEach(r => { map[r.question_key] = r.response; });
        setResponses(map);
      }
      hasLoadedResponses.current = true;
    }
    loadResponses();
  }, [lesson.id, targetUserId]);

  const saveResponse = useCallback(async (key: string, value: string) => {
    if (isAdmin) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let { error } = await supabase.from("lesson_responses").upsert({
      user_id: user.id,
      lesson_id: lesson.id,
      question_key: key,
      response: value,
    }, { onConflict: "user_id,lesson_id,question_key" });
    if (error && /awarded_points|override_release_id/i.test(error.message)) {
      const fallback = await supabase.from("lesson_responses").upsert({
        user_id: user.id,
        lesson_id: lesson.id,
        question_key: key,
        response: value,
      }, { onConflict: "user_id,lesson_id,question_key" });
      error = fallback.error;
    }
    if (error) {
      toast.error("Falha ao salvar a resposta da lição.", {
        description: error.message,
      });
      return;
    }
    setLastSaved(new Date());
  }, [lesson.id, isAdmin]);

  useEffect(() => {
    if (isAdmin || !contentLoaded || !hasLoadedResponses.current) return;

    const entries = Object.entries(responses);
    if (entries.length === 0) return;

    const timeoutId = window.setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const upserts = entries.map(([key, response]) => ({
        user_id: user.id,
        lesson_id: lesson.id,
        question_key: key,
        response,
      }));

      let { error } = await supabase
        .from("lesson_responses")
        .upsert(upserts, { onConflict: "user_id,lesson_id,question_key" });
      if (error && /awarded_points|override_release_id/i.test(error.message)) {
        const fallback = await supabase
          .from("lesson_responses")
          .upsert(entries.map(([key, response]) => ({
            user_id: user.id,
            lesson_id: lesson.id,
            question_key: key,
            response,
          })), { onConflict: "user_id,lesson_id,question_key" });
        error = fallback.error;
      }

      if (!error) {
        setLastSaved(new Date());
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [responses, lesson.id, isAdmin, contentLoaded]);

  // Validation: check all required fields
  const requiredKeys = ["icebreaker", ...content.questions.map((_, i) => `q${i}`), "practice", "prayer"];
  const allResponsesFilled = requiredKeys.every(k => (responses[k] ?? "").trim().length > 0);
  const videoRequired = !!content.video_link;
  const audioRequired = !!content.audio_link;
  const videoOk = !videoRequired || videoWatched;
  const audioOk = !audioRequired || audioListened;
  const canSave = allResponsesFilled && videoOk && audioOk;

  const missingItems: string[] = [];
  if (!allResponsesFilled) missingItems.push("responder todas as perguntas");
  if (!videoOk) missingItems.push("assistir o vídeo");
  if (!audioOk) missingItems.push("ouvir o áudio");

  async function handleSaveAll() {
    setSaveAttempted(true);
    if (!isAdmin && !canSave) {
      toast.error("Complete todas as tarefas antes de salvar!", {
        description: `Falta: ${missingItems.join(", ")}.`,
        duration: 5000,
      });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const upserts = Object.entries(responses).map(([key, response]) => ({
      user_id: user.id,
      lesson_id: lesson.id,
      question_key: key,
      response,
      awarded_points: isLateAccess ? 0 : awardedPoints,
      override_release_id: overrideId,
    }));
    if (upserts.length > 0) {
      let { error } = await supabase
        .from("lesson_responses")
        .upsert(upserts, { onConflict: "user_id,lesson_id,question_key" });
      if (error && /awarded_points|override_release_id/i.test(error.message)) {
        const fallback = await supabase
          .from("lesson_responses")
          .upsert(Object.entries(responses).map(([key, response]) => ({
            user_id: user.id,
            lesson_id: lesson.id,
            question_key: key,
            response,
          })), { onConflict: "user_id,lesson_id,question_key" });
        error = fallback.error;
      }
      if (error) {
        setSaving(false);
        toast.error("Não foi possível salvar as respostas da lição.", {
          description: error.message,
        });
        return;
      }
    }
    setSaving(false);
    setLastSaved(new Date());

    if (!isLateAccess) {
      // Celebration animation
      setShowCompletionAnim(true);
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.7 } });
      setTimeout(() => confetti({ particleCount: 40, spread: 60, origin: { x: 0.3, y: 0.6 } }), 300);
      setTimeout(() => setShowCompletionAnim(false), 3500);
    }

    toast.success(isLateAccess ? "Respostas salvas! (sem pontuação — prazo encerrado)" : "Respostas salvas com sucesso! +20 pontos de fé ⭐");
  }

  function updateResponse(key: string, value: string) {
    if (isAdmin) return;
    setResponses(prev => ({ ...prev, [key]: value }));
  }

  async function handleDownloadPDF() {
    // Fetch devotionals for this lesson
    const { data: devs } = await supabase
      .from("devotional_content")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("day_number");

    // Fetch completed devotional IDs
    const { data: { user } } = await supabase.auth.getUser();
    let completedDevIds = new Set<string>();
    if (user) {
      const { data: prog } = await supabase
        .from("devotional_progress")
        .select("devotional_id")
        .eq("user_id", user.id);
      completedDevIds = new Set((prog ?? []).map((p: any) => p.devotional_id));
    }

    const completedDevs = (devs ?? []).filter(d => completedDevIds.has(d.id));

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = 20;

    function checkPage(needed: number) {
      if (y + needed > pdf.internal.pageSize.getHeight() - 15) {
        pdf.addPage();
        y = 20;
      }
    }

    function addTitle(text: string) {
      checkPage(14);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(text, pageW / 2, y, { align: "center" });
      y += 10;
    }

    function addSectionTitle(text: string) {
      checkPage(12);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(text, margin, y);
      y += 7;
    }

    function addBody(text: string, indent = 0) {
      if (!text) return;
      checkPage(8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(text, maxW - indent);
      for (const line of lines) {
        checkPage(6);
        pdf.text(line, margin + indent, y);
        y += 5;
      }
      y += 2;
    }

    function addLabel(label: string, value: string) {
      checkPage(12);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(label, margin, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(value, maxW);
      for (const line of lines) {
        checkPage(6);
        pdf.text(line, margin, y);
        y += 5;
      }
      y += 3;
    }

    // === HEADER ===
    addTitle(`Licao ${lesson.order_num} - ${lesson.title}`);
    if (lesson.objective) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      const objLines = pdf.splitTextToSize(`Objetivo: ${lesson.objective}`, maxW);
      for (const line of objLines) { checkPage(6); pdf.text(line, margin, y); y += 5; }
      y += 3;
    }

    // Separator
    pdf.setDrawColor(200); pdf.line(margin, y, pageW - margin, y); y += 6;

    // === STUDY RESPONSES ===
    addSectionTitle("RESPOSTAS DO ESTUDO");
    y += 2;

    if (responses["icebreaker"]) {
      addLabel("Quebra-gelo:", responses["icebreaker"]);
    }

    content.questions.forEach((q, i) => {
      const answer = responses[`q${i}`];
      if (answer) {
        addLabel(`${i + 1}. ${q}`, answer);
      }
    });

    if (responses["practice"]) {
      addLabel("Pratica da Semana:", responses["practice"]);
    }

    if (responses["prayer"]) {
      addLabel("Oracao Final:", responses["prayer"]);
    }

    // === DEVOTIONALS SECTION ===
    if (completedDevs.length > 0) {
      y += 4;
      pdf.setDrawColor(200); pdf.line(margin, y, pageW - margin, y); y += 6;
      addSectionTitle(`DEVOCIONAIS CONCLUIDOS (${completedDevs.length}/${(devs ?? []).length})`);
      y += 2;

      completedDevs.forEach((dev: any) => {
        checkPage(20);
        addSectionTitle(`Dia ${dev.day_number} - ${dev.title || ""}`);

        if (dev.bible_reference) {
          addLabel("Texto Biblico:", `${dev.bible_reference}`);
        }
        if (dev.bible_text) {
          addBody(`"${dev.bible_text}"`, 3);
        }
        if (dev.reflection) {
          addLabel("Reflexao:", dev.reflection);
        }
        if (dev.questions && dev.questions.length > 0) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          checkPage(6);
          pdf.text("Perguntas:", margin, y);
          y += 5;
          dev.questions.filter((q: string) => q.trim()).forEach((q: string, i: number) => {
            addBody(`${i + 1}. ${q}`, 3);
          });
        }
        if (dev.practice) {
          addLabel("Pratica:", dev.practice);
        }
        y += 3;
      });
    }

    // Footer
    checkPage(10);
    y += 4;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} - Caminho Boa Nova`, pageW / 2, y, { align: "center" });

    pdf.save(`Licao_${lesson.order_num}_${lesson.title.replace(/\s+/g, "_")}_completo.pdf`);
  }

  async function handleShareWhatsApp() {
    // Build a text summary for sharing
    const lines: string[] = [];
    lines.push(`📖 *Lição ${lesson.order_num} — ${lesson.title}*`);
    if (lesson.objective) lines.push(`_${lesson.objective}_`);
    lines.push("");
    lines.push("*📝 Minhas Respostas:*");

    if (responses["icebreaker"]) {
      lines.push(`\n🔗 *Quebra-gelo:*\n${responses["icebreaker"]}`);
    }
    content.questions.forEach((q, i) => {
      const answer = responses[`q${i}`];
      if (answer) lines.push(`\n${i + 1}. *${q}*\n${answer}`);
    });
    if (responses["practice"]) {
      lines.push(`\n🧭 *Prática da Semana:*\n${responses["practice"]}`);
    }
    if (responses["prayer"]) {
      lines.push(`\n🙏 *Oração:*\n${responses["prayer"]}`);
    }
    lines.push(`\n— _Caminho Boa Nova · ${new Date().toLocaleDateString("pt-BR")}_`);

    const text = lines.join("\n");

    // Try Web Share API first (works on mobile with file sharing)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Lição ${lesson.order_num} — ${lesson.title}`,
          text,
        });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return; // User cancelled
      }
    }

    // Fallback: open WhatsApp with text
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast.success("Abrindo WhatsApp para compartilhar!");
  }

  async function handleDownloadWord() {
    const sections: Paragraph[] = [];

    // Title
    sections.push(new Paragraph({
      children: [new TextRun({ text: `Lição ${lesson.order_num} — ${lesson.title}`, bold: true, size: 32, font: "Calibri" })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }));

    if (lesson.objective) {
      sections.push(new Paragraph({
        children: [new TextRun({ text: `Objetivo: ${lesson.objective}`, italics: true, size: 22, font: "Calibri" })],
        spacing: { after: 200 },
      }));
    }

    // Icebreaker
    if (responses["icebreaker"]) {
      sections.push(new Paragraph({ children: [new TextRun({ text: "🔗 Quebra-gelo", bold: true, size: 26, font: "Calibri" })], spacing: { before: 300, after: 100 } }));
      sections.push(new Paragraph({ children: [new TextRun({ text: content.icebreaker, size: 22, font: "Calibri" })], spacing: { after: 50 } }));
      sections.push(new Paragraph({ children: [new TextRun({ text: `Resposta: ${responses["icebreaker"]}`, size: 22, font: "Calibri", color: "2563EB" })], spacing: { after: 200 } }));
    }

    // Questions
    if (content.questions.length > 0) {
      sections.push(new Paragraph({ children: [new TextRun({ text: "💬 Perguntas para Diálogo", bold: true, size: 26, font: "Calibri" })], spacing: { before: 300, after: 100 } }));
      content.questions.forEach((q, i) => {
        sections.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${q}`, bold: true, size: 22, font: "Calibri" })], spacing: { after: 50 } }));
        const answer = responses[`q${i}`];
        sections.push(new Paragraph({ children: [new TextRun({ text: answer ? `Resposta: ${answer}` : "(Sem resposta)", size: 22, font: "Calibri", color: answer ? "2563EB" : "999999" })], spacing: { after: 150 } }));
      });
    }

    // Practice
    if (responses["practice"]) {
      sections.push(new Paragraph({ children: [new TextRun({ text: "🧭 Prática da Semana", bold: true, size: 26, font: "Calibri" })], spacing: { before: 300, after: 100 } }));
      sections.push(new Paragraph({ children: [new TextRun({ text: `Resposta: ${responses["practice"]}`, size: 22, font: "Calibri", color: "2563EB" })], spacing: { after: 200 } }));
    }

    // Prayer
    if (responses["prayer"]) {
      sections.push(new Paragraph({ children: [new TextRun({ text: "🙏 Oração Final", bold: true, size: 26, font: "Calibri" })], spacing: { before: 300, after: 100 } }));
      sections.push(new Paragraph({ children: [new TextRun({ text: responses["prayer"], size: 22, font: "Calibri", color: "2563EB" })], spacing: { after: 200 } }));
    }

    const doc = new Document({ sections: [{ children: sections }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Licao_${lesson.order_num}_${lesson.title.replace(/\s+/g, "_")}.docx`);
  }

  // ResponseField is intentionally inlined as a JSX helper (not a component)
  // to avoid remount/focus-loss issues. We use a plain function returning JSX.
  function renderResponseField(qKey: string, placeholder: string) {
    return (
      <textarea
        key={qKey}
        value={responses[qKey] ?? ""}
        onChange={e => updateResponse(qKey, e.target.value)}
        onBlur={e => saveResponse(qKey, e.target.value)}
        placeholder={isAdmin ? "(Sem resposta ainda)" : placeholder}
        readOnly={isAdmin}
        rows={3}
        className={`w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-colors ${isAdmin ? "opacity-70 cursor-default" : ""}`}
      />
    );
  }

  if (!contentLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando lição...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" />
        {isAdmin ? "Voltar" : "Voltar às lições"}
      </button>

      {/* Header */}
      <div className="rounded-2xl p-4 overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-primary-foreground/60 font-inter text-xs mb-1">Lição {lesson.order_num}</p>
        <h2 className="font-montserrat font-black text-primary-foreground text-xl leading-tight">{lesson.title}</h2>
        {lesson.objective && (
          <p className="text-primary-foreground/70 font-inter text-xs mt-2 leading-relaxed">{lesson.objective}</p>
        )}
        {isAdmin && targetUserId && (
          <div className="mt-2 px-2.5 py-1 bg-white/20 rounded-lg inline-block">
            <span className="text-primary-foreground text-xs font-inter font-semibold">👁️ Visualizando respostas do jovem</span>
          </div>
        )}
      </div>

      {/* 1. Saudação do Líder */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">👋 Saudação do Líder</p>
        </div>
        <div className="p-4">
          <p className="font-inter text-sm text-foreground leading-relaxed">{content.greeting}</p>
        </div>
      </div>

      {/* 2. Quebra-gelo */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🔗 Quebra-gelo</p>
        </div>
        <div className="p-4 space-y-3">
          <p className="font-inter text-sm text-foreground leading-relaxed">{content.icebreaker}</p>
          {renderResponseField("icebreaker", "Escreva sua resposta aqui...")}
        </div>
      </div>

      {/* 3. Episódio / Vídeo */}
      {content.video_link && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">🎥 Episódio</p>
          </div>
          <div className="p-4">
            <a href={content.video_link} target="_blank" rel="noopener noreferrer"
              onClick={() => setVideoWatched(true)}
              className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-colors">
              <Play className="w-5 h-5" />
              <span className="font-inter text-sm font-medium">Assistir episódio</span>
              {videoWatched && <CheckCircle2 className="w-4 h-4 text-brand-green ml-auto" />}
              {!videoWatched && <Link className="w-4 h-4 ml-auto" />}
            </a>
            {saveAttempted && !videoWatched && (
              <p className="text-destructive font-inter text-[10px] mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Assista o vídeo antes de salvar
              </p>
            )}
          </div>
        </div>
      )}

      {/* Áudio */}
      {content.audio_link && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-secondary" />
            <p className="font-montserrat font-bold text-foreground text-sm">🎧 Áudio / Podcast</p>
          </div>
          <div className="p-4">
            <a href={content.audio_link} target="_blank" rel="noopener noreferrer"
              onClick={() => setAudioListened(true)}
              className="flex items-center gap-3 p-3 bg-secondary/10 rounded-xl text-secondary hover:bg-secondary/20 transition-colors">
              <Volume2 className="w-5 h-5" />
              <span className="font-inter text-sm font-medium">Ouvir áudio</span>
              {audioListened && <CheckCircle2 className="w-4 h-4 text-brand-green ml-auto" />}
              {!audioListened && <Link className="w-4 h-4 ml-auto" />}
            </a>
            {saveAttempted && !audioListened && (
              <p className="text-destructive font-inter text-[10px] mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Ouça o áudio antes de salvar
              </p>
            )}
          </div>
        </div>
      )}

      {/* Apostila / PDF Download */}
      {content.pdf_link && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">📄 Baixar Apostila</p>
          </div>
          <div className="p-4">
            <a href={content.pdf_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl text-primary hover:bg-primary/20 transition-colors">
              <Download className="w-5 h-5" />
              <span className="font-inter text-sm font-medium">Baixar PDF da aula</span>
              <Link className="w-4 h-4 ml-auto" />
            </a>
          </div>
        </div>
      )}

      {/* 4. Resumo do Conteúdo */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">📝 Resumo do Conteúdo</p>
        </div>
        <div className="p-4">
          <p className="font-inter text-sm text-foreground leading-relaxed">{content.summary}</p>
          {lesson.topics && lesson.topics.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {lesson.topics.map((topic, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-green flex-shrink-0 mt-0.5" />
                  <p className="font-inter text-xs text-foreground">{topic}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Objetivo */}
      {lesson.objective && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">🎯 Objetivo do Encontro</p>
          </div>
          <div className="p-4">
            <p className="font-inter text-sm text-foreground leading-relaxed">{lesson.objective}</p>
          </div>
        </div>
      )}

      {/* 6. Textos Bíblicos */}
      {content.bible_texts.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <span className="text-sm">✝️</span>
            <p className="font-montserrat font-bold text-foreground text-sm">📖 Textos Bíblicos</p>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {content.bible_texts.map(text => (
                <button
                  key={text}
                  onClick={() => setBibleRef(text)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-xl text-primary font-inter text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <span>📖</span>
                  <span>{text}</span>
                </button>
              ))}
            </div>
            <BibleModal reference={bibleRef || ""} open={!!bibleRef} onClose={() => setBibleRef(null)} />
          </div>
        </div>
      )}

      {/* 7. Perguntas para Diálogo */}
      {content.questions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">💬 Perguntas para Diálogo</p>
            {!isAdmin && <span className="ml-auto text-muted-foreground font-inter text-[10px]">Salvo automaticamente</span>}
          </div>
          <div className="p-4 space-y-4">
            {content.questions.map((question, i) => (
              <div key={i}>
                <p className="font-inter text-sm text-foreground mb-2 font-medium">{i + 1}. {question}</p>
                {renderResponseField(`q${i}`, "Escreva sua reflexão aqui...")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Prática da Semana */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Target className="w-4 h-4 text-secondary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🧭 Prática da Semana</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-3 bg-secondary/10 rounded-xl">
            <p className="font-inter text-sm text-foreground leading-relaxed">{content.practice}</p>
          </div>
          <p className="font-inter text-xs text-muted-foreground font-medium">O que você planeja viver na prática esta semana?</p>
          {renderResponseField("practice", "Escreva aqui como vai aplicar esta lição...")}
        </div>
      </div>

      {/* 9. Oração Final */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <p className="font-montserrat font-bold text-foreground text-sm">🙏 Oração Final</p>
        </div>
        <div className="p-4 space-y-3">
          <p className="font-inter text-xs text-muted-foreground leading-relaxed">{content.prayer_prompt}</p>
          {renderResponseField("prayer", "Escreva sua oração pessoal...")}
        </div>
      </div>

      {/* Validation warning */}
      {!isAdmin && saveAttempted && !canSave && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="font-inter text-xs text-destructive">
            Para salvar, falta: {missingItems.join(", ")}.
          </p>
        </div>
      )}

      {/* Save button (only for users) */}
      {!isAdmin && (
        <div className="space-y-2 relative">
          {/* Completion celebration overlay */}
          <AnimatePresence>
            {showCompletionAnim && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute -top-20 left-0 right-0 z-10 flex flex-col items-center"
              >
                <motion.div
                  initial={{ y: 20 }}
                  animate={{ y: [20, -10, 0] }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="bg-brand-green/95 text-primary-foreground px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-montserrat font-bold text-sm">Lição concluída! 🎉</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-70 transition-opacity ${
              !canSave && saveAttempted ? "opacity-70" : ""
            }`}
            style={{ background: "var(--gradient-hero)" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : lastSaved ? `✅ Salvo às ${lastSaved.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Salvar respostas"}
          </button>

          {Object.keys(responses).length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadWord}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl font-inter text-xs font-medium border border-border bg-card text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Word (.docx)
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl font-inter text-xs font-medium border border-border bg-card text-foreground hover:bg-muted/50 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF completo
                </button>
              </div>
              <button
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-inter text-xs font-bold border border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartilhar via WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
