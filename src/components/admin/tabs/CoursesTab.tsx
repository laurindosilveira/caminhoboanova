import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, ChevronDown, ChevronRight, BookOpen, Tag, Edit3, FileText, Pencil } from "lucide-react";
import LessonContentEditor from "@/components/admin/tabs/LessonContentEditor";
import LessonDevotionalEditor from "@/components/admin/tabs/LessonDevotionalEditor";
import LeaderGuideEditor from "@/components/admin/tabs/LeaderGuideEditor";
import LeaderLessonEditor from "@/components/admin/tabs/leader/LeaderLessonEditor";

type Lesson = {
  id: string;
  course_id: string;
  order_num: number;
  title: string;
  objective: string | null;
  topics: string[] | null;
};

type Course = {
  id: string;
  order_num: number;
  title: string;
  subtitle: string | null;
  lessons: Lesson[];
};

type EditMode = { lesson: Lesson; mode: "study" | "devotionals" | "leader-guide" | "leader-customize" } | null;

export default function CoursesTab() {
  const { role } = useAuth();
  const isLider = role === "lider";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [publishedLessonIds, setPublishedLessonIds] = useState<Set<string>>(new Set());
  const [devotionalCounts, setDevotionalCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    const [{ data: coursesData }, { data: lessonsData }, { data: contentData }, { data: devData }] = await Promise.all([
      supabase.from("courses").select("*").order("order_num"),
      supabase.from("lessons").select("*").order("order_num"),
      supabase.from("lesson_content").select("lesson_id"),
      supabase.from("devotional_content").select("lesson_id").not("lesson_id", "is", null),
    ]);
    const courseList = (coursesData ?? []).map(c => ({
      ...c,
      lessons: (lessonsData ?? []).filter(l => l.course_id === c.id),
    }));
    setCourses(courseList);
    setPublishedLessonIds(new Set((contentData ?? []).map(c => c.lesson_id)));
    
    // Count devotionals per lesson
    const counts: Record<string, number> = {};
    (devData ?? []).forEach(d => {
      if (d.lesson_id) counts[d.lesson_id] = (counts[d.lesson_id] || 0) + 1;
    });
    setDevotionalCounts(counts);
    
    if (courseList.length > 0) setExpandedCourse(courseList[0].id);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-3 animate-pulse">
          <GraduationCap className="w-6 h-6 text-secondary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando cursos...</p>
      </div>
    );
  }

  // If editing a lesson
  if (editMode) {
    if (editMode.mode === "study") {
      return <LessonContentEditor lesson={editMode.lesson} onBack={() => { setEditMode(null); fetchCourses(); }} />;
    }
    if (editMode.mode === "leader-guide") {
      return <LeaderGuideEditor lesson={editMode.lesson} onBack={() => { setEditMode(null); fetchCourses(); }} />;
    }
    if (editMode.mode === "leader-customize") {
      return <LeaderLessonEditor lesson={editMode.lesson} onBack={() => { setEditMode(null); fetchCourses(); }} />;
    }
    return <LessonDevotionalEditor lesson={editMode.lesson} onBack={() => { setEditMode(null); fetchCourses(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-secondary/10 rounded-2xl p-4 flex items-start gap-3">
        <GraduationCap className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-montserrat font-bold text-foreground text-sm">Trilha Confirmatória</p>
          <p className="text-muted-foreground font-inter text-xs mt-0.5">
            {courses.reduce((s, c) => s + c.lessons.length, 0)} lições em {courses.length} cursos cadastrados
          </p>
          <p className="text-muted-foreground font-inter text-[10px] mt-1">
            {isLider
              ? "✅ = publicado · Clique em \"Personalizar\" para adaptar uma lição para sua turma"
              : "✅ = conteúdo publicado · 📝 = usando conteúdo padrão · 📖 = devocionais"
            }
          </p>
        </div>
      </div>

      {courses.map((course) => {
        const isOpen = expandedCourse === course.id;
        return (
          <div key={course.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedCourse(isOpen ? null : course.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--gradient-hero)" }}>
                <span className="font-montserrat font-black text-primary-foreground text-sm">#{course.order_num}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-montserrat font-bold text-foreground text-sm">{course.title}</p>
                {course.subtitle && <p className="text-muted-foreground font-inter text-xs truncate">{course.subtitle}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-muted-foreground font-inter text-xs">{course.lessons.length} lições</p>
                  <span className="text-muted-foreground font-inter text-[10px]">·</span>
                  <p className="text-brand-green font-inter text-[10px] font-medium">
                    {course.lessons.filter(l => publishedLessonIds.has(l.id)).length} publicadas
                  </p>
                </div>
              </div>
              {isOpen
                ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              }
            </button>

            {isOpen && (
              <div className="border-t border-border">
                {course.lessons.map((lesson) => {
                  const devCount = devotionalCounts[lesson.id] || 0;
                  return (
                    <div key={lesson.id} className="border-b border-border last:border-b-0">
                      <div className="flex flex-col gap-2 px-4 py-3">
                        {/* Lesson info */}
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                            <span className="font-montserrat font-bold text-secondary text-xs">{lesson.order_num}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-inter text-sm text-foreground">{lesson.title}</p>
                            {lesson.objective && (
                              <div className="flex items-start gap-1.5 mt-1">
                                <BookOpen className="w-3 h-3 text-secondary flex-shrink-0 mt-0.5" />
                                <p className="font-inter text-[10px] text-muted-foreground">{lesson.objective}</p>
                              </div>
                            )}
                            {lesson.topics && lesson.topics.length > 0 && (
                              <div className="flex items-start gap-1.5 mt-1">
                                <Tag className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                <div className="flex flex-wrap gap-1">
                                  {lesson.topics.map((topic, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-inter font-medium">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {publishedLessonIds.has(lesson.id) ? (
                            <span className="text-brand-green text-[9px] font-inter font-bold flex-shrink-0">✅</span>
                          ) : (
                            <span className="text-muted-foreground text-[9px] font-inter flex-shrink-0">📝</span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 ml-10 flex-wrap">
                          {/* Admin-only buttons */}
                          {!isLider && (
                            <>
                              <button
                                onClick={() => setEditMode({ lesson, mode: "study" })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors flex-shrink-0"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="font-inter text-xs font-medium">
                                  {publishedLessonIds.has(lesson.id) ? "Editar Estudo" : "Criar Estudo"}
                                </span>
                              </button>
                              <button
                                onClick={() => setEditMode({ lesson, mode: "devotionals" })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-green/10 text-brand-green hover:bg-brand-green/20 transition-colors flex-shrink-0"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span className="font-inter text-xs font-medium">
                                  Devocionais {devCount > 0 && `(${devCount})`}
                                </span>
                              </button>
                            </>
                          )}

                          {/* Roteiro Líder — visible to both */}
                          <button
                            onClick={() => setEditMode({ lesson, mode: "leader-guide" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors flex-shrink-0"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="font-inter text-xs font-medium">Roteiro</span>
                          </button>

                          {/* Personalizar — leader only */}
                          {isLider && (
                            <button
                              onClick={() => setEditMode({ lesson, mode: "leader-customize" })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="font-inter text-xs font-medium">Personalizar</span>
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
        );
      })}
    </div>
  );
}
