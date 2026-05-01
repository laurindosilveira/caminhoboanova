-- =============================================================================
-- SEGURANCA: autorizacao server-side para /admin-sistema
--
-- Evita senha fixa no frontend e evita expor a lista authorized_system_admins.
-- A funcao retorna apenas booleano para o usuario autenticado atual.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_authorized_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.authorized_system_admins asa
    JOIN auth.users au ON lower(au.email) = lower(asa.email)
    WHERE au.id = auth.uid()
      AND asa.is_active = true
  )
  OR public.is_super_admin(auth.uid())
$$;

REVOKE EXECUTE ON FUNCTION public.is_authorized_system_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_system_admin() TO authenticated;
