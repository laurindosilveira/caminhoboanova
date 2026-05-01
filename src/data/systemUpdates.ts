export interface AutomatedSystemUpdate {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  version: string | null;
  updateType: "nova_funcionalidade" | "melhoria" | "correcao" | "comunicado";
  createdAt: string;
  authorName: string | null;
  codeChanges: Array<{
    area: string;
    description: string;
  }>;
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
    codeChanges: [
      {
        area: "vite.config.ts",
        description: "Injeta automaticamente a versao do package.json e a data do build no frontend.",
      },
      {
        area: "src/data/systemUpdates.ts",
        description: "Mantem o historico exibido no admin do sistema como fonte versionada dentro do projeto.",
      },
      {
        area: "src/pages/AdminSistema.tsx",
        description: "Exibe a versao atual e o historico automatico sem depender de formulario manual.",
      },
    ],
  },
  {
    id: "2026-03-30-admin-password",
    title: "Protecao por autorizacao no admin do sistema",
    summary: "O acesso a /admin-sistema e validado por permissao registrada no Supabase, sem senha fixa no frontend.",
    details:
      "A area administrativa do sistema continua exigindo login no app, mas a liberacao adicional agora depende da lista segura de administradores autorizados no banco.",
    version: null,
    updateType: "correcao",
    createdAt: "2026-03-30T11:30:00.000Z",
    authorName: "Equipe Caminho",
    codeChanges: [
      {
        area: "src/components/auth/AdminSistemaPasswordGate.tsx",
        description: "Removeu a senha fixa e passou a validar autorizacao real no Supabase.",
      },
      {
        area: "src/pages/AdminSistema.tsx",
        description: "Reforcou o bloqueio interno para buscar dados apenas apos confirmar permissao de admin do sistema.",
      },
    ],
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
    codeChanges: [
      {
        area: "src/pages/AdminSistema.tsx",
        description: "Criou a aba de atualizacoes dentro do admin do sistema com cards e visao geral.",
      },
      {
        area: "supabase/migrations/20260330114330_create_system_update_log.sql",
        description: "Preparou a estrutura de log de atualizacoes no Supabase para o modelo inicial da area.",
      },
      {
        area: "supabase/migrations/20260330114609_create_authorized_system_admins.sql",
        description: "Preparou a tabela de administradores autorizados do sistema para a primeira versao da seguranca.",
      },
    ],
  },
].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
