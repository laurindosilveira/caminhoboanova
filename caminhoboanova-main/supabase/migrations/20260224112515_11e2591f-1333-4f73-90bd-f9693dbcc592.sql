
-- Allow líderes to view all user roles (needed for UsersTab)
CREATE POLICY "Liders can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'lider'::app_role));

-- Allow líderes to view profiles in their area (needed for UsersTab)
CREATE POLICY "Liders can view profiles in their area"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'lider'::app_role) AND area = get_my_area());
