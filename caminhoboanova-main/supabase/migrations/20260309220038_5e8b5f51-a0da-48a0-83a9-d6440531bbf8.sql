
-- Add DELETE policy for achievement_unlocks so admins/liders can reset
CREATE POLICY "Admins and leaders can delete achievement unlocks in area"
ON public.achievement_unlocks
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
  AND (is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = achievement_unlocks.user_id AND p.area = get_my_area()
  ))
);
