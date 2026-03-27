-- Adicionar constraint única para attendance (event_id + user_id)
-- necessário para o upsert funcionar corretamente
ALTER TABLE public.attendance ADD CONSTRAINT attendance_event_user_unique UNIQUE (event_id, user_id);
