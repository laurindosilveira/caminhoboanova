-- =============================================================================
-- SEGURANÇA: Corrigir políticas de Storage
--
-- Problemas encontrados:
-- 1. challenge-files: SELECT era TO public — qualquer pessoa sem login acessava
-- 2. avatars: SELECT sem cláusula TO — aplicava também ao role anon
-- 3. event-photos INSERT: sem restrição de pasta por usuário (qualquer authenticated
--    pode fazer upload sem vínculo com seu UID)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CHALLENGE-FILES: trocar "TO public" por "TO authenticated"
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view challenge files" ON storage.objects;

CREATE POLICY "Authenticated users can view challenge files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'challenge-files');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AVATARS: restringir SELECT ao role authenticated
-- A política anterior não tinha cláusula TO (aplicava a anon + authenticated).
-- Avatares são imagens de perfil — legítimo exigir login para vê-los.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EVENT-PHOTOS: INSERT deve vincular pasta ao UID do uploader
-- A política anterior permitia upload em qualquer path (sem restrição de pasta).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload event photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload event photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CHAT-FILES: UPDATE estava sem restrição de dono do arquivo.
-- Adicionar check de pasta do usuário.
-- ─────────────────────────────────────────────────────────────────────────────
-- (a política de UPDATE não existia; adicionar agora para completude)
CREATE POLICY "Users can update own chat files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'chat-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
