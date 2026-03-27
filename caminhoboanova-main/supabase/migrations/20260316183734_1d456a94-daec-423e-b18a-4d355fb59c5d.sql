
-- Create event_photos table
CREATE TABLE public.event_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Participants can upload photos
CREATE POLICY "Users can insert own photos"
  ON public.event_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view approved photos for events in their area
CREATE POLICY "Users can view approved photos"
  ON public.event_photos FOR SELECT
  TO authenticated
  USING (
    status = 'aprovado'
    OR user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'lider')
  );

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
  ON public.event_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins and leaders can update status (approve/reject)
CREATE POLICY "Admins and leaders can update photos"
  ON public.event_photos FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'));

-- Admins can delete any photo
CREATE POLICY "Admins can delete any photo"
  ON public.event_photos FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'lider'));

-- Create storage bucket for event photos
INSERT INTO storage.buckets (id, name, public) VALUES ('event-photos', 'event-photos', true);

-- Storage RLS: anyone authenticated can upload
CREATE POLICY "Authenticated users can upload event photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-photos');

-- Storage RLS: anyone can view
CREATE POLICY "Anyone can view event photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'event-photos');

-- Storage RLS: users can delete own uploads
CREATE POLICY "Users can delete own event photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-photos' AND (auth.uid()::text = (storage.foldername(name))[1]));
