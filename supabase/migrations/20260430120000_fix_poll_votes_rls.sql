-- =============================================================================
-- SEGURANÇA: Restringir poll_votes SELECT à comunidade do usuário
--
-- Problema: a política anterior era USING (true) — qualquer authenticated
-- via de todos os votos de qualquer comunidade (vazamento entre grupos).
-- =============================================================================

DROP POLICY IF EXISTS "Users can view poll votes" ON public.poll_votes;

-- Usuários veem votos de enquetes da sua própria comunidade/área
CREATE POLICY "Users can view poll votes in their community"
ON public.poll_votes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_id
      AND (
        p.community = (get_my_community())::text
        OR p.area    = (get_my_area())::text
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'lider'::app_role)
      )
  )
);
