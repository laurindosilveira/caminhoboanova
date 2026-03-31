CREATE POLICY "Liders can view area participants progress"
ON public.user_progress
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = user_progress.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can view lesson responses in their area"
ON public.lesson_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = lesson_responses.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can view all devotional progress"
ON public.devotional_progress
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = devotional_progress.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can view devotional responses in their area"
ON public.devotional_responses
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = devotional_responses.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can view assessments in their area"
ON public.spiritual_assessments
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = spiritual_assessments.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can manage plans in their area"
ON public.discipleship_plans
FOR ALL
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = discipleship_plans.user_id
        AND p.area = get_my_area()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = discipleship_plans.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can manage pastoral notes in their area"
ON public.pastoral_notes
FOR ALL
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = pastoral_notes.user_id
        AND p.area = get_my_area()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = pastoral_notes.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can manage attendance in their area"
ON public.attendance
FOR ALL
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = attendance.user_id
        AND p.area = get_my_area()
    )
  )
)
WITH CHECK (has_role(auth.uid(), 'lider'));

CREATE POLICY "Liders can manage evaluations in their area"
ON public.meeting_evaluations
FOR ALL
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = meeting_evaluations.user_id
        AND p.area = get_my_area()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = meeting_evaluations.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can view worship attendance in area"
ON public.worship_attendance
FOR SELECT
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = worship_attendance.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can update worship attendance in area"
ON public.worship_attendance
FOR UPDATE
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = worship_attendance.user_id
        AND p.area = get_my_area()
    )
  )
);

CREATE POLICY "Liders can delete worship attendance in area"
ON public.worship_attendance
FOR DELETE
USING (
  has_role(auth.uid(), 'lider')
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = worship_attendance.user_id
        AND p.area = get_my_area()
    )
  )
);
