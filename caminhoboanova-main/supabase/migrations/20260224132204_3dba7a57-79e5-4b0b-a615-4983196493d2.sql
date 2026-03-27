
CREATE TABLE public.testimonies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  community text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view testimonies from their community"
ON public.testimonies FOR SELECT
USING (community = (get_my_community())::text);

CREATE POLICY "Users can insert their own testimonies"
ON public.testimonies FOR INSERT
WITH CHECK (auth.uid() = user_id AND community = (get_my_community())::text);

CREATE POLICY "Users can delete their own testimonies"
ON public.testimonies FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete testimonies"
ON public.testimonies FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
