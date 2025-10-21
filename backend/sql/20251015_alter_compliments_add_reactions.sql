-- Add reactions JSONB to compliments for emoji reactions
ALTER TABLE compliments
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;
