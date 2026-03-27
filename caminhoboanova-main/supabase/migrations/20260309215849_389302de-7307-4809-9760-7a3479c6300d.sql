
-- Allow lider role to also delete attendance records (for journey reset)
DROP POLICY IF EXISTS "Admins can manage attendance in their area" ON public.attendance;
CREATE POLICY "Admins and leaders can manage attendance in their area"
ON public.attendance
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
  AND (is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = attendance.user_id AND p.area = get_my_area()
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role)
);

-- Allow lider role to also delete worship_attendance records (for journey reset)
DROP POLICY IF EXISTS "Admins can delete worship attendance in area" ON public.worship_attendance;
CREATE POLICY "Admins and leaders can delete worship attendance in area"
ON public.worship_attendance
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
  AND (is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area()
  ))
);
