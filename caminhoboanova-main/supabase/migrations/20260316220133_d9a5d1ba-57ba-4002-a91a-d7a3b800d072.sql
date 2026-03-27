CREATE POLICY "Leaders can manage devotional content in their area"
ON public.devotional_content
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'lider'::app_role))
WITH CHECK (has_role(auth.uid(), 'lider'::app_role));