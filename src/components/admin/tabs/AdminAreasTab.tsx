import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MapPin, Users, Plus, Edit3, Trash2, ChevronDown, ChevronRight, X, Check } from "lucide-react";

type AreaRow = {
  id: string;
  name: string;
  description: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  area_id: string;
};

type FormState = { name: string; description: string };

export default function AdminAreasTab() {
  const { isSuper } = useAuth();
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);

  // Area form
  const [areaForm, setAreaForm] = useState<FormState>({ name: "", description: "" });
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [savingArea, setSavingArea] = useState(false);

  // Community form
  const [communityForm, setCommunityForm] = useState<{ name: string; area_id: string }>({ name: "", area_id: "" });
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
  const [showCommunityFormFor, setShowCommunityFormFor] = useState<string | null>(null);
  const [savingCommunity, setSavingCommunity] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: areasData, error: areasErr }, { data: commData, error: commErr }] = await Promise.all([
      supabase.from("areas").select("id, name, description").order("name"),
      supabase.from("communities").select("id, name, area_id").order("name"),
    ]);
    if (areasErr) setError(`Erro ao carregar áreas: ${areasErr.message}`);
    if (commErr) setError(`Erro ao carregar comunidades: ${commErr.message}`);
    setAreas((areasData ?? []) as AreaRow[]);
    setCommunities((commData ?? []) as CommunityRow[]);
    if (areasData && areasData.length > 0 && !expandedArea) {
      setExpandedArea(areasData[0].id);
    }
    setLoading(false);
  }

  // ── Area CRUD ────────────────────────────────────────────────────────────────

  function openNewAreaForm() {
    setEditingAreaId(null);
    setAreaForm({ name: "", description: "" });
    setShowAreaForm(true);
    setError(null);
  }

  function openEditAreaForm(area: AreaRow) {
    setEditingAreaId(area.id);
    setAreaForm({ name: area.name, description: area.description ?? "" });
    setShowAreaForm(true);
    setError(null);
  }

  async function saveArea() {
    if (!areaForm.name.trim()) { setError("Nome da área é obrigatório."); return; }
    setSavingArea(true);
    setError(null);
    const { error: e } = editingAreaId
      ? await supabase.from("areas").update({ name: areaForm.name.trim(), description: areaForm.description.trim() || null }).eq("id", editingAreaId)
      : await supabase.from("areas").insert({ name: areaForm.name.trim(), description: areaForm.description.trim() || null });
    if (e) { setError(e.message); setSavingArea(false); return; }
    setSavingArea(false);
    setShowAreaForm(false);
    setEditingAreaId(null);
    fetchData();
  }

  async function deleteArea(id: string) {
    const commCount = communities.filter(c => c.area_id === id).length;
    if (commCount > 0) {
      setError(`Não é possível excluir: esta área possui ${commCount} comunidade${commCount > 1 ? "s" : ""}. Remova-as primeiro.`);
      return;
    }
    const { error: e } = await supabase.from("areas").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    fetchData();
  }

  // ── Community CRUD ───────────────────────────────────────────────────────────

  function openNewCommunityForm(areaId: string) {
    setEditingCommunityId(null);
    setCommunityForm({ name: "", area_id: areaId });
    setShowCommunityFormFor(areaId);
    setError(null);
  }

  function openEditCommunityForm(comm: CommunityRow) {
    setEditingCommunityId(comm.id);
    setCommunityForm({ name: comm.name, area_id: comm.area_id });
    setShowCommunityFormFor(comm.area_id);
    setError(null);
  }

  function cancelCommunityForm() {
    setShowCommunityFormFor(null);
    setEditingCommunityId(null);
  }

  async function saveCommunity() {
    if (!communityForm.name.trim()) { setError("Nome da comunidade é obrigatório."); return; }
    setSavingCommunity(true);
    setError(null);
    const { error: e } = editingCommunityId
      ? await supabase.from("communities").update({ name: communityForm.name.trim(), area_id: communityForm.area_id }).eq("id", editingCommunityId)
      : await supabase.from("communities").insert({ name: communityForm.name.trim(), area_id: communityForm.area_id });
    if (e) { setError(e.message); setSavingCommunity(false); return; }
    setSavingCommunity(false);
    setShowCommunityFormFor(null);
    setEditingCommunityId(null);
    fetchData();
  }

  async function deleteCommunity(id: string) {
    const { error: e } = await supabase.from("communities").delete().eq("id", id);
    if (e) { setError(e.message); return; }
    fetchData();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
          <MapPin className="w-6 h-6 text-primary" />
        </div>
        <p className="text-muted-foreground font-inter text-sm">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-primary/10 rounded-2xl p-4 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-montserrat font-bold text-foreground text-sm">Áreas e Comunidades</p>
          <p className="text-muted-foreground font-inter text-xs mt-0.5">
            {areas.length} área{areas.length !== 1 ? "s" : ""} · {communities.length} comunidade{communities.length !== 1 ? "s" : ""}
          </p>
          <p className="text-muted-foreground font-inter text-[10px] mt-1">
            Configure a estrutura geográfica da sua igreja. Novos membros serão vinculados a estas áreas e comunidades.
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
          <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="font-inter text-xs text-destructive">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-destructive/60 hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Area form (new/edit) */}
      {showAreaForm && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
          <p className="font-montserrat font-bold text-foreground text-sm">
            {editingAreaId ? "Editar Área" : "Nova Área"}
          </p>
          <input
            type="text"
            placeholder="Nome da área (ex: Área Norte)"
            value={areaForm.name}
            onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-inter"
          />
          <input
            type="text"
            placeholder="Descrição (opcional)"
            value={areaForm.description}
            onChange={e => setAreaForm(f => ({ ...f, description: e.target.value }))}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-inter"
          />
          <div className="flex gap-2">
            <button
              onClick={saveArea}
              disabled={savingArea}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-inter text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {savingArea ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => { setShowAreaForm(false); setEditingAreaId(null); }}
              className="h-10 px-4 rounded-xl border border-border text-muted-foreground font-inter text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Areas list */}
      {areas.map(area => {
        const areaComms = communities.filter(c => c.area_id === area.id);
        const isOpen = expandedArea === area.id;
        const isAddingComm = showCommunityFormFor === area.id && !editingCommunityId;

        return (
          <div key={area.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Area header */}
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => setExpandedArea(isOpen ? null : area.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-montserrat font-bold text-foreground text-sm">{area.name}</p>
                  {area.description && (
                    <p className="text-muted-foreground font-inter text-xs truncate">{area.description}</p>
                  )}
                  <p className="text-muted-foreground font-inter text-[10px]">
                    {areaComms.length} comunidade{areaComms.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
              </button>
              <button
                onClick={() => openEditAreaForm(area)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {isSuper && (
                <button
                  onClick={() => deleteArea(area.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Communities list */}
            {isOpen && (
              <div className="border-t border-border">
                {areaComms.map(comm => {
                  const isEditingThis = editingCommunityId === comm.id && showCommunityFormFor === comm.area_id;

                  if (isEditingThis) {
                    return (
                      <div key={comm.id} className="border-b border-border last:border-b-0 p-3 space-y-2">
                        <input
                          type="text"
                          value={communityForm.name}
                          onChange={e => setCommunityForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-inter"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveCommunity}
                            disabled={savingCommunity}
                            className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground font-inter text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {savingCommunity ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            onClick={cancelCommunityForm}
                            className="h-8 px-3 rounded-lg border border-border text-muted-foreground font-inter text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={comm.id} className="border-b border-border last:border-b-0 flex items-center gap-3 px-4 py-2.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <p className="flex-1 font-inter text-sm text-foreground">{comm.name}</p>
                      <button
                        onClick={() => openEditCommunityForm(comm)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-secondary hover:bg-secondary/10 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {isSuper && (
                        <button
                          onClick={() => deleteCommunity(comm.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Inline community form */}
                {isAddingComm ? (
                  <div className="p-3 space-y-2 bg-primary/5 border-t border-primary/20">
                    <input
                      type="text"
                      placeholder="Nome da comunidade"
                      value={communityForm.name}
                      onChange={e => setCommunityForm(f => ({ ...f, name: e.target.value }))}
                      autoFocus
                      className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-inter"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveCommunity}
                        disabled={savingCommunity}
                        className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground font-inter text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {savingCommunity ? "Salvando..." : "Adicionar"}
                      </button>
                      <button
                        onClick={cancelCommunityForm}
                        className="h-8 px-3 rounded-lg border border-border text-muted-foreground font-inter text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openNewCommunityForm(area.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="font-inter text-xs font-medium">Adicionar comunidade</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add area button */}
      {!showAreaForm && (
        <button
          onClick={openNewAreaForm}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="font-inter text-sm font-medium">Adicionar nova área</span>
        </button>
      )}
    </div>
  );
}
