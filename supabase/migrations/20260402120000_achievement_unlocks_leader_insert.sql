-- Allow admins and leaders to insert achievement_unlocks on behalf of users in their area.
-- This is required for the "grant bonus" feature in PlayerDetailSheet.
-- The existing DELETE policy already restricts by area; this INSERT mirrors that pattern.

CREATE POLICY "Admins and leaders can insert achievement unlocks in area"
ON public.achievement_unlocks
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = achievement_unlocks.user_id
        AND p.area = get_my_area()
    )
  )
);
