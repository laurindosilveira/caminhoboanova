
-- 1. Add is_super column to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_super BOOLEAN NOT NULL DEFAULT false;

-- 2. Update get_my_area() to return NULL for super admins (meaning "all areas")
CREATE OR REPLACE FUNCTION public.get_my_area()
 RETURNS area_name
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      -- Super admin: return area from profile (UI will handle multi-area)
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'lider') AND is_super = true
      ) THEN (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      -- Regular admin/lider: return admin_area or profile area
      ELSE COALESCE(
        (SELECT admin_area::area_name FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'lider') AND admin_area IS NOT NULL LIMIT 1),
        (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    END
$$;

-- 3. Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'lider')
      AND is_super = true
  )
$$;

-- 4. Update RLS policies to allow super admins full access

-- profiles: super admins can view ALL profiles
DROP POLICY IF EXISTS "Admins can view profiles in their area" ON public.profiles;
CREATE POLICY "Admins can view profiles in their area" ON public.profiles
  FOR SELECT USING (
    (auth.uid() = user_id) 
    OR (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR area = get_my_area()))
  );

DROP POLICY IF EXISTS "Admins can update profiles in their area" ON public.profiles;
CREATE POLICY "Admins can update profiles in their area" ON public.profiles
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR area = get_my_area())
  ) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Liders can view profiles in their area" ON public.profiles;
CREATE POLICY "Liders can view profiles in their area" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR area = get_my_area())
  );

DROP POLICY IF EXISTS "Liders can update profiles in their area" ON public.profiles;
CREATE POLICY "Liders can update profiles in their area" ON public.profiles
  FOR UPDATE USING (
    has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR area = get_my_area())
  ) WITH CHECK (has_role(auth.uid(), 'lider'));

-- attendance: super admins can manage all
DROP POLICY IF EXISTS "Admins can manage attendance in their area" ON public.attendance;
CREATE POLICY "Admins can manage attendance in their area" ON public.attendance
  FOR ALL USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid()) 
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = attendance.user_id AND p.area = get_my_area())
    )
  ) WITH CHECK (has_role(auth.uid(), 'admin'));

-- discipleship_plans: super admins can manage all
DROP POLICY IF EXISTS "Admins can manage plans in their area" ON public.discipleship_plans;
CREATE POLICY "Admins can manage plans in their area" ON public.discipleship_plans
  FOR ALL USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area())
    )
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area())
    )
  );

-- pastoral_notes: super admins can manage all
DROP POLICY IF EXISTS "Admins can manage pastoral notes in their area" ON public.pastoral_notes;
CREATE POLICY "Admins can manage pastoral notes in their area" ON public.pastoral_notes
  FOR ALL USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area())
    )
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area())
    )
  );

-- meeting_evaluations: super admins can manage all
DROP POLICY IF EXISTS "Admins can manage evaluations in their area" ON public.meeting_evaluations;
CREATE POLICY "Admins can manage evaluations in their area" ON public.meeting_evaluations
  FOR ALL USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area())
    )
  ) WITH CHECK (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area())
    )
  );

-- worship_attendance: super admins can manage all
DROP POLICY IF EXISTS "Admins can view worship attendance in area" ON public.worship_attendance;
CREATE POLICY "Admins can view worship attendance in area" ON public.worship_attendance
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
    )
  );

DROP POLICY IF EXISTS "Admins can update worship attendance in area" ON public.worship_attendance;
CREATE POLICY "Admins can update worship attendance in area" ON public.worship_attendance
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
    )
  );

DROP POLICY IF EXISTS "Admins can delete worship attendance in area" ON public.worship_attendance;
CREATE POLICY "Admins can delete worship attendance in area" ON public.worship_attendance
  FOR DELETE USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())
    )
  );

-- user_progress: super admins can view all
DROP POLICY IF EXISTS "Admins can view area participants progress" ON public.user_progress;
CREATE POLICY "Admins can view area participants progress" ON public.user_progress
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = user_progress.user_id AND p.area = get_my_area())
    )
  );

-- lesson_responses: super admins can view all
DROP POLICY IF EXISTS "Admins can view lesson responses in their area" ON public.lesson_responses;
CREATE POLICY "Admins can view lesson responses in their area" ON public.lesson_responses
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = lesson_responses.user_id AND p.area = get_my_area())
    )
  );

-- spiritual_assessments: super admins can view all
DROP POLICY IF EXISTS "Admins can view assessments in their area" ON public.spiritual_assessments;
CREATE POLICY "Admins can view assessments in their area" ON public.spiritual_assessments
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = spiritual_assessments.user_id AND p.area = get_my_area())
    )
  );

-- devotional_progress: super admins can view all
DROP POLICY IF EXISTS "Admins can view all devotional progress" ON public.devotional_progress;
CREATE POLICY "Admins can view all devotional progress" ON public.devotional_progress
  FOR SELECT USING (
    has_role(auth.uid(), 'admin') AND (
      is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = devotional_progress.user_id AND p.area = get_my_area())
    )
  );
