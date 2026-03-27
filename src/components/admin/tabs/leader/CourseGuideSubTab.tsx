import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { BookOpen, ChevronRight, ChevronLeft, FileText, MessageCircle, Target, Heart, Pen, Play, Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import BibleModal from "@/components/home/BibleModal";

type Course = { id: string; title: string; order_num: number };
type Lesson = { id: string; title: string; order_num: number; course_id: string; objective: string | null };
type LessonContent = {
  greeting: string;
  icebreaker: string;
  summary: string;
  bible_texts: string[];
  questions: string[];
  practice: string;
  prayer_prompt: string;
};
type LeaderNotes = {
  participation_notes: string;
  questions_notes: string;
  pastoral_care_notes: string;
  follow_up_notes: string;
  spiritual_notes: string;
};
type PastorInfo = { pastor_name: string; phone: string };

export default function CourseGuideSubTab() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [content, setContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [bibleRef, setBibleRef] = useState<string | null>(null);
  const [notes, setNotes] = useState<LeaderNotes>({ participation_notes: "", questions_notes: "", pastoral_care_notes: "", follow_up_notes: "", spiritual_notes: "" });
  const [savingNotes, setSavingNotes] = useState(false);
  const [pastorInfo, setPastorInfo] = useState<PastorInfo | null>(null);

  useEffect(() => { fetchCourses(); fetchPastor(); }, [effectiveArea]);

  async function fetchPastor() {
    const area = effectiveArea || profile?.area;
    if (!area) return;
    const { data } = await supabase.from("area_pastors").select("pastor_name, phone").eq("area", area).maybeSingle();
    if (data) setPastorInfo(data);
  }

  async function fetchCourses() {
    setLoading(true);
    const { data } = await supabase.from("courses").select("id, title, order_num").order("order_num");
    setCourses(data ?? []);
    setLoading(false);
  }

  async function selectCourse(course: Course) {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setContent(null);
    setLoading(true);
    const { data } = await supabase.from("lessons").select("id, title, order_num, course_id, objective").eq("course_id", course.id).order("order_num");
    setLessons(data ?? []);
    setLoading(false);
  }

  async function selectLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setLoading(true);
    const [{ data: guideData }, { data: notesData }] = await Promise.all([
      supabase.from("leader_guide").select("*").eq("lesson_id", lesson.id).maybeSingle(),
      supabase.from("leader_meeting_notes").select("*").eq("lesson_id", lesson.id).eq("leader_id", profile?.user_id ?? "").maybeSingle(),
    ]);
    setContent(guideData ? {
      greeting: guideData.greeting || "",
      icebreaker: guideData.icebreaker || "",
      summary: guideData.summary || "",
      bible_texts: (guideData.bible_texts as string[])?.length ? (guideData.bible_texts as string[]) : [],
      questions: (guideData.questions as string[])?.length ? (guideData.questions as string[]) : [],
      practice: guideData.practice || "",
      prayer_prompt: guideData.prayer_prompt || "",
    } : null);
    setNotes({
      participation_notes: notesData?.participation_notes || "",
      questions_notes: notesData?.questions_notes || "",
      pastoral_care_notes: notesData?.pastoral_care_notes || "",
      follow_up_notes: notesData?.follow_up_notes || "",
      spiritual_notes: notesData?.spiritual_notes || "",
    });
    setLoading(false);
  }

  async function handleSaveNotes() {
    if (!selectedLesson || !profile?.user_id) return;
    setSavingNotes(true);
    const { error } = await supabase.from("leader_meeting_notes").upsert({
      leader_id: profile.user_id,
      lesson_id: selectedLesson.id,
      ...notes,
    }, { onConflict: "leader_id,lesson_id" });
    setSavingNotes(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Anotações salvas!" });
    }
  }

  function openPastorWhatsApp() {
    if (!pastorInfo?.phone) return;
    const phone = pastorInfo.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá, ${pastorInfo.pastor_name}! Sou líder e preciso de orientação sobre o encontro "${selectedLesson?.title}" do curso "${selectedCourse?.title}".`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  // ===== LESSON VIEW =====
  if (selectedLesson && content) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedLesson(null); setContent(null); }}
          className="flex items-center gap-1.5 text-primary font-inter text-sm font-medium hover:underline">
          <ChevronLeft className="w-4 h-4" /> Voltar às lições
        </button>

        {/* Hero */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="px-5 py-5">
            <p className="text-primary-foreground/60 font-inter text-[10px] uppercase tracking-wider font-semibold mb-1">
              📘 Folha do Líder — {selectedCourse?.title}
            </p>
            <h2 className="font-montserrat font-black text-primary-foreground text-lg">
              Encontro {selectedLesson.order_num}: {selectedLesson.title}
            </h2>
            {selectedLesson.objective && (
              <p className="text-primary-foreground/70 font-inter text-xs mt-2">🎯 {selectedLesson.objective}</p>
            )}
          </div>
        </div>

        {/* Content sections */}
        {content.greeting && <Section icon={<Play className="w-4 h-4 text-secondary" />} title="🙌 Saudação e Oração Inicial"><p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.greeting}</p></Section>}
        {content.icebreaker && <Section icon={<MessageCircle className="w-4 h-4 text-accent" />} title="🧊 Quebra-gelo"><p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.icebreaker}</p></Section>}
        {content.summary && <Section icon={<FileText className="w-4 h-4 text-primary" />} title="📖 Orientações do Encontro"><p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.summary}</p></Section>}

        {content.bible_texts.length > 0 && (
          <Section icon={<BookOpen className="w-4 h-4 text-brand-green" />} title="📜 Textos Bíblicos">
            <div className="flex flex-wrap gap-2">
              {content.bible_texts.map(text => (
                <button key={text} onClick={() => setBibleRef(text)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 rounded-xl text-primary font-inter text-sm font-medium hover:bg-primary/20 transition-colors">
                  <span>📖</span><span>{text}</span>
                </button>
              ))}
            </div>
            <BibleModal reference={bibleRef || ""} open={!!bibleRef} onClose={() => setBibleRef(null)} />
          </Section>
        )}

        {content.questions.length > 0 && (
          <Section icon={<Pen className="w-4 h-4 text-secondary" />} title="💬 Perguntas para Diálogo">
            <div className="space-y-2.5">
              {content.questions.map((q, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary/15 flex items-center justify-center font-montserrat font-bold text-secondary text-xs">{i + 1}</span>
                  <p className="text-foreground font-inter text-sm leading-relaxed pt-0.5">{q}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {content.practice && <Section icon={<Target className="w-4 h-4 text-brand-green" />} title="💬 Orientações e Conexão 3M"><p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.practice}</p></Section>}
        {content.prayer_prompt && <Section icon={<Heart className="w-4 h-4 text-destructive" />} title="🙏 Postura Espiritual e Oração"><p className="text-foreground font-inter text-sm leading-relaxed whitespace-pre-wrap">{content.prayer_prompt}</p></Section>}

        {/* ===== LEADER NOTES ===== */}
        <div className="bg-card rounded-2xl border-2 border-primary/20 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            <p className="font-montserrat font-bold text-foreground text-sm">📝 Anotações do Líder</p>
          </div>
          <div className="p-4 space-y-4">
            <NoteField label="Participação do grupo" value={notes.participation_notes} onChange={v => setNotes(n => ({ ...n, participation_notes: v }))} />
            <NoteField label="Perguntas importantes que surgiram" value={notes.questions_notes} onChange={v => setNotes(n => ({ ...n, questions_notes: v }))} />
            <NoteField label="Quem precisa de cuidado pastoral" value={notes.pastoral_care_notes} onChange={v => setNotes(n => ({ ...n, pastoral_care_notes: v }))} />
            <NoteField label="Pontos para retomar no próximo encontro" value={notes.follow_up_notes} onChange={v => setNotes(n => ({ ...n, follow_up_notes: v }))} />
            <NoteField label="Observações espirituais" value={notes.spiritual_notes} onChange={v => setNotes(n => ({ ...n, spiritual_notes: v }))} />

            <Button onClick={handleSaveNotes} disabled={savingNotes} className="w-full rounded-2xl h-11 font-montserrat font-bold">
              <Save className="w-4 h-4 mr-2" />
              {savingNotes ? "Salvando..." : "Salvar Anotações"}
            </Button>
          </div>
        </div>

        {/* ===== PASTOR HELP BUTTON ===== */}
        {pastorInfo && pastorInfo.phone && (
          <button
            onClick={openPastorWhatsApp}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-montserrat font-bold text-sm transition-all shadow-lg"
          >
            <Phone className="w-5 h-5" />
            Pedir ajuda ao Pastor {pastorInfo.pastor_name}
          </button>
        )}
      </div>
    );
  }

  // ===== LESSON LIST =====
  if (selectedCourse) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedCourse(null); setLessons([]); }}
          className="flex items-center gap-1.5 text-primary font-inter text-sm font-medium hover:underline">
          <ChevronLeft className="w-4 h-4" /> Voltar aos cursos
        </button>
        <div className="px-1">
          <h2 className="font-montserrat font-black text-foreground text-lg">{selectedCourse.title}</h2>
          <p className="text-muted-foreground font-inter text-xs mt-1">Selecione um encontro para ver o roteiro</p>
        </div>
        {loading ? (
          <div className="py-10 text-center"><p className="text-muted-foreground font-inter text-sm">Carregando lições...</p></div>
        ) : (
          <div className="space-y-2">
            {lessons.map(lesson => (
              <button key={lesson.id} onClick={() => selectLesson(lesson)}
                className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm hover:border-primary/30 hover:bg-primary/5 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                  <span className="font-montserrat font-black text-primary-foreground text-sm">{lesson.order_num}</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-foreground text-sm truncate">{lesson.title}</p>
                  {lesson.objective && <p className="text-muted-foreground font-inter text-[11px] truncate mt-0.5">{lesson.objective}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== COURSE LIST =====
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="font-montserrat font-black text-foreground text-lg">📋 Roteiro dos Cursos</h2>
        <p className="text-muted-foreground font-inter text-xs mt-1">Orientações completas para conduzir cada encontro presencial</p>
      </div>
      {loading ? (
        <div className="py-10 text-center"><p className="text-muted-foreground font-inter text-sm">Carregando cursos...</p></div>
      ) : (
        <div className="space-y-3">
          {courses.map(course => (
            <button key={course.id} onClick={() => selectCourse(course)}
              className="w-full flex items-center gap-4 p-5 bg-card rounded-2xl border border-border shadow-sm hover:border-primary/30 hover:bg-primary/5 transition-all">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-montserrat font-bold text-foreground text-sm">{course.title}</p>
                <p className="text-muted-foreground font-inter text-[11px] mt-0.5">Curso {course.order_num} · Toque para ver os encontros</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        {icon}
        <p className="font-montserrat font-bold text-foreground text-sm">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function NoteField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-montserrat font-bold text-muted-foreground mb-1.5 block">{label}</label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Registre aqui...`}
        className="text-sm border-border rounded-xl resize-none min-h-[70px]"
      />
    </div>
  );
}
