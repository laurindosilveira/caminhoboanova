
-- ============================================================
-- Add priority flag and last_contact to discipleship_plans
-- ============================================================
ALTER TABLE public.discipleship_plans
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamp with time zone;

-- ============================================================
-- PASTORAL NOTES LOG (accompaniment register)
-- ============================================================
CREATE TABLE public.pastoral_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_type   text NOT NULL DEFAULT 'acompanhamento'
              CHECK (note_type IN ('acompanhamento','conversa','encontro_individual','observacao')),
  content     text NOT NULL,
  is_private  boolean NOT NULL DEFAULT true,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pastoral_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pastoral notes in their area"
  ON public.pastoral_notes FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = pastoral_notes.user_id
        AND p.area = get_my_area()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = pastoral_notes.user_id
        AND p.area = get_my_area()
    )
  );

-- ============================================================
-- ATTENDANCE table (event presence tracking)
-- ============================================================
CREATE TABLE public.attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'presente'
             CHECK (status IN ('presente','faltou','justificado')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage attendance in their area"
  ON public.attendance FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = attendance.user_id
        AND p.area = get_my_area()
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );
