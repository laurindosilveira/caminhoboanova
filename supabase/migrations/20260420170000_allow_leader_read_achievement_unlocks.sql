CREATE POLICY "Liders can view achievement unlocks in their area"
ON public.achievement_unlocks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = achievement_unlocks.user_id
      AND p.area = get_my_area()
  )
);
