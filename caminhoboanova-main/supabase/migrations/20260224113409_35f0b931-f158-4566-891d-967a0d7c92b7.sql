
-- Users can delete their own prayer requests
CREATE POLICY "Users can delete their own prayer requests"
ON public.prayer_requests
FOR DELETE
USING (auth.uid() = user_id);

-- Leaders can delete prayer requests in their community area
CREATE POLICY "Liders can delete prayer requests in their area"
ON public.prayer_requests
FOR DELETE
USING (has_role(auth.uid(), 'lider'::app_role) AND community = (get_my_community())::text);

-- Users can delete their own chat messages
CREATE POLICY "Users can delete their own chat messages"
ON public.community_chat
FOR DELETE
USING (auth.uid() = user_id);

-- Leaders can delete chat messages in their community
CREATE POLICY "Liders can delete chat messages in their area"
ON public.community_chat
FOR DELETE
USING (has_role(auth.uid(), 'lider'::app_role) AND community = (get_my_community())::text);
