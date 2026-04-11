import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Lock, BookOpen, ChevronDown, ChevronRight, CalendarDays, Heart, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";

type Lesson = {
  id: string;
  title: string;
  order_num: number;
  objective: string | null;
  course_id: string;
};

type Course = {
  id: string;
  title: string;
  subtitle: string | null;
  order_num: number;
  lessons: Lesson[];
};

type IntegratedStats = {
  lessonsStudied: number;
  totalLessons: number;
  devotionalsCompleted: number;
  totalDevotionals: number;
  attendancePresent: number;
  totalEvents: number;
  worshipApproved: number;
};

function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  onSelectLesson?: (lessonId: string) => void;
};

export default function JourneyPath({ onSelectLesson }: Props = {}) {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const currentArea = effectiveArea || profile?.area || "";
  const [courses, setCourses] = useState<Course[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [fullyCompletedLessonIds, setFullyCompletedLessonIds] = useState<Set<string>>(new Set());
  const [unlockedCourseIds, setUnlockedCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [integrated, setIntegrated] = useState<IntegratedStats>({
    lessonsStudied: 0, totalLessons: 0,
    devotionalsCompleted: 0, totalDevotionals: 0,
    attendancePresent: 0, totalEvents: 0,
    worshipApproved: 0,
  });

  useEffect(() => {
    if (currentArea) fetchData();
  }, [currentArea]);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [
      { data: coursesData },
      { data: lessonsData },
      { data: responsesData },
      { data: devContentData },
      { data: devProgressData },
      { data: events },
      { data: attendance },
      { data: worship },
      { data: unlocksData },
    ] = await Promise.all([
      supabase.from("courses").select("*").order("order_num"),
      supabase.from("lessons").select("id, title, order_num, objective, course_id").order("order_num"),
      supabase.from("lesson_responses").select("lesson_id").eq("user_id", user.id),
      supabase.from("devotional_content").select("id, lesson_id").not("lesson_id", "is", null),
      supabase.from("devotional_progress").select("devotional_id").eq("user_id", user.id),
      supabase.from("events").select("id").gte("event_date", new Date(Date.now() - 90 * 86400000).toISOString()),
      supabase.from("attendance").select("event_id, status").eq("user_id", user.id),
      supabase.from("worship_attendance").select("id, status").eq("user_id", user.id).eq("status", "aprovado"),
      supabase.from("course_unlocks").select("course_id").eq("area", currentArea),
    ]);

    const lessons = lessonsData ?? [];
    const lessonIdsWithResponses = new Set((responsesData ?? []).map(r => r.lesson_id));
    setCompletedLessonIds(lessonIdsWithResponses);

    // Compute fully completed lessons (study + all devotionals)
    const devsByLesson: Record<string, string[]> = {};
    (devContentData ?? []).forEach((d: any) => {
      if (d.lesson_id) {
        if (!devsByLesson[d.lesson_id]) devsByLesson[d.lesson_id] = [];
        devsByLesson[d.lesson_id].push(d.id);
      }
    });
    const completedDevIds = new Set((devProgressData ?? []).map((p: any) => p.devotional_id));
    const fullyDone = new Set<string>();
    lessons.forEach((l) => {
      const hasStudy = lessonIdsWithResponses.has(l.id);
      const lessonDevs = devsByLesson[l.id] ?? [];
      const allDevsDone = lessonDevs.length === 0 || lessonDevs.every(devId => completedDevIds.has(devId));
      if (hasStudy && allDevsDone) fullyDone.add(l.id);
    });
    setFullyCompletedLessonIds(fullyDone);

    // Build courses
    const courseList = (coursesData ?? []).map(c => ({
      ...c,
      lessons: lessons.filter(l => l.course_id === c.id),
    }));
    setCourses(courseList);
    setUnlockedCourseIds(new Set((unlocksData ?? []).map((u: any) => u.course_id)));
    if (courseList.length > 0) setExpandedCourse(courseList[0].id);

    // Integrated stats
    const totalDevotionals = (devContentData ?? []).length;
    setIntegrated({
      lessonsStudied: lessonIdsWithResponses.size,
      totalLessons: lessons.length,
      devotionalsCompleted: completedDevIds.size,
      totalDevotionals,
      attendancePresent: (attendance ?? []).filter(a => a.status === "presente").length,
      totalEvents: (events ?? []).length,
      worshipApproved: (worship ?? []).length,
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-montserrat font-black text-foreground text-xl">🛤️ Minha Jornada</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Overall progress
  const totalItems = integrated.totalLessons + integrated.totalDevotionals;
  const doneItems = integrated.lessonsStudied + integrated.devotionalsCompleted;
  const overallPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const lessonPct = integrated.totalLessons > 0 ? Math.round((integrated.lessonsStudied / integrated.totalLessons) * 100) : 0;
  const devPct = integrated.totalDevotionals > 0 ? Math.round((integrated.devotionalsCompleted / integrated.totalDevotionals) * 100) : 0;

  return (
    <div className="px-5 pt-6">
      {/* Header + overall progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-montserrat font-black text-foreground text-xl">🛤️ Minha Jornada</h2>
          <span className="text-muted-foreground text-xs font-inter bg-muted rounded-full px-3 py-1">
            {overallPct}% completo
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${overallPct}%`,
                background: overallPct >= 70 ? "var(--gradient-green)" : overallPct >= 34 ? "var(--gradient-orange)" : "hsl(var(--destructive))",
              }}
            />
          </div>
          <span className="text-xs font-montserrat font-bold text-secondary flex-shrink-0">{doneItems}/{totalItems}</span>
        </div>
        <p className="text-muted-foreground font-inter text-[11px] mt-1.5">
          Progresso geral: lições estudadas e devocionais concluídos
        </p>

        {/* Fase atual */}
        {(() => {
          // Only consider unlocked courses
          const unlockedCourses = courses.filter(c => unlockedCourseIds.has(c.id));
          if (unlockedCourses.length === 0) return null;

          // Find the highest-order unlocked course that still has pending lessons
          const withPending = unlockedCourses.filter(c =>
            c.lessons.some(l => !fullyCompletedLessonIds.has(l.id))
          );

          // If all unlocked courses are fully done, show the last unlocked as completed
          const currentCourse = withPending.length > 0
            ? withPending[withPending.length - 1]
            : unlockedCourses[unlockedCourses.length - 1];

          const currentLesson = currentCourse.lessons.find(l => !fullyCompletedLessonIds.has(l.id));
          const allDone = withPending.length === 0;

          return (
            <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 ${allDone ? "bg-brand-green/10" : "bg-secondary/10"}`}>
              <span className="text-sm">{allDone ? "🏆" : "📍"}</span>
              <div className="min-w-0">
                <p className="font-montserrat font-bold text-foreground text-xs">
                  {allDone ? "Completo" : "Fase atual"}: Curso {currentCourse.order_num} — {currentCourse.title}
                </p>
                {currentLesson && !allDone && (
                  <p className="font-inter text-[10px] text-muted-foreground truncate">
                    Próxima: Lição {currentLesson.order_num} — {currentLesson.title}
                  </p>
                )}
                {allDone && (
                  <p className="font-inter text-[10px] text-brand-green truncate">
                    Todas as lições concluídas! 🎉
                  </p>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Lições", done: integrated.lessonsStudied, total: integrated.totalLessons, pct: lessonPct, color: "#1F3C88", icon: "🎓" },
          { label: "Devocionais", done: integrated.devotionalsCompleted, total: integrated.totalDevotionals, pct: devPct, color: "#2ECC71", icon: "📖" },
        ].map(({ label, done, total, pct, color, icon }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <ProgressRing pct={pct} color={color} size={48} />
              <span className="absolute inset-0 flex items-center justify-center text-base">{icon}</span>
            </div>
            <div>
              <p className="font-montserrat font-bold text-foreground text-sm">{done}/{total}</p>
              <p className="font-inter text-[10px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Extra stats row */}
      <div className="flex gap-2 mb-5">
        <div className="flex-1 bg-card rounded-xl border border-border p-3 flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
          <div>
            <p className="font-montserrat font-bold text-foreground text-xs">{integrated.attendancePresent} presença{integrated.attendancePresent !== 1 ? "s" : ""}</p>
            <p className="font-inter text-[10px] text-muted-foreground">em encontros</p>
          </div>
        </div>
        <div className="flex-1 bg-card rounded-xl border border-border p-3 flex items-center gap-2.5">
          <Heart className="w-4 h-4 text-brand-green flex-shrink-0" />
          <div>
            <p className="font-montserrat font-bold text-foreground text-xs">{integrated.worshipApproved} culto{integrated.worshipApproved !== 1 ? "s" : ""}</p>
            <p className="font-inter text-[10px] text-muted-foreground">confirmados</p>
          </div>
        </div>
      </div>

      {/* Courses list */}
      {courses.length === 0 ? (
        <div className="text-center py-10">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-montserrat font-bold text-foreground text-sm">Jornada em preparação</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Seu pastor está preparando o conteúdo. Volte em breve!</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="w-4 h-4 text-secondary" />
            <p className="font-montserrat font-bold text-foreground text-sm">Trilha de Cursos</p>
          </div>

          {courses.map((course) => {
            const isOpen = expandedCourse === course.id;
            const isCourseUnlocked = unlockedCourseIds.has(course.id);
            const doneLessons = course.lessons.filter(l => fullyCompletedLessonIds.has(l.id)).length;
            const totalLessons = course.lessons.length;
            const coursePct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

            return (
              <div key={course.id} className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${
                isCourseUnlocked ? "border-border" : "border-border opacity-75"
              }`}>
                {/* Course header */}
                <button
                  onClick={() => isCourseUnlocked ? setExpandedCourse(isOpen ? null : course.id) : null}
                  className={`w-full flex items-center gap-3 p-4 text-left ${!isCourseUnlocked ? "cursor-default" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCourseUnlocked ? "" : "bg-muted"
                  }`} style={isCourseUnlocked ? { background: "var(--gradient-hero)" } : {}}>
                    {isCourseUnlocked
                      ? <span className="font-montserrat font-black text-primary-foreground text-sm">#{course.order_num}</span>
                      : <Lock className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-sm">{course.title}</p>
                    {isCourseUnlocked ? (
                      <>
                        {course.subtitle && <p className="text-muted-foreground font-inter text-xs truncate">{course.subtitle}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${coursePct}%`,
                                background: coursePct === 100 ? "var(--gradient-green)" : "var(--gradient-hero)",
                              }}
                            />
                          </div>
                          <span className={`font-inter text-[10px] font-semibold flex-shrink-0 ${coursePct === 100 ? "text-brand-green" : "text-muted-foreground"}`}>
                            {doneLessons}/{totalLessons}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground font-inter text-xs mt-0.5">🔒 Curso ainda não liberado pelo líder</p>
                    )}
                  </div>
                  {isCourseUnlocked && (
                    isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {/* Lessons list */}
                {isOpen && isCourseUnlocked && (
                  <div className="border-t border-border">
                    {course.lessons.length === 0 ? (
                      <p className="px-4 py-3 text-muted-foreground font-inter text-xs text-center">Nenhuma lição cadastrada ainda.</p>
                    ) : (
                      course.lessons.map((lesson, lessonIndex) => {
                        const isDone = completedLessonIds.has(lesson.id);
                        const isFullyDone = fullyCompletedLessonIds.has(lesson.id);
                        const prevLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
                        // A lesson the user already started/completed is never locked for viewing
                        const isLocked = !isDone && !isFullyDone && (prevLesson ? !fullyCompletedLessonIds.has(prevLesson.id) : false);

                        const isClickable = !isLocked && !!onSelectLesson;
                        return (
                          <div
                            key={lesson.id}
                            role={isClickable ? "button" : undefined}
                            tabIndex={isClickable ? 0 : undefined}
                            onClick={isClickable ? () => onSelectLesson(lesson.id) : undefined}
                            onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") onSelectLesson(lesson.id); } : undefined}
                            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 ${
                              isLocked ? "opacity-50" : ""
                            } ${isFullyDone ? "bg-brand-green/5" : isDone ? "bg-secondary/5" : ""} ${
                              isClickable ? "cursor-pointer active:bg-muted/60 transition-colors" : ""
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isFullyDone ? "bg-brand-green/15" : isLocked ? "bg-muted" : "bg-secondary/10"
                            }`}>
                              {isFullyDone
                                ? <CheckCircle2 className="w-4 h-4 text-brand-green" />
                                : isLocked
                                ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                : <span className="font-montserrat font-bold text-secondary text-xs">{lesson.order_num}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-inter text-sm ${isFullyDone ? "text-brand-green font-medium" : isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                                {lesson.title}
                              </p>
                              {lesson.objective && (
                                <p className="text-muted-foreground font-inter text-[10px] truncate">{lesson.objective}</p>
                              )}
                            </div>
                            {isFullyDone && (
                              <span className="text-[10px] font-inter font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                ✓ Feita
                              </span>
                            )}
                            {isDone && !isFullyDone && (
                              <span className="text-[10px] font-inter font-semibold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                Em andamento
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
