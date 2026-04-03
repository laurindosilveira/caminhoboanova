-- Allow admins and leaders to delete student activity records
-- (needed for PlayerDetailSheet "remove item" functionality)

-- lesson_responses
DROP POLICY IF EXISTS "Admins and leaders can delete lesson responses" ON public.lesson_responses;
CREATE POLICY "Admins and leaders can delete lesson responses"
  ON public.lesson_responses FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- devotional_progress
DROP POLICY IF EXISTS "Admins and leaders can delete devotional progress" ON public.devotional_progress;
CREATE POLICY "Admins and leaders can delete devotional progress"
  ON public.devotional_progress FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- attendance
DROP POLICY IF EXISTS "Admins and leaders can delete attendance" ON public.attendance;
CREATE POLICY "Admins and leaders can delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- worship_attendance
DROP POLICY IF EXISTS "Admins and leaders can delete worship attendance" ON public.worship_attendance;
CREATE POLICY "Admins and leaders can delete worship attendance"
  ON public.worship_attendance FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );

-- user_progress
DROP POLICY IF EXISTS "Admins and leaders can delete user progress" ON public.user_progress;
CREATE POLICY "Admins and leaders can delete user progress"
  ON public.user_progress FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
  );
