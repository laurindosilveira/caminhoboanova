-- Allow leaders to create and edit their own turma
-- Previously only admins could manage turmas (INSERT/UPDATE/DELETE)

-- 1. Add INSERT policy: leader can create a new turma (area is auto-set from profile)
CREATE POLICY "Lideres can create turmas"
  ON turmas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'lider'
    )
    AND created_by = auth.uid()
  );

-- 2. Add UPDATE policy: leader can edit turmas they created OR are assigned to
CREATE POLICY "Lideres can update their turma"
  ON turmas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'lider'
    )
    AND (
      created_by = auth.uid()
      OR id IN (
        SELECT turma_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'lider'
    )
    AND (
      created_by = auth.uid()
      OR id IN (
        SELECT turma_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );
