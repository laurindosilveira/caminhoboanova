CREATE TABLE IF NOT EXISTS public.authorized_system_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.authorized_system_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized system admins visible to super admins"
ON public.authorized_system_admins
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Authorized system admins managed by super admins"
ON public.authorized_system_admins
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

INSERT INTO public.authorized_system_admins (email, notes)
VALUES ('laurindosilveira@gmail.com', 'Acesso inicial ao admin do sistema')
ON CONFLICT (email) DO NOTHING;
