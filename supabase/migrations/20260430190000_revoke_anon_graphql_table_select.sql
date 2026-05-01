-- =============================================================================
-- SEGURANCA: bloquear leitura anonima de tabelas/views pelo GraphQL/PostgREST
--
-- O Supabase Security Advisor/Database Linter sinaliza tabelas do schema public
-- expostas para a role anon quando ela possui SELECT. Mesmo com RLS, a camada
-- correta para dados privados do app e negar leitura anonima por privilegio SQL.
--
-- Usuarios logados continuam usando a role authenticated e as politicas RLS
-- existentes. Edge Functions com service_role tambem nao sao afetadas.
-- =============================================================================

-- Garante leitura explicita para usuarios logados antes de remover qualquer
-- privilegio herdado por PUBLIC. As politicas RLS continuam filtrando as linhas.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;

-- Remove SELECT anonimo de todas as tabelas, views e materialized views atuais.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Evita que novas tabelas/views criadas no schema public voltem a nascer com
-- leitura anonima via privilegios padrao.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT ON TABLES FROM PUBLIC;

-- A API GraphQL do Supabase usa o schema graphql. Se o projeto tiver a extensao
-- pg_graphql habilitada, anon nao deve conseguir resolver consultas ali.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = 'graphql'
  ) THEN
    REVOKE USAGE ON SCHEMA graphql FROM anon;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA graphql FROM anon;
  END IF;
END $$;

-- Auditoria rapida esperada apos aplicar:
-- SELECT table_schema, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'anon'
--   AND table_schema = 'public'
--   AND privilege_type = 'SELECT'
-- ORDER BY table_schema, table_name;
-- Resultado esperado: zero linhas.
