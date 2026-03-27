
-- Allow admins to delete user_progress records (for removing fraudulent activity completions)
CREATE POLICY "Admins can delete user progress in their area"
ON public.user_progress
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    is_super_admin(auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = user_progress.user_id AND p.area = get_my_area()
    )
  )
);

-- Allow leaders to delete user_progress records in their area
CREATE POLICY "Liders can delete user progress in their area"
ON public.user_progress
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = user_progress.user_id AND p.area = get_my_area()
    )
  )
);

-- Allow admins to delete devotional_progress records
CREATE POLICY "Admins can delete devotional progress in area"
ON public.devotional_progress
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = devotional_progress.user_id AND p.area = get_my_area()
    )
  )
);

-- Allow leaders to delete devotional_progress records
CREATE POLICY "Liders can delete devotional progress in area"
ON public.devotional_progress
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = devotional_progress.user_id AND p.area = get_my_area()
    )
  )
);

-- Allow admins to delete lesson_responses records
CREATE POLICY "Admins can delete lesson responses in area"
ON public.lesson_responses
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = lesson_responses.user_id AND p.area = get_my_area()
    )
  )
);

-- Allow leaders to delete lesson_responses records
CREATE POLICY "Liders can delete lesson responses in area"
ON public.lesson_responses
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = lesson_responses.user_id AND p.area = get_my_area()
    )
  )
);
