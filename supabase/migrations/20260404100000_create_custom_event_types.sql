-- Custom event types created by leaders, optionally scoped to an area.
CREATE TABLE IF NOT EXISTS public.custom_event_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value       text NOT NULL UNIQUE,   -- slug used in events.type
  label       text NOT NULL,
  emoji       text NOT NULL DEFAULT '📅',
  gives_points boolean NOT NULL DEFAULT false,
  points      integer NOT NULL DEFAULT 0,
  area        text,                   -- NULL = all areas; otherwise area-specific
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_event_types ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (frontend filters by area)
CREATE POLICY "Authenticated users can read custom event types"
  ON public.custom_event_types FOR SELECT
  TO authenticated USING (true);

-- Leaders/admins can create types for their own area
CREATE POLICY "Leaders can insert custom event types"
  ON public.custom_event_types FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Creators can update their own types
CREATE POLICY "Leaders can update their own custom event types"
  ON public.custom_event_types FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Creators can delete their own types
CREATE POLICY "Leaders can delete their own custom event types"
  ON public.custom_event_types FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
