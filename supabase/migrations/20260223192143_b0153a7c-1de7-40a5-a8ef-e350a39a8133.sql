
-- Table for worship attendance confirmations from members
CREATE TABLE public.worship_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  worship_date DATE NOT NULL,
  worship_time TEXT NOT NULL,
  preacher_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, aprovado, rejeitado
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.worship_attendance ENABLE ROW LEVEL SECURITY;

-- Users can insert their own worship attendance
CREATE POLICY "Users can insert own worship attendance"
  ON public.worship_attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own worship attendance
CREATE POLICY "Users can view own worship attendance"
  ON public.worship_attendance FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view worship attendance in their area
CREATE POLICY "Admins can view worship attendance in area"
  ON public.worship_attendance FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
  );

-- Admins can update worship attendance in their area (approve/reject)
CREATE POLICY "Admins can update worship attendance in area"
  ON public.worship_attendance FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
  );

-- Admins can delete worship attendance in their area
CREATE POLICY "Admins can delete worship attendance in area"
  ON public.worship_attendance FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
  );
