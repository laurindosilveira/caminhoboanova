import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type ConfigItem = {
  key: string;
  value: number;
  label: string;
  description: string;
};

const CONFIG_FIELDS: Omit<ConfigItem, "value">[] = [
  {
    key: "lesson_points",
    label: "Lição Estudada",
    description: "Pontos ao concluir o estudo semanal",
  },
  {
    key: "devotional_points",
    label: "Devocional (dia útil)",
    description: "Seg–Sex: pontos por devocional concluído",
  },
  {
    key: "devotional_weekend_points",
    label: "Devocional (fim de semana)",
    description: "Sáb–Dom: recuperação — pontos reduzidos",
  },
  {
    key: "attendance_points",
    label: "Presença em Encontro",
    description: "Pontos por presença confirmada no evento",
  },
  {
    key: "worship_points",
    label: "Culto Confirmado",
    description: "Pontos por culto aprovado pelo líder",
  },
  {
    key: "course_completion_bonus",
    label: "Bônus por Curso Completo",
    description: "Bônus ao completar todas as lições de um curso",
  },
  {
    key: "challenge_points",
    label: "Desafio Concluído",
    description: "Pontos por desafio da comunidade concluído",
  },
];

const DEFAULTS: Record<string, number> = {
  lesson_points: 20,
  devotional_points: 5,
  devotional_weekend_points: 2,
  attendance_points: 10,
  worship_points: 5,
  course_completion_bonus: 100,
  challenge_points: 15,
};

interface GameConfigDialogProps {
  onSaved?: () => void;
}

export default function GameConfigDialog({ onSaved }: GameConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data } = await supabase.rpc("get_game_config" as any);
      const map = new Map<string, number>((data ?? []).map((r: any) => [r.key, Number(r.value)]));
      setItems(CONFIG_FIELDS.map(f => ({
        ...f,
        value: map.has(f.key) ? (map.get(f.key) as number) : DEFAULTS[f.key],
      })));
    }
    load();
  }, [open]);

  function updateValue(key: string, raw: string) {
    const v = Math.max(0, Math.min(9999, parseInt(raw) || 0));
    setItems(prev => prev.map(i => i.key === key ? { ...i, value: v } : i));
  }

  async function handleSave() {
    setSaving(true);
    for (const item of items) {
      const { error } = await supabase.rpc("upsert_game_config_item" as any, {
        _key: item.key,
        _value: item.value,
      });
      if (error) {
        toast.error("Erro ao salvar configurações.", { description: error.message });
        setSaving(false);
        return;
      }
    }
    toast.success("Pontuações atualizadas!", {
      description: "Todos os rankings e cálculos já refletem os novos valores.",
      duration: 4000,
    });
    setOpen(false);
    setSaving(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-inter font-semibold hover:bg-primary/20 transition-colors"
          title="Configurar pontuação do game"
        >
          <Settings className="w-3.5 h-3.5" />
          Pontuação
        </button>
      </DialogTrigger>

      <DialogContent className="rounded-2xl max-w-sm max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-montserrat font-black text-lg">⚙️ Pontuação do Game</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground font-inter text-xs leading-relaxed">
          Alterar qualquer valor recalcula automaticamente <strong>todas</strong> as pontuações já geradas — passadas e futuras.
        </p>

        <div className="space-y-2 mt-1">
          {items.map(item => (
            <div key={item.key} className="bg-muted/40 rounded-xl px-3 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-foreground text-sm leading-tight">{item.label}</p>
                <p className="text-muted-foreground text-[10px] font-inter mt-0.5">{item.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  type="number"
                  min={0}
                  max={9999}
                  value={item.value}
                  onChange={e => updateValue(item.key, e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-montserrat font-black text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground font-inter text-xs">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-amber-700 dark:text-amber-400 font-inter text-[10px] leading-relaxed">
            ⚠️ Como a pontuação é calculada dinamicamente, qualquer alteração afeta o histórico inteiro de todos os participantes imediatamente.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="w-full mt-3 py-3 rounded-2xl font-montserrat font-black text-sm text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
