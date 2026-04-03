// ─── Configuração central de Áreas e Comunidades ─────────────────────────────
// Edite APENAS este arquivo para adicionar/remover áreas ou comunidades.
// Todos os outros arquivos importam daqui.

export const AREA_COMMUNITIES: Record<string, string[]> = {
  "Área 1": ["Rincão Frente", "Rincão Fundo", "Bom Pastor", "Iriá Pira 1"],
  "Área 2": ["Martim Lutero", "Linha Brasil", "Iriá Pira 2"],
};

export const AREAS = Object.keys(AREA_COMMUNITIES);

export const ALL_COMMUNITIES = AREAS.flatMap(area => AREA_COMMUNITIES[area]);

/** Retorna a área correspondente à comunidade, ou a primeira área se não encontrada. */
export function getAreaForCommunity(community: string): string {
  for (const [area, communities] of Object.entries(AREA_COMMUNITIES)) {
    if (communities.includes(community)) return area;
  }
  return AREAS[0];
}

/** Retorna as comunidades de uma área (ou todas se a área não for encontrada). */
export function getCommunitiesForArea(area: string): string[] {
  return AREA_COMMUNITIES[area] ?? ALL_COMMUNITIES;
}
