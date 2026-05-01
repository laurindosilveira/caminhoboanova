-- Auditoria de exposicao anonima via GraphQL/PostgREST.
-- Rode no SQL Editor do Supabase depois de aplicar a migration de seguranca.

-- 1) Tabelas/views do schema public que ainda possuem SELECT para anon.
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND privilege_type = 'SELECT'
ORDER BY table_schema, table_name;

-- 2) Acesso anonimo ao schema GraphQL, quando pg_graphql estiver habilitado.
SELECT
  n.nspname AS schema_name,
  has_schema_privilege('anon', n.oid, 'USAGE') AS anon_has_usage
FROM pg_namespace n
WHERE n.nspname = 'graphql';

-- 3) Funcoes GraphQL ainda executaveis pela role anon.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'graphql'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY p.proname;
