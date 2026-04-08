// ─── Configuração de Áreas e Comunidades ──────────────────────────────────────
// Antes hardcoded como ENUMs, agora carregado do banco de dados.
// Use `useAreasConfig()` em componentes React para dados atualizados.
// Os valores abaixo são fallback estático (bootstrap) — serão substituídos
// pelos dados do banco assim que o hook carregar.

import { supabase } from "@/integrations/supabase/client";

// ── Fallback estático (mantém compatibilidade com código existente) ────────────
export const AREA_COMMUNITIES: Record<string, string[]> = {
  "Área 1": ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"],
  "Área 2": ["Martim Lutero", "Linha Brasil", "Iriá Pira 2"],
};

export const AREAS = Object.keys(AREA_COMMUNITIES);
export const ALL_COMMUNITIES = AREAS.flatMap(area => AREA_COMMUNITIES[area]);

export function getAreaForCommunity(community: string): string {
  for (const [area, communities] of Object.entries(AREA_COMMUNITIES)) {
    if (communities.includes(community)) return area;
  }
  return AREAS[0];
}

export function getCommunitiesForArea(area: string): string[] {
  return AREA_COMMUNITIES[area] ?? ALL_COMMUNITIES;
}

// ── Tipos para dados do banco ─────────────────────────────────────────────────
export type AreaRow = { id: string; name: string; description: string | null };
export type CommunityRow = { id: string; name: string; area_id: string };

// ── Carregamento assíncrono do banco ──────────────────────────────────────────
export async function fetchAreasConfig(): Promise<{
  areas: AreaRow[];
  communities: CommunityRow[];
  areaCommunities: Record<string, string[]>;
}> {
  const [{ data: areasData }, { data: communitiesData }] = await Promise.all([
    supabase.from("areas").select("id, name, description").order("name"),
    supabase.from("communities").select("id, name, area_id").order("name"),
  ]);

  const areas = areasData ?? [];
  const communities = communitiesData ?? [];

  const areaCommunities: Record<string, string[]> = {};
  for (const area of areas) {
    areaCommunities[area.name] = communities
      .filter(c => c.area_id === area.id)
      .map(c => c.name);
  }

  return { areas, communities, areaCommunities };
}
