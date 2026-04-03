// ─── Configuração central de Tipos de Evento ─────────────────────────────────
// Edite APENAS este arquivo para adicionar/remover tipos de evento.

export type EventTypeConfig = {
  value: string;
  label: string;
  emoji: string;
  color: string;  // Tailwind class pair (bg + text)
};

export const EVENT_TYPES: EventTypeConfig[] = [
  { value: "encontro",      label: "Encontro",           emoji: "📅", color: "bg-primary/10 text-primary" },
  { value: "culto",         label: "Culto",              emoji: "⛪", color: "bg-brand-green/10 text-brand-green" },
  { value: "jemiac",        label: "JEMIAC",             emoji: "✝️", color: "bg-secondary/10 text-secondary" },
  { value: "retiro",        label: "Retiro",             emoji: "🏕️", color: "bg-secondary/10 text-secondary" },
  { value: "confirmatorio", label: "Ens. Confirmatório", emoji: "📖", color: "bg-primary/10 text-primary" },
  { value: "evento",        label: "Evento",             emoji: "🎉", color: "bg-accent/20 text-accent-foreground" },
];

/** Retorna o emoji de um tipo de evento (fallback: 📅) */
export function getEventEmoji(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.emoji ?? "📅";
}

/** Retorna a classe de cor de um tipo de evento (fallback: bg-muted text-muted-foreground) */
export function getEventColor(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.color ?? "bg-muted text-muted-foreground";
}

/** Retorna o label legível de um tipo de evento (fallback: tipo bruto) */
export function getEventLabel(type: string): string {
  return EVENT_TYPES.find(t => t.value === type)?.label ?? type;
}
