import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BookOpen, Link, Save, GraduationCap, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

import { AREAS, ALL_COMMUNITIES as COMMUNITIES } from "@/config/areas";

interface Settings {
  whatsapp_link: string;
  verse_of_week: string;
  verse_reference: string;
}

interface PastorSettings {
  pastor_name: string;
  phone: string;
}

export default function ClassroomSettingsTab() {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [selectedCommunity, setSelectedCommunity] = useState(COMMUNITIES[0]);
  const [settings, setSettings] = useState<Settings>({ whatsapp_link: "", verse_of_week: "", verse_reference: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pastor settings
  const [selectedArea, setSelectedArea] = useState(AREAS[0]);
  const [pastorSettings, setPastorSettings] = useState<PastorSettings>({ pastor_name: "", phone: "" });
  const [pastorLoading, setPastorLoading] = useState(false);
  const [pastorSaving, setPastorSaving] = useState(false);

  useEffect(() => {
    async function fetchPastor() {
      setPastorLoading(true);
      const { data } = await supabase
        .from("area_pastors")
        .select("pastor_name, phone")
        .eq("area", selectedArea)
        .maybeSingle();
      setPastorSettings({
        pastor_name: data?.pastor_name ?? "",
        phone: data?.phone ?? "",
      });
      setPastorLoading(false);
    }
    fetchPastor();
  }, [selectedArea]);

  async function handleSavePastor() {
    setPastorSaving(true);
    const { error } = await supabase
      .from("area_pastors")
      .upsert({
        area: selectedArea,
        pastor_name: pastorSettings.pastor_name || "",
        phone: pastorSettings.phone || "",
        updated_by: profile?.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "area" });
    setPastorSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Pastor atualizado!", description: `Contato do pastor da "${selectedArea}" salvo.` });
    }
  }

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const { data } = await supabase
        .from("community_settings")
        .select("whatsapp_link, verse_of_week, verse_reference")
        .eq("community", selectedCommunity)
        .maybeSingle();
      setSettings({
        whatsapp_link: data?.whatsapp_link ?? "",
        verse_of_week: data?.verse_of_week ?? "",
        verse_reference: data?.verse_reference ?? "",
      });
      setLoading(false);
    }
    fetchSettings();
  }, [selectedCommunity]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from("community_settings")
      .upsert({
        community: selectedCommunity,
        whatsapp_link: settings.whatsapp_link || null,
        verse_of_week: settings.verse_of_week || null,
        verse_reference: settings.verse_reference || null,
        updated_by: profile?.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "community" });

    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Configurações salvas!", description: `Sala da turma "${selectedCommunity}" atualizada.` });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-montserrat font-black text-foreground text-lg">Sala da Turma</h2>
          <p className="text-muted-foreground text-xs font-inter">Configure o versículo e o grupo por comunidade</p>
        </div>
      </div>

      {/* Seletor de comunidade */}
      <div>
        <label className="text-xs font-montserrat font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
          Comunidade
        </label>
        <div className="flex flex-wrap gap-2">
          {COMMUNITIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCommunity(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all border ${
                selectedCommunity === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Link do WhatsApp */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-primary" />
              <span className="font-montserrat font-bold text-foreground text-sm">Link do Grupo WhatsApp</span>
            </div>
            <Input
              placeholder="https://chat.whatsapp.com/..."
              value={settings.whatsapp_link}
              onChange={(e) => setSettings({ ...settings, whatsapp_link: e.target.value })}
              className="text-sm border-border rounded-xl"
            />
            <p className="text-xs text-muted-foreground font-inter">
              Cole o link de convite do grupo WhatsApp da turma de {selectedCommunity}.
            </p>
          </div>

          {/* Versículo da semana */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-montserrat font-bold text-foreground text-sm">Versículo da Semana</span>
            </div>
            <Textarea
              placeholder="Ex: Porque Deus amou o mundo de tal maneira..."
              value={settings.verse_of_week}
              onChange={(e) => setSettings({ ...settings, verse_of_week: e.target.value })}
              className="text-sm border-border rounded-xl resize-none min-h-[100px]"
              maxLength={500}
            />
            <Input
              placeholder="Referência (ex: João 3:16)"
              value={settings.verse_reference}
              onChange={(e) => setSettings({ ...settings, verse_reference: e.target.value })}
              className="text-sm border-border rounded-xl"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-2xl h-11 font-montserrat font-bold"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      )}

      {/* ===== PASTOR POR ÁREA ===== */}
      <div className="border-t border-border pt-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-montserrat font-black text-foreground text-lg">Pastor por Área</h2>
            <p className="text-muted-foreground text-xs font-inter">Contato que aparece no botão "Pedir ajuda" dos líderes</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-montserrat font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
            Área
          </label>
          <div className="flex gap-2">
            {AREAS.map((a) => (
              <button
                key={a}
                onClick={() => setSelectedArea(a)}
                className={`px-4 py-2 rounded-xl text-xs font-montserrat font-bold transition-all border ${
                  selectedArea === a
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {pastorLoading ? (
          <div className="bg-muted rounded-2xl h-24 animate-pulse" />
        ) : (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="font-montserrat font-bold text-foreground text-sm">Nome do Pastor</span>
            </div>
            <Input
              placeholder="Ex: Laurindo Silveira"
              value={pastorSettings.pastor_name}
              onChange={(e) => setPastorSettings({ ...pastorSettings, pastor_name: e.target.value })}
              className="text-sm border-border rounded-xl"
            />
            <div className="flex items-center gap-2 mt-2">
              <Phone className="w-4 h-4 text-primary" />
              <span className="font-montserrat font-bold text-foreground text-sm">Telefone (WhatsApp)</span>
            </div>
            <Input
              placeholder="Ex: 5598439-5290"
              value={pastorSettings.phone}
              onChange={(e) => setPastorSettings({ ...pastorSettings, phone: e.target.value })}
              className="text-sm border-border rounded-xl"
            />
            <p className="text-xs text-muted-foreground font-inter">
              Este número será usado no botão "Pedir ajuda ao Pastor" na área do líder.
            </p>
            <Button
              onClick={handleSavePastor}
              disabled={pastorSaving}
              className="w-full rounded-2xl h-11 font-montserrat font-bold"
            >
              <Save className="w-4 h-4 mr-2" />
              {pastorSaving ? "Salvando..." : "Salvar Pastor"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
