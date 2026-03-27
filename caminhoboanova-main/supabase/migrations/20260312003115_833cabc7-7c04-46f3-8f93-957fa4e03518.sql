-- Add turma_id column to messages table
ALTER TABLE public.messages ADD COLUMN turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL;

-- Update the RLS policy for users to also see messages targeted to their turma
DROP POLICY IF EXISTS "Users can view messages for their area or community" ON public.messages;
CREATE POLICY "Users can view messages for their area or community or turma"
ON public.messages FOR SELECT TO authenticated
USING (
  (area IS NULL AND community IS NULL AND turma_id IS NULL)
  OR area = (get_my_area())::text
  OR community = (get_my_community())::text
  OR turma_id = (SELECT turma_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);