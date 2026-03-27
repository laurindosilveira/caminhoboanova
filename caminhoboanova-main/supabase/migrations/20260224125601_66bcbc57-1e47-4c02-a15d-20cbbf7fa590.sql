
-- Add justification column
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS justification text;

-- Allow users to insert their own attendance (for check-in)
CREATE POLICY "Users can insert their own attendance"
ON public.attendance FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own attendance (for changing status/justification)
CREATE POLICY "Users can update their own attendance"
ON public.attendance FOR UPDATE
USING (auth.uid() = user_id);
