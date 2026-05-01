-- Auditoria de integridade: respostas de devocionais e lições
-- Rode no SQL Editor do Supabase.

-- 1) Devocionais concluídos sem nenhuma resposta registrada
SELECT
  p.user_id,
  pr.full_name,
  pr.area,
  p.devotional_id,
  dc.title AS devotional_title,
  dc.lesson_id,
  l.title AS lesson_title,
  p.completed_at,
  COALESCE(resp.answer_count, 0) AS answer_count,
  COALESCE(card.expected_count, 0) AS expected_count
FROM devotional_progress p
LEFT JOIN profiles pr ON pr.user_id = p.user_id
LEFT JOIN devotional_content dc ON dc.id = p.devotional_id
LEFT JOIN lessons l ON l.id = dc.lesson_id
LEFT JOIN (
  SELECT user_id, devotional_id, COUNT(*) AS answer_count
  FROM devotional_responses
  WHERE BTRIM(response) <> ''
  GROUP BY user_id, devotional_id
) resp
  ON resp.user_id = p.user_id
 AND resp.devotional_id = p.devotional_id
LEFT JOIN (
  SELECT
    id AS devotional_id,
    COALESCE(ARRAY_LENGTH(questions, 1), 0) AS expected_count
  FROM devotional_content
) card
  ON card.devotional_id = p.devotional_id
WHERE COALESCE(resp.answer_count, 0) = 0
ORDER BY p.completed_at DESC;

-- 2) Devocionais concluídos com respostas incompletas
SELECT
  p.user_id,
  pr.full_name,
  pr.area,
  p.devotional_id,
  dc.title AS devotional_title,
  p.completed_at,
  COALESCE(resp.answer_count, 0) AS answered_count,
  COALESCE(card.expected_count, 0) AS expected_count
FROM devotional_progress p
LEFT JOIN profiles pr ON pr.user_id = p.user_id
LEFT JOIN devotional_content dc ON dc.id = p.devotional_id
LEFT JOIN (
  SELECT user_id, devotional_id, COUNT(*) AS answer_count
  FROM devotional_responses
  WHERE BTRIM(response) <> ''
  GROUP BY user_id, devotional_id
) resp
  ON resp.user_id = p.user_id
 AND resp.devotional_id = p.devotional_id
LEFT JOIN (
  SELECT
    id AS devotional_id,
    COALESCE(ARRAY_LENGTH(questions, 1), 0) AS expected_count
  FROM devotional_content
) card
  ON card.devotional_id = p.devotional_id
WHERE COALESCE(card.expected_count, 0) > 0
  AND COALESCE(resp.answer_count, 0) < COALESCE(card.expected_count, 0)
ORDER BY p.completed_at DESC;

-- 3) Linhas de respostas de devocional vazias
SELECT
  dr.user_id,
  pr.full_name,
  pr.area,
  dr.devotional_id,
  dc.title AS devotional_title,
  dr.question_index,
  dr.created_at,
  dr.updated_at
FROM devotional_responses dr
LEFT JOIN profiles pr ON pr.user_id = dr.user_id
LEFT JOIN devotional_content dc ON dc.id = dr.devotional_id
WHERE BTRIM(dr.response) = ''
ORDER BY dr.updated_at DESC;

-- 4) Lições com respostas faltando em relação ao conteúdo esperado
WITH expected_lesson_keys AS (
  SELECT
    l.id AS lesson_id,
    key_name
  FROM lessons l
  JOIN lesson_content lc ON lc.lesson_id = l.id
  CROSS JOIN LATERAL (
    SELECT 'icebreaker'::text AS key_name
    UNION ALL
    SELECT 'practice'
    UNION ALL
    SELECT 'prayer'
    UNION ALL
    SELECT 'q' || gs::text
    FROM generate_series(0, GREATEST(COALESCE(ARRAY_LENGTH(lc.questions, 1), 0) - 1, 0)) AS gs
  ) keys
),
users_with_lesson_progress AS (
  SELECT DISTINCT user_id, lesson_id
  FROM lesson_responses
),
filled_lesson_answers AS (
  SELECT
    user_id,
    lesson_id,
    question_key
  FROM lesson_responses
  WHERE BTRIM(response) <> ''
)
SELECT
  ulp.user_id,
  pr.full_name,
  pr.area,
  ulp.lesson_id,
  l.title AS lesson_title,
  COUNT(*) AS missing_keys
FROM users_with_lesson_progress ulp
JOIN expected_lesson_keys elk
  ON elk.lesson_id = ulp.lesson_id
JOIN lessons l
  ON l.id = ulp.lesson_id
LEFT JOIN profiles pr
  ON pr.user_id = ulp.user_id
LEFT JOIN filled_lesson_answers fla
  ON fla.user_id = ulp.user_id
 AND fla.lesson_id = ulp.lesson_id
 AND fla.question_key = elk.key_name
WHERE fla.question_key IS NULL
GROUP BY ulp.user_id, pr.full_name, pr.area, ulp.lesson_id, l.title
ORDER BY missing_keys DESC, pr.full_name;

-- 5) Detalhe das chaves faltantes por lição/usuário
WITH expected_lesson_keys AS (
  SELECT
    l.id AS lesson_id,
    key_name
  FROM lessons l
  JOIN lesson_content lc ON lc.lesson_id = l.id
  CROSS JOIN LATERAL (
    SELECT 'icebreaker'::text AS key_name
    UNION ALL
    SELECT 'practice'
    UNION ALL
    SELECT 'prayer'
    UNION ALL
    SELECT 'q' || gs::text
    FROM generate_series(0, GREATEST(COALESCE(ARRAY_LENGTH(lc.questions, 1), 0) - 1, 0)) AS gs
  ) keys
),
users_with_lesson_progress AS (
  SELECT DISTINCT user_id, lesson_id
  FROM lesson_responses
),
filled_lesson_answers AS (
  SELECT
    user_id,
    lesson_id,
    question_key
  FROM lesson_responses
  WHERE BTRIM(response) <> ''
)
SELECT
  ulp.user_id,
  pr.full_name,
  pr.area,
  ulp.lesson_id,
  l.title AS lesson_title,
  elk.key_name AS missing_key
FROM users_with_lesson_progress ulp
JOIN expected_lesson_keys elk
  ON elk.lesson_id = ulp.lesson_id
JOIN lessons l
  ON l.id = ulp.lesson_id
LEFT JOIN profiles pr
  ON pr.user_id = ulp.user_id
LEFT JOIN filled_lesson_answers fla
  ON fla.user_id = ulp.user_id
 AND fla.lesson_id = ulp.lesson_id
 AND fla.question_key = elk.key_name
WHERE fla.question_key IS NULL
ORDER BY pr.full_name, l.title, elk.key_name;
