import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Plus, Trash2, Save, X, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DEFAULT_ACHIEVEMENT_DEFS } from "./AchievementsGrid";

export type AchievementDef = {
  id: string;
  key: string;
  icon: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  bonus_points: number;
  is_secret: boolean;
  is_active: boolean;
  sort_order: number;
};

export const METRIC_OPTIONS = [
  { value: "streak_days",      label: "Dias seguidos (streak)" },
  { value: "completed_count",  label: "Atividades concluídas" },
  { value: "faith_points",     label: "Pontos de fé" },
  { value: "dev_count",        label: "Devocionais completos" },
  { value: "attendance_count", label: "Presenças em encontros" },
  { value: "worship_count",    label: "Cultos confirmados" },
  { value: "chat_count",       label: "Mensagens no chat" },
  { value: "prayer_count",     label: "Pedidos de oração" },
  { value: "is_apto",          label: "Pastor marcou como Apto (0/1)" },
  { value: "biweekly_streak",  label: "Quinzena perfeita completa (0/1)" },
];

const EMPTY_FORM: Omit<AchievementDef, "id" | "sort_order" | "created_at"> = {
  key: "",
  icon: "🏆",
  title: "",
  description: "",
  metric: "completed_count",
  target: 1,
  bonus_points: 10,
  is_secret: false,
  is_active: true,
};

interface Props {
  onSaved?: () => void;
}

export default function AchievementsConfigDialog({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [defs, setDefs] = useState<AchievementDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AchievementDef>>({});

  useEffect(() => {
    if (!open) return;
    loadDefs();
  }, [open]);

  async function loadDefs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("achievement_definitions" as any)
      .select("*")
      .order("sort_order");

    const rows = (data as AchievementDef[]) ?? [];

    if ((error || rows.length === 0) && !error) {
      // Table exists but is empty — seed with defaults so the user can edit them
      const seedRows = DEFAULT_ACHIEVEMENT_DEFS.map(({ id: _id, ...rest }) => rest);
      const { data: seeded } = await supabase
        .from("achievement_definitions" as any)
        .insert(seedRows)
        .select("*");
      setDefs((seeded as AchievementDef[]) ?? DEFAULT_ACHIEVEMENT_DEFS);
    } else if (error) {
      // Table may not exist yet — show defaults as read-only preview
      setDefs(DEFAULT_ACHIEVEMENT_DEFS);
    } else {
      setDefs(rows);
    }

    setLoading(false);
  }

  async function handleAdd() {
    if (!newForm.key.trim()) { toast.error("Informe uma chave única para a conquista."); return; }
    if (!newForm.title.trim()) { toast.error("Informe o título da conquista."); return; }
    const keyClean = newForm.key.trim().replace(/\s+/g, "_").toLowerCase();

    setSaving("new");
    const maxOrder = defs.length > 0 ? Math.max(...defs.map(d => d.sort_order)) : 0;
    const { error } = await supabase
      .from("achievement_definitions" as any)
      .insert({ ...newForm, key: keyClean, sort_order: maxOrder + 1 });

    if (error) {
      toast.error("Erro ao criar conquista.", { description: error.message });
    } else {
      toast.success("Conquista criada!");
      setNewForm({ ...EMPTY_FORM });
      setShowAddForm(false);
      await loadDefs();
      onSaved?.();
    }
    setSaving(null);
  }

  async function handleSaveEdit(id: string) {
    setSaving(id);
    const { error } = await supabase
      .from("achievement_definitions" as any)
      .update({ ...editForm, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao salvar conquista.", { description: error.message });
    } else {
      toast.success("Conquista atualizada!");
      setEditingId(null);
      setEditForm({});
      await loadDefs();
      onSaved?.();
    }
    setSaving(null);
  }

  async function handleDelete(def: AchievementDef) {
    if (!confirm(`Remover conquista "${def.title}"?\n\nIsso não apagará conquistas já desbloqueadas pelos participantes.`)) return;
    setDeleting(def.id);
    const { error } = await supabase
      .from("achievement_definitions" as any)
      .delete()
      .eq("id", def.id);

    if (error) {
      toast.error("Erro ao remover.", { description: error.message });
    } else {
      toast.success("Conquista removida.");
      await loadDefs();
      onSaved?.();
    }
    setDeleting(null);
  }

  function startEdit(def: AchievementDef) {
    setEditingId(def.id);
    setEditForm({
      icon: def.icon,
      title: def.title,
      description: def.description,
      metric: def.metric,
      target: def.target,
      bonus_points: def.bonus_points,
      is_secret: def.is_secret,
      is_active: def.is_active,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-inter font-semibold hover:bg-amber-500/20 transition-colors"
          title="Configurar conquistas"
        >
          <Trophy className="w-3.5 h-3.5" />
          Conquistas
        </button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-montserrat font-black text-lg">🏆 Gerenciar Conquistas</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground font-inter text-xs leading-relaxed mb-3">
          Edite títulos, ícones, metas e pontos de bônus de cada conquista. As alterações refletem imediatamente para todos os participantes.
        </p>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {defs.map(def => {
              const isEditing = editingId === def.id;
              return (
                <div key={def.id} className={`rounded-xl border ${def.is_active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"}`}>
                  {isEditing ? (
                    <div className="p-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={editForm.icon ?? ""}
                          onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))}
                          className="w-14 px-2 py-1.5 rounded-lg border border-border bg-background text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="🏆"
                        />
                        <input
                          value={editForm.title ?? ""}
                          onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Título da conquista"
                        />
                      </div>
                      <input
                        value={editForm.description ?? ""}
                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Descrição"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] font-inter text-muted-foreground mb-1">Métrica</p>
                          <select
                            value={editForm.metric ?? "completed_count"}
                            onChange={e => setEditForm(p => ({ ...p, metric: e.target.value }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="w-20">
                          <p className="text-[10px] font-inter text-muted-foreground mb-1">Meta</p>
                          <input
                            type="number" min={1} max={99999}
                            value={editForm.target ?? 1}
                            onChange={e => setEditForm(p => ({ ...p, target: parseInt(e.target.value) || 1 }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="w-20">
                          <p className="text-[10px] font-inter text-muted-foreground mb-1">Bônus pts</p>
                          <input
                            type="number" min={0} max={9999}
                            value={editForm.bonus_points ?? 10}
                            onChange={e => setEditForm(p => ({ ...p, bonus_points: parseInt(e.target.value) || 0 }))}
                            className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.is_secret ?? false}
                            onChange={e => setEditForm(p => ({ ...p, is_secret: e.target.checked }))}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="font-inter text-xs text-foreground">Secreta</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.is_active ?? true}
                            onChange={e => setEditForm(p => ({ ...p, is_active: e.target.checked }))}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="font-inter text-xs text-foreground">Ativa</span>
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(def.id)}
                          disabled={saving === def.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-inter font-semibold text-primary-foreground disabled:opacity-50"
                          style={{ background: "var(--gradient-hero)" }}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {saving === def.id ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditForm({}); }}
                          className="px-4 py-2 rounded-xl bg-muted text-foreground font-inter text-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xl flex-shrink-0">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-inter font-semibold text-foreground text-sm">{def.title}</p>
                          {def.is_secret && <span className="text-[9px] font-inter bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">secreta</span>}
                          {!def.is_active && <span className="text-[9px] font-inter bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">inativa</span>}
                        </div>
                        <p className="text-muted-foreground text-[10px] font-inter">
                          {METRIC_OPTIONS.find(o => o.value === def.metric)?.label ?? def.metric} ≥ {def.target} · +{def.bonus_points} pts
                        </p>
                      </div>
                      <button
                        onClick={() => startEdit(def)}
                        className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-foreground font-inter text-[10px] font-semibold transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(def)}
                        disabled={deleting === def.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add new achievement */}
        {showAddForm ? (
          <div className="mt-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-3">
            <p className="font-montserrat font-bold text-foreground text-sm">Nova conquista</p>
            <div className="flex gap-2">
              <input
                value={newForm.icon}
                onChange={e => setNewForm(p => ({ ...p, icon: e.target.value }))}
                className="w-14 px-2 py-1.5 rounded-lg border border-border bg-background text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="🏆"
              />
              <input
                value={newForm.title}
                onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))}
                className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Título"
              />
            </div>
            <input
              value={newForm.key}
              onChange={e => setNewForm(p => ({ ...p, key: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Chave única (ex: super_heroi) — não pode repetir"
            />
            <input
              value={newForm.description}
              onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Descrição"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-[10px] font-inter text-muted-foreground mb-1">Métrica</p>
                <select
                  value={newForm.metric}
                  onChange={e => setNewForm(p => ({ ...p, metric: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="w-20">
                <p className="text-[10px] font-inter text-muted-foreground mb-1">Meta</p>
                <input
                  type="number" min={1} max={99999}
                  value={newForm.target}
                  onChange={e => setNewForm(p => ({ ...p, target: parseInt(e.target.value) || 1 }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="w-20">
                <p className="text-[10px] font-inter text-muted-foreground mb-1">Bônus pts</p>
                <input
                  type="number" min={0} max={9999}
                  value={newForm.bonus_points}
                  onChange={e => setNewForm(p => ({ ...p, bonus_points: parseInt(e.target.value) || 0 }))}
                  className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-inter text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.is_secret}
                  onChange={e => setNewForm(p => ({ ...p, is_secret: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="font-inter text-xs text-foreground">Secreta</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving === "new"}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-inter font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Save className="w-4 h-4" />
                {saving === "new" ? "Criando..." : "Criar conquista"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewForm({ ...EMPTY_FORM }); }}
                className="px-4 py-2 rounded-xl bg-muted text-foreground font-inter text-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary font-inter text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar conquista
          </button>
        )}

        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-700 dark:text-amber-400 font-inter text-[10px] leading-relaxed">
            ⚠️ Remover uma conquista não apaga o histórico de desbloqueios dos participantes — apenas a remove da tela de conquistas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
