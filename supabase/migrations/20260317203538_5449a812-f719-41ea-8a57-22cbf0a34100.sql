CREATE TABLE public.church_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name text NOT NULL,
  church_address text DEFAULT '',
  church_phone text DEFAULT '',
  church_email text NOT NULL,
  pastor_name text NOT NULL,
  pastor_role text DEFAULT 'Pastor',
  pastor_phone text DEFAULT '',
  pastor_email text DEFAULT '',
  member_count text DEFAULT '',
  average_age text DEFAULT '',
  activities text DEFAULT '',
  objectives text DEFAULT '',
  needs text DEFAULT '',
  preferences text DEFAULT '',
  recommended_plan text NOT NULL DEFAULT 'comunidade',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'pending_checkout',
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.church_subscriptions ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all church subscriptions
CREATE POLICY "Super admins can manage church subscriptions"
ON public.church_subscriptions
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Allow anonymous inserts during onboarding (no auth required)
CREATE POLICY "Anyone can insert church subscriptions during onboarding"
ON public.church_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);