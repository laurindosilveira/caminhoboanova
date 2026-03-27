
-- Allow admins to view all push subscriptions
CREATE POLICY "Admins can view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow leaders to view push subscriptions in their area
CREATE POLICY "Leaders can view push subscriptions in area"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role) AND (
    is_super_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = push_subscriptions.user_id
        AND p.area = get_my_area()
    )
  )
);
