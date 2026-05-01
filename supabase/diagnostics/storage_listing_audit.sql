-- Auditoria de policies de listagem/leitura em Storage.
-- Rode no SQL Editor do Supabase depois de aplicar a migration de seguranca.

-- 1) Todas as policies SELECT em storage.objects.
SELECT
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- 2) Policies suspeitas: leitura baseada somente no bucket inteiro.
SELECT
  policyname,
  roles,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'SELECT'
  AND qual ~ 'bucket_id\s*=\s*''[^'']+'''
  AND qual !~* 'exists\s*\('
ORDER BY policyname;

-- Resultado esperado para a consulta 2: zero linhas.

-- 3) Buckets publicos. Buckets publicos ainda permitem acesso por URL conhecida;
-- as policies acima controlam a listagem via storage.objects.
SELECT
  id,
  name,
  public
FROM storage.buckets
ORDER BY id;
