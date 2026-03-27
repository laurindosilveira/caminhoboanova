import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Video, Headphones, FileText, ChevronDown, ChevronRight, ExternalLink, Search } from "lucide-react";

type Resource = {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  courseOrder: number;
  lessonOrder: number;
  videoLink: string;
  audioLink: string;
  pdfLink: string;
};

const CATEGORIES = [
  { key: "all", label: "Todos", icon: BookOpen },
  { key: "video", label: "Vídeos", icon: Video },
  { key: "audio", label: "Áudios", icon: Headphones },
  { key: "pdf", label: "PDFs", icon: FileText },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

export default function ResourceLibrary() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryKey>("all");
  const [search, setSearch] = useState("");
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  async function fetchResources() {
    const [{ data: content }, { data: lessons }, { data: courses }] = await Promise.all([
      supabase.from("lesson_content").select("lesson_id, video_link, audio_link, pdf_link"),
      supabase.from("lessons").select("id, title, order_num, course_id"),
      supabase.from("courses").select("id, title, order_num").order("order_num"),
    ]);

    if (!content || !lessons || !courses) {
      setLoading(false);
      return;
    }

    const lessonMap = new Map(lessons.map(l => [l.id, l]));
    const courseMap = new Map(courses.map(c => [c.id, c]));

    const items: Resource[] = content
      .filter(c => c.video_link || c.audio_link || c.pdf_link)
      .map(c => {
        const lesson = lessonMap.get(c.lesson_id);
        const course = lesson ? courseMap.get(lesson.course_id) : null;
        return {
          lessonId: c.lesson_id,
          lessonTitle: lesson?.title ?? "Lição",
          courseTitle: course?.title ?? "Curso",
          courseOrder: course?.order_num ?? 0,
          lessonOrder: lesson?.order_num ?? 0,
          videoLink: c.video_link ?? "",
          audioLink: c.audio_link ?? "",
          pdfLink: c.pdf_link ?? "",
        };
      })
      .sort((a, b) => a.courseOrder - b.courseOrder || a.lessonOrder - b.lessonOrder);

    setResources(items);
    if (items.length > 0) {
      setExpandedCourse(items[0].courseTitle);
    }
    setLoading(false);
  }

  const filtered = resources.filter(r => {
    const matchCategory =
      filter === "all" ||
      (filter === "video" && r.videoLink) ||
      (filter === "audio" && r.audioLink) ||
      (filter === "pdf" && r.pdfLink);
    const matchSearch =
      !search ||
      r.lessonTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.courseTitle.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Group by course
  const grouped = filtered.reduce<Record<string, Resource[]>>((acc, r) => {
    if (!acc[r.courseTitle]) acc[r.courseTitle] = [];
    acc[r.courseTitle].push(r);
    return acc;
  }, {});

  const courseNames = Object.keys(grouped);

  // Counts
  const totalVideos = resources.filter(r => r.videoLink).length;
  const totalAudios = resources.filter(r => r.audioLink).length;
  const totalPdfs = resources.filter(r => r.pdfLink).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando recursos...</p>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-montserrat font-bold text-foreground text-sm">Nenhum recurso disponível</p>
        <p className="text-muted-foreground font-inter text-xs mt-1">Os materiais serão adicionados em breve.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-6 translate-x-6 pointer-events-none" />
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl border border-white/20">
            📚
          </div>
          <div>
            <h2 className="font-montserrat font-black text-primary-foreground text-base">Biblioteca de Recursos</h2>
            <p className="text-primary-foreground/70 font-inter text-[10px]">
              {totalVideos} vídeos · {totalAudios} áudios · {totalPdfs} documentos
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por tema ou lição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground font-inter text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Category filters */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = filter === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-inter text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Resources by course */}
      {courseNames.length === 0 ? (
        <div className="text-center py-8">
          <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground font-inter text-sm">Nenhum recurso encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courseNames.map(courseName => {
            const items = grouped[courseName];
            const isExpanded = expandedCourse === courseName;
            return (
              <div key={courseName} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedCourse(isExpanded ? null : courseName)}
                  className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-sm truncate">{courseName}</p>
                    <p className="text-muted-foreground font-inter text-[10px]">{items.length} {items.length === 1 ? "recurso" : "recursos"}</p>
                  </div>
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  }
                </button>

                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {items.map(r => (
                      <div key={r.lessonId} className="px-4 py-3">
                        <p className="font-inter text-sm text-foreground font-medium mb-2">{r.lessonTitle}</p>
                        <div className="flex flex-wrap gap-2">
                          {r.videoLink && (
                            <a
                              href={r.videoLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive font-inter text-xs font-medium hover:bg-destructive/20 transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Vídeo
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {r.audioLink && (
                            <a
                              href={r.audioLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-inter text-xs font-medium hover:bg-primary/20 transition-colors"
                            >
                              <Headphones className="w-3.5 h-3.5" />
                              Áudio
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {r.pdfLink && (
                            <a
                              href={r.pdfLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary font-inter text-xs font-medium hover:bg-secondary/20 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
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
