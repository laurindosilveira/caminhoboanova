INSERT INTO public.user_roles (user_id, role)
VALUES ('de285cfd-3d38-4a61-ac48-71b3957db482', 'admin')
ON CONFLICT DO NOTHING;