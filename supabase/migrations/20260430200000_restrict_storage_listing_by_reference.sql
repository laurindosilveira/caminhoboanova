-- =============================================================================
-- SEGURANCA: restringir listagem de buckets por referencia de objeto
--
-- Policies antigas de SELECT em storage.objects liberavam bucket_id = '...'
-- para todos os usuarios autenticados. Isso permite listar o bucket inteiro.
-- As novas policies permitem ler/listar apenas objetos que estejam referenciados
-- por uma tabela do app e dentro do escopo do usuario atual.
-- =============================================================================

-- AVATARS ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can read referenced avatars" ON storage.objects;

CREATE POLICY "Users can read referenced avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.avatar_url IS NOT NULL
      AND p.avatar_url <> ''
      AND split_part(p.avatar_url, '?', 1) LIKE '%' || '/avatars/' || storage.objects.name
      AND (
        p.user_id = auth.uid()
        OR p.community = public.get_my_community()
        OR p.area = public.get_my_area()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'lider'::public.app_role)
        OR public.is_super_admin(auth.uid())
      )
  )
);

-- CHALLENGE FILES -------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view challenge files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view challenge files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read referenced challenge files" ON storage.objects;

CREATE POLICY "Users can read referenced challenge files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'challenge-files'
  AND EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    WHERE cp.file_url IS NOT NULL
      AND cp.file_url <> ''
      AND split_part(cp.file_url, '?', 1) LIKE '%' || '/challenge-files/' || storage.objects.name
      AND (
        cp.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'lider'::public.app_role)
        OR public.is_super_admin(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload challenge files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own challenge files" ON storage.objects;

CREATE POLICY "Authenticated users can upload own challenge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'challenge-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- CHAT FILES ------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read referenced chat files" ON storage.objects;

CREATE POLICY "Users can read referenced chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1
    FROM public.community_chat cc
    WHERE cc.file_url IS NOT NULL
      AND cc.file_url <> ''
      AND split_part(cc.file_url, '?', 1) LIKE '%' || '/chat-files/' || storage.objects.name
      AND (
        cc.user_id = auth.uid()
        OR cc.community = public.get_my_community()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'lider'::public.app_role)
        OR public.is_super_admin(auth.uid())
      )
  )
);

-- EVENT PHOTOS ----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view event photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read referenced event photos" ON storage.objects;

CREATE POLICY "Users can read referenced event photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1
    FROM public.event_photos ep
    WHERE ep.file_url IS NOT NULL
      AND ep.file_url <> ''
      AND split_part(ep.file_url, '?', 1) LIKE '%' || '/event-photos/' || storage.objects.name
      AND (
        ep.status = 'aprovado'
        OR ep.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'lider'::public.app_role)
        OR public.is_super_admin(auth.uid())
      )
  )
);

-- Auditoria esperada apos aplicar:
-- SELECT policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
--   AND cmd = 'SELECT'
--   AND qual LIKE '%bucket_id =%'
-- ORDER BY policyname;
--
-- Nenhuma policy SELECT deve ter somente "bucket_id = '<bucket>'" como filtro.
