-- Allow liders to view lesson responses in their area
CREATE POLICY "Liders can view lesson responses in their area"
ON public.lesson_responses FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role)
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = lesson_responses.user_id
      AND p.area = get_my_area()
    )
  )
);

-- Allow liders to view devotional progress in their area
CREATE POLICY "Liders can view devotional progress in their area"
ON public.devotional_progress FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role)
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = devotional_progress.user_id
      AND p.area = get_my_area()
    )
  )
);