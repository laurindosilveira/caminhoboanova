
ALTER TABLE public.community_chat ADD COLUMN reply_to uuid REFERENCES public.community_chat(id) ON DELETE SET NULL;
ALTER TABLE public.community_chat ADD COLUMN reply_to_name text;
ALTER TABLE public.community_chat ADD COLUMN reply_to_text text;
