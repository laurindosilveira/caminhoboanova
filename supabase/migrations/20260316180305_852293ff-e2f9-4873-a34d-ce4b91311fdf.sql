
-- Add file columns to community_chat
ALTER TABLE public.community_chat
  ADD COLUMN IF NOT EXISTS file_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_type text DEFAULT NULL;

-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can upload to their own folder
CREATE POLICY "Users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: anyone can view chat files
CREATE POLICY "Anyone can view chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-files');

-- RLS: users can delete their own chat files
CREATE POLICY "Users can delete own chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);
