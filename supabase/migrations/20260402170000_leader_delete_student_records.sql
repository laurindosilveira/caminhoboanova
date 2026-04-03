-- Fix DELETE permissions on student activity tables:
-- 1. Remove self-delete from regular users (they should NOT be able to delete own records)
-- 2. Add DELETE-only for admins and leaders

-- ── lesson_responses ──────────────────────────────────────────────────────
-- Original policy "Users can manage their own lesson responses" uses FOR ALL
-- which includes DELETE. Replace it with SELECT+INSERT+UPDATE only.
DROP POLICY IF EXISTS "Users can manage their own lesson responses" ON public.lesson_responses;

CREATE POLICY "Users can read their own lesson responses"
  ON public.lesson_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lesson responses"
  ON public.lesson_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lesson responses"
  ON public.lesson_responses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins and leaders can delete lesson responses" ON public.lesson_responses;
CREATE POLICY "Admins and leaders can delete lesson responses"
  ON public.lesson_responses FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- ── devotional_progress ───────────────────────────────────────────────────
-- Drop existing user self-delete policy
DROP POLICY IF EXISTS "Users can delete their own devotional progress" ON public.devotional_progress;

DROP POLICY IF EXISTS "Admins and leaders can delete devotional progress" ON public.devotional_progress;
CREATE POLICY "Admins and leaders can delete devotional progress"
  ON public.devotional_progress FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- ── attendance ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and leaders can delete attendance" ON public.attendance;
CREATE POLICY "Admins and leaders can delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- ── worship_attendance ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and leaders can delete worship attendance" ON public.worship_attendance;
CREATE POLICY "Admins and leaders can delete worship attendance"
  ON public.worship_attendance FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- ── user_progress ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins and leaders can delete user progress" ON public.user_progress;
CREATE POLICY "Admins and leaders can delete user progress"
  ON public.user_progress FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );
