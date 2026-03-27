import { Heart, AlertCircle, Send, CalendarDays } from "lucide-react";
import { SectionCard, EmojiScale, EMOJIS, MONTH_NAMES, MONTH_SHORT, computeHealth, type Assessment } from "./shared";

type FormState = {
  prayer_score: number | null;
  presence_score: number | null;
  struggle_score: number | null;
  doubt_score: number | null;
  needs_pastor: boolean;
  notes: string;
};

type Props = {
  assessment: Assessment | null;
  showAssessment: boolean;
  setShowAssessment: (v: boolean) => void;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
  month: number;
  allAssessments: Assessment[];
};

export default function AssessmentSection({
  assessment, showAssessment, setShowAssessment,
  form, setForm, saving, onSave, month, allAssessments,
}: Props) {
  return (
    <>
      {/* ── AUTOAVALIAÇÃO ── */}
      <SectionCard icon={<Heart className="w-4 h-4 text-primary" />} title={`Autoavaliação — ${MONTH_NAMES[month - 1]}`}>
        {assessment && !showAssessment ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-muted-foreground font-inter text-xs">Vida de oração</span>
              <span className="text-xl">{EMOJIS[(assessment.prayer_score ?? 3) - 1]}</span>
            </div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-muted-foreground font-inter text-xs">Sentir Deus perto</span>
              <span className="text-xl">{EMOJIS[(assessment.presence_score ?? 3) - 1]}</span>
            </div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-muted-foreground font-inter text-xs">Tentações / dificuldades</span>
              <span className="text-xl">{EMOJIS[(assessment.struggle_score ?? 3) - 1]}</span>
            </div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-muted-foreground font-inter text-xs">Dúvidas na fé</span>
              <span className="text-xl">{EMOJIS[(assessment.doubt_score ?? 3) - 1]}</span>
            </div>
            {assessment.needs_pastor && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-primary/10 rounded-xl">
                <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="font-inter text-xs text-primary">Solicitou conversa com o pastor</p>
              </div>
            )}
            {assessment.notes && (
              <p className="font-inter text-xs text-muted-foreground italic mt-1">"{assessment.notes}"</p>
            )}
            <button onClick={() => setShowAssessment(true)} className="w-full mt-2 py-2 rounded-xl bg-muted text-muted-foreground font-inter text-xs font-medium">
              Atualizar avaliação
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-inter text-sm text-foreground mb-2">Como está sua vida de oração?</p>
              <EmojiScale value={form.prayer_score} onChange={v => setForm(f => ({ ...f, prayer_score: v }))} />
            </div>
            <div>
              <p className="font-inter text-sm text-foreground mb-2">Você sente Deus perto de você?</p>
              <EmojiScale value={form.presence_score} onChange={v => setForm(f => ({ ...f, presence_score: v }))} />
            </div>
            <div>
              <p className="font-inter text-sm text-foreground mb-2">Está enfrentando tentações ou dificuldades?</p>
              <EmojiScale value={form.struggle_score} onChange={v => setForm(f => ({ ...f, struggle_score: v }))} />
            </div>
            <div>
              <p className="font-inter text-sm text-foreground mb-2">Tem dúvidas sobre a fé?</p>
              <EmojiScale value={form.doubt_score} onChange={v => setForm(f => ({ ...f, doubt_score: v }))} />
            </div>
            <div>
              <p className="font-inter text-sm text-foreground mb-2">Uma palavra sobre sua semana (opcional):</p>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Como você está se sentindo..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.needs_pastor} onChange={e => setForm(f => ({ ...f, needs_pastor: e.target.checked }))}
                className="w-4 h-4 rounded border-border accent-primary" />
              <span className="font-inter text-sm text-foreground">Preciso conversar com o pastor 🙏</span>
            </label>
            <button onClick={onSave} disabled={saving || !form.prayer_score || !form.presence_score || !form.struggle_score || !form.doubt_score}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-inter text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}>
              <Send className="w-4 h-4" /> {saving ? "Salvando..." : "Enviar avaliação"}
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── EVOLUÇÃO MENSAL ── */}
      {allAssessments.length > 1 && (
        <SectionCard icon={<CalendarDays className="w-4 h-4 text-primary" />} title="Evolução Espiritual">
          <div className="space-y-3">
            <div className="flex items-end gap-1.5 justify-center h-28">
              {allAssessments.slice(-6).map((a) => {
                const avg = (
                  (a.prayer_score ?? 3) +
                  (a.presence_score ?? 3) +
                  (5 - (a.struggle_score ?? 3)) +
                  (5 - (a.doubt_score ?? 3))
                ) / 4;
                const pctH = Math.round((avg / 5) * 100);
                const health = computeHealth(a);
                const color = health === "saudavel" ? "var(--gradient-green)" : health === "atencao" ? "var(--gradient-orange)" : "hsl(var(--destructive))";
                return (
                  <div key={`${a.year}-${a.month}`} className="flex flex-col items-center gap-1 flex-1 max-w-[48px]">
                    <div
                      className="w-full rounded-t-lg transition-all min-h-[8px]"
                      style={{ height: `${pctH}%`, background: color }}
                    />
                    <span className="text-[9px] font-inter text-muted-foreground leading-none">
                      {MONTH_SHORT[a.month - 1]}
                    </span>
                    <span className="text-[9px] font-montserrat font-bold text-foreground leading-none">
                      {avg.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-muted-foreground font-inter text-[10px]">
              Média geral dos últimos {Math.min(allAssessments.length, 6)} meses (1–5)
            </p>

            <div className="space-y-2 mt-2">
              {allAssessments.slice(-6).reverse().map((a) => {
                const health = computeHealth(a);
                return (
                  <div key={`detail-${a.year}-${a.month}`} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-muted/30">
                    <span className="font-inter text-xs text-muted-foreground w-16 flex-shrink-0">
                      {MONTH_SHORT[a.month - 1]}/{a.year}
                    </span>
                    <div className="flex gap-1.5 flex-1 justify-center">
                      <span title="Oração" className="text-sm">{EMOJIS[(a.prayer_score ?? 3) - 1]}</span>
                      <span title="Presença de Deus" className="text-sm">{EMOJIS[(a.presence_score ?? 3) - 1]}</span>
                      <span title="Tentações" className="text-sm">{EMOJIS[(a.struggle_score ?? 3) - 1]}</span>
                      <span title="Dúvidas" className="text-sm">{EMOJIS[(a.doubt_score ?? 3) - 1]}</span>
                    </div>
                    <span className={`text-[10px] font-inter font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      health === "saudavel" ? "text-brand-green bg-brand-green/10" :
                      health === "critico" ? "text-destructive bg-destructive/10" :
                      "text-accent-foreground bg-accent/20"
                    }`}>
                      {health === "saudavel" ? "🟢" : health === "critico" ? "🔴" : "🟡"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}
    </>
  );
}
