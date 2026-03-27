-- Allow leaders to manage lesson content (insert, update, delete)
CREATE POLICY "Leaders can manage lesson content"
ON public.lesson_content
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'lider'::app_role))
WITH CHECK (has_role(auth.uid(), 'lider'::app_role));