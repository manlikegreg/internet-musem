-- Apologies table for the Apology Generator room
-- Run this once in your PostgreSQL database

CREATE TABLE IF NOT EXISTS apologies (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  apology TEXT NOT NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_apologies_created_at ON apologies (created_at DESC);
