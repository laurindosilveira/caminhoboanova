
-- Table for rich devotional content, linked to activities of type 'devocional'
CREATE TABLE public.devotional_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL UNIQUE,
  bible_text text NOT NULL DEFAULT '',
  bible_reference text NOT NULL DEFAULT '',
  reflection text NOT NULL DEFAULT '',
  prayer text NOT NULL DEFAULT '',
  practice text NOT NULL DEFAULT '',
  questions text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devotional_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage devotional content"
ON public.devotional_content
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view devotional content"
ON public.devotional_content
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_devotional_content_updated_at
BEFORE UPDATE ON public.devotional_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
