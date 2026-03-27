
-- ==== SALA DA TURMA: Chat, Orações, Configurações ====

-- 1. Chat da turma (por comunidade)
CREATE TABLE public.community_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.community_chat ENABLE ROW LEVEL SECURITY;

-- Membros da mesma comunidade podem ver o chat
CREATE POLICY "Users can view chat from their community"
ON public.community_chat FOR SELECT
USING (community = (get_my_community())::text);

-- Qualquer autenticado pode inserir na sua própria comunidade
CREATE POLICY "Users can insert chat messages in their community"
ON public.community_chat FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND community = (get_my_community())::text
);

-- Admins podem deletar mensagens inadequadas
CREATE POLICY "Admins can delete chat messages"
ON public.community_chat FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Mural de Orações (por comunidade)
CREATE TABLE public.prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  amen_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prayer requests from their community"
ON public.prayer_requests FOR SELECT
USING (community = (get_my_community())::text);

CREATE POLICY "Users can insert prayer requests in their community"
ON public.prayer_requests FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND community = (get_my_community())::text
);

-- Permite atualizar amen_count (qualquer autenticado da comunidade)
CREATE POLICY "Users can update amen count"
ON public.prayer_requests FOR UPDATE
USING (community = (get_my_community())::text)
WITH CHECK (community = (get_my_community())::text);

CREATE POLICY "Admins can delete prayer requests"
ON public.prayer_requests FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Configurações da comunidade (verse of the week, whatsapp link)
CREATE TABLE public.community_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL UNIQUE,
  whatsapp_link text,
  verse_of_week text,
  verse_reference text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view community settings"
ON public.community_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage community settings"
ON public.community_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Habilitar Realtime para o chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_requests;
