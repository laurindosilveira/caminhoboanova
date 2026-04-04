-- Allow leaders to select which devotional days are released per event.
-- NULL means "all devotionals released" (current behaviour, unchanged).
-- E.g. {1,2,3,5} releases only those day_numbers for the linked lesson.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS released_devotional_days integer[];
