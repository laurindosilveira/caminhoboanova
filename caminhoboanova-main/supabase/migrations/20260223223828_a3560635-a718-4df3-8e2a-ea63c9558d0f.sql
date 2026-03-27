-- Allow admins to update profiles in their area (for user management)
CREATE POLICY "Admins can update profiles in their area"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND area = get_my_area()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);