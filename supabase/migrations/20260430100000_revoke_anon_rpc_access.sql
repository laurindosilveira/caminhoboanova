-- =============================================================================
-- SEGURANÇA: Revogar acesso anônimo a funções RPC sensíveis
--
-- Por padrão, CREATE FUNCTION concede EXECUTE a PUBLIC (inclui anon).
-- Funções SECURITY DEFINER com acesso a dados de usuários NÃO devem ser
-- executáveis sem autenticação — evita vazamento de dados e enumeração.
-- =============================================================================

-- has_role: permite descobrir se um UUID é admin/lider sem autenticação
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- is_super_admin: expõe informação sobre quem é super admin
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- get_my_area: retorna área do usuário atual (sem sentido para anon)
REVOKE EXECUTE ON FUNCTION public.get_my_area() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_area() TO authenticated;

-- get_my_community: retorna comunidade do usuário atual
REVOKE EXECUTE ON FUNCTION public.get_my_community() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_community() TO authenticated;

-- get_community_ranking: CRÍTICO — função SECURITY DEFINER que bypassa RLS
-- e retorna nomes e pontos de usuários. Anon NUNCA deve chamar.
REVOKE EXECUTE ON FUNCTION public.get_community_ranking(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_community_ranking(text) TO authenticated;

-- get_community_area: mapeamento puro (sem dados pessoais) — pode ficar público
-- mas deixamos apenas para authenticated por consistência
REVOKE EXECUTE ON FUNCTION public.get_community_area(community_name) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_community_area(community_name) TO authenticated;

-- handle_new_user_role: trigger interno, não deve ser chamado via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC;

-- handle_new_user: trigger interno
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- update_updated_at_column: trigger interno
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
