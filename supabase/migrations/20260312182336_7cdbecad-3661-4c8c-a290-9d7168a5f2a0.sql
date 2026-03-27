-- Add requires_text and requires_file to community_challenges
ALTER TABLE public.community_challenges ADD COLUMN IF NOT EXISTS requires_text boolean NOT NULL DEFAULT false;
ALTER TABLE public.community_challenges ADD COLUMN IF NOT EXISTS requires_file boolean NOT NULL DEFAULT false;

-- Add response_text and file_url to challenge_participants
ALTER TABLE public.challenge_participants ADD COLUMN IF NOT EXISTS response_text text DEFAULT null;
ALTER TABLE public.challenge_participants ADD COLUMN IF NOT EXISTS file_url text DEFAULT null;

-- Create storage bucket for challenge files
INSERT INTO storage.buckets (id, name, public) VALUES ('challenge-files', 'challenge-files', true) ON CONFLICT DO NOTHING;

-- RLS for challenge-files bucket: authenticated users can upload
CREATE POLICY "Authenticated users can upload challenge files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'challenge-files');

-- Anyone can view challenge files (public bucket)
CREATE POLICY "Anyone can view challenge files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'challenge-files');

-- Users can delete their own challenge files
CREATE POLICY "Users can delete own challenge files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'challenge-files' AND (storage.foldername(name))[1] = auth.uid()::text);