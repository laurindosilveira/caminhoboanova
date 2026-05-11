import { GraduationCap, CalendarDays, ChevronDown, ChevronRight, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import type { Course, Lesson } from "./shared";

type AgendaSchedule = {
  loading: boolean;
  hasScheduledEvents: boolean;
  scheduledLessonIds: Set<string>;
  studyOpenLessonIds: Set<string>;
  lateAccessLessonIds: Set<string>;
  lessonEventDate: Map<string, Date>;
  lessonDevotionalDates: Map<string, Date[]>;
  schedule: { lessonId: string; eventDate: Date; windowStart: Date }[];
};

type Props = {
  courses: Course[];
  expandedCourse: string | null;
  onExpandCourse: (id: string | null) => void;
  unlockedCourseIds: Set<string>;
  completedLessonIds: Set<string>;
  fullyCompletedLessonIds: Set<string>;
  agendaSchedule: AgendaSchedule;
  manualLessonOverrideIds: Set<string>;
  isLeaderOrAdmin: boolean;
  onSelectLesson: (lesson: Lesson) => void;
};

export default function CourseTrailSection({
  courses, expandedCourse, onExpandCourse,
  unlockedCourseIds, completedLessonIds, fullyCompletedLessonIds,
  agendaSchedule, manualLessonOverrideIds, isLeaderOrAdmin, onSelectLesson,
}: Props) {
  if (courses.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-secondary/10 rounded-2xl p-4 flex items-start gap-3">
        <GraduationCap className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-montserrat font-bold text-foreground text-sm">Trilha Confirmatória</p>
          <p className="text-muted-foreground font-inter text-xs mt-0.5">
            {courses.reduce((s, c) => s + c.lessons.length, 0)} lições em {courses.length} cursos
          </p>
        </div>
      </div>

      {/* Waiting message */}
      {!agendaSchedule.loading && !agendaSchedule.hasScheduledEvents && (
        <div className="bg-accent/10 rounded-2xl p-4 border border-accent/20 flex items-start gap-3">
          <CalendarDays className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-montserrat font-bold text-foreground text-sm">Aguardando programação</p>
            <p className="text-muted-foreground font-inter text-xs mt-0.5">
              Seu líder ainda não agendou os próximos estudos. Os devocionais e lições serão liberados conforme a agenda. 📅
            </p>
          </div>
        </div>
      )}

      {/* Course accordion */}
      {courses.map((course) => {
        const isOpen = expandedCourse === course.id;
        const courseHasManualOverride = course.lessons.some((lesson) => manualLessonOverrideIds.has(lesson.id));
        const isCourseUnlocked = isLeaderOrAdmin || unlockedCourseIds.has(course.id) || courseHasManualOverride;
        const doneLessons = course.lessons.filter(l => fullyCompletedLessonIds.has(l.id)).length;
        const totalLessons = course.lessons.length;
        const coursePct = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
        return (
          <div key={course.id} className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${
            isCourseUnlocked ? "border-border" : "border-border opacity-75"
          }`}>
            <button
              onClick={() => isCourseUnlocked ? onExpandCourse(isOpen ? null : course.id) : toast.info("Este curso ainda não foi liberado pelo líder.")}
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

            {isOpen && isCourseUnlocked && (
              <div className="border-t border-border">
                {course.lessons.length === 0 ? (
                  <p className="px-4 py-3 text-muted-foreground font-inter text-xs text-center">Nenhuma lição cadastrada ainda.</p>
                ) : (
                  course.lessons.map((lesson) => {
                    const isDone = completedLessonIds.has(lesson.id);
                    const isFullyDone = fullyCompletedLessonIds.has(lesson.id);
                    const isScheduled = agendaSchedule.scheduledLessonIds.has(lesson.id);
                    const isStudyOpen = agendaSchedule.studyOpenLessonIds.has(lesson.id);
                    const hasManualOverride = manualLessonOverrideIds.has(lesson.id);
                    const eventDate = agendaSchedule.lessonEventDate.get(lesson.id);
                    const eventDay = eventDate ? new Date(eventDate) : null;
                    if (eventDay) eventDay.setHours(0, 0, 0, 0);
                    const todayZero = new Date(); todayZero.setHours(0, 0, 0, 0);
                    const isLateAccess = !isLeaderOrAdmin && agendaSchedule.lateAccessLessonIds.has(lesson.id) && !isFullyDone;
                    const isAccessible = isLeaderOrAdmin || isStudyOpen || isLateAccess || isFullyDone || hasManualOverride;
                    const isLocked = !isLeaderOrAdmin && agendaSchedule.hasScheduledEvents && !isAccessible && !isFullyDone;
                    const isNotScheduled = !isLeaderOrAdmin && agendaSchedule.hasScheduledEvents && !isScheduled && !isFullyDone && !isDone && !hasManualOverride;

                    let lockMessage = "";
                    if (isNotScheduled) {
                      lockMessage = "Aguardando agenda";
                    } else if (hasManualOverride) {
                      lockMessage = "Liberação manual do líder";
                    } else if (isLateAccess) {
                      lockMessage = "Acesso tardio — sem pontuação";
                    } else if (isLocked) {
                      const entry = agendaSchedule.schedule.find(e => e.lessonId === lesson.id);
                      if (entry) {
                        lockMessage = `Disponível em ${entry.windowStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
                      } else {
                        lockMessage = "Ainda não liberada";
                      }
                    }

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          if (isLocked || isNotScheduled) {
                            toast.info(isNotScheduled
                              ? "Esta lição ainda não foi agendada pelo líder."
                              : "Esta lição ainda não foi liberada.", {
                              duration: 3000,
                            });
                            return;
                          }
                          onSelectLesson(lesson);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors ${
                          (isLocked || isNotScheduled) ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/5"
                        } ${isFullyDone ? "bg-brand-green/5" : isDone ? "bg-secondary/5" : ""}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isFullyDone ? "bg-brand-green/15" : (isLocked || isNotScheduled) ? "bg-muted" : "bg-secondary/10"
                        }`}>
                          {isFullyDone
                            ? <CheckCircle2 className="w-4 h-4 text-brand-green" />
                            : (isLocked || isNotScheduled)
                            ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            : <span className="font-montserrat font-bold text-secondary text-xs">{lesson.order_num}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-inter text-sm ${isFullyDone ? "text-brand-green font-medium" : (isLocked || isNotScheduled) ? "text-muted-foreground" : "text-foreground"}`}>{lesson.title}</p>
                          {lesson.objective && (
                            <p className="font-inter text-[10px] text-muted-foreground truncate mt-0.5">{lesson.objective}</p>
                          )}
                          {lockMessage && (
                            <p className="font-inter text-[10px] text-muted-foreground mt-0.5">{lockMessage}</p>
                          )}
                          {isDone && !isFullyDone && !isLateAccess && !(isLocked || isNotScheduled) && (
                            <p className="font-inter text-[10px] text-secondary mt-0.5">⏳ Faltam devocionais ou estudo</p>
                          )}
                        </div>
                        {isFullyDone
                          ? <span className="text-[10px] font-inter font-bold flex-shrink-0 bg-brand-green/15 text-brand-green px-2 py-0.5 rounded-full">✓ Completa</span>
                          : isLateAccess
                          ? <span className="text-[10px] font-inter font-bold flex-shrink-0 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Prazo encerrado</span>
                          : isDone && !(isLocked || isNotScheduled)
                          ? <span className="text-[10px] font-inter font-bold flex-shrink-0 bg-secondary/15 text-secondary px-2 py-0.5 rounded-full">Em andamento</span>
                          : (isLocked || isNotScheduled)
                          ? <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        }
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
