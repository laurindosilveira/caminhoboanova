export interface AutomatedSystemUpdate {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  version: string | null;
  updateType: "nova_funcionalidade" | "melhoria" | "correcao" | "comunicado";
  createdAt: string;
  authorName: string | null;
}

const BUILD_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
const BUILD_DATE = typeof __APP_BUILD_DATE__ === "string" ? __APP_BUILD_DATE__ : new Date().toISOString();

export const AUTOMATED_SYSTEM_UPDATES: AutomatedSystemUpdate[] = [
  {
    id: "build-current",
    title: "Build atual publicado automaticamente",
    summary: "A area do admin do sistema agora mostra a versao implantada sem depender de cadastro manual no app.",
    details:
      "Sempre que uma nova versao for publicada, o painel passa a refletir automaticamente a versao atual e a data do build. Assim, voce nao precisa mais abrir o formulario no app para introduzir as informacoes basicas da atualizacao.",
    version: `v${BUILD_VERSION}`,
    updateType: "comunicado",
    createdAt: BUILD_DATE,
    authorName: "Sistema",
  },
  {
    id: "2026-03-30-admin-password",
    title: "Protecao por senha no admin do sistema",
    summary: "O acesso a /admin-sistema foi simplificado para autenticacao por senha dentro da sessao atual do navegador.",
    details:
      "A area administrativa do sistema continua exigindo login no app, mas a liberacao adicional agora depende apenas da senha configurada para essa rota, sem depender de cadastro extra no banco.",
    version: null,
    updateType: "correcao",
    createdAt: "2026-03-30T11:30:00.000Z",
    authorName: "Equipe Caminho",
  },
  {
    id: "2026-03-30-admin-updates",
    title: "Historico de atualizacoes centralizado no painel",
    summary: "A aba de atualizacoes foi organizada para servir como referencia interna do que mudou no app.",
    details:
      "O painel agora apresenta uma visao geral das entregas e um historico visual padronizado, facilitando acompanhamento tecnico e comunicacao interna sobre novas versoes.",
    version: null,
    updateType: "melhoria",
    createdAt: "2026-03-30T11:20:00.000Z",
    authorName: "Equipe Caminho",
  },
].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
