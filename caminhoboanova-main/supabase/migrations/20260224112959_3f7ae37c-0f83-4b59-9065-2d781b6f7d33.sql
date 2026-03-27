
CREATE POLICY "Liders can update profiles in their area"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'lider'::app_role) AND (area = get_my_area()))
WITH CHECK (has_role(auth.uid(), 'lider'::app_role));
