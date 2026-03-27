import React from "react";

// ─── Types ───────────────────────────────────────────────
export type Assessment = {
  id: string; month: number; year: number;
  prayer_score: number | null; presence_score: number | null;
  struggle_score: number | null; doubt_score: number | null;
  needs_pastor: boolean; notes: string | null;
};
export type Plan = {
  objectives: string | null; challenges: string | null;
  recommendations: string | null; next_steps: string | null;
  health_status: string;
};
export type Activity = { id: string; type: string; title: string; points: number };
export type Progress = { activity_id: string };
export type Lesson = { id: string; title: string; order_num: number; objective: string | null; topics: string[] | null; course_id: string };
export type Course = { id: string; order_num: number; title: string; subtitle: string | null; lessons: Lesson[] };
export type AttendanceRecord = { event_id: string; status: string };
export type EventRecord = { id: string; title: string; event_date: string; type: string };

// ─── Constants ───────────────────────────────────────────
export const EMOJIS = ["😔", "😐", "🙂", "😊", "🔥"];
export const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Compute health from scores ──────────────────────────
export function computeHealth(a: Assessment | null): string {
  if (!a) return "atencao";
  const pos = ((a.prayer_score ?? 3) + (a.presence_score ?? 3)) / 2;
  const neg = ((a.struggle_score ?? 3) + (a.doubt_score ?? 3)) / 2;
  const score = pos - (neg - 3) * 0.5;
  if (score >= 3.8) return "saudavel";
  if (score >= 2.5) return "atencao";
  return "critico";
}

// ─── Emoji scale ─────────────────────────────────────────
export function EmojiScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 justify-center">
      {EMOJIS.map((emoji, i) => (
        <button
          key={i}
          onClick={() => onChange(i + 1)}
          className={`text-2xl p-1.5 rounded-xl transition-all ${
            value === i + 1 ? "bg-primary/15 scale-125 ring-2 ring-primary" : "opacity-50 hover:opacity-80 hover:scale-110"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── Health status pill ──────────────────────────────────
export function HealthBadge({ status }: { status: string }) {
  const cfg = {
    saudavel: { label: "🟢 Saudável", bg: "bg-brand-green/10", text: "text-brand-green" },
    atencao:  { label: "🟡 Atenção", bg: "bg-accent/20", text: "text-accent-foreground" },
    critico:  { label: "🔴 Precisa de cuidado", bg: "bg-destructive/10", text: "text-destructive" },
  }[status] ?? { label: "🟡 Atenção", bg: "bg-accent/20", text: "text-accent-foreground" };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-inter font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ─── Section card ────────────────────────────────────────
export function SectionCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2.5 border-b border-border bg-muted/30">
        {icon}
        <p className="font-montserrat font-bold text-foreground text-sm">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────
export function ProgressRing({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}
