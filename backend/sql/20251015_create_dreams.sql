-- Dreams table for the Dream Archive room
-- Run this once in PostgreSQL

CREATE TABLE IF NOT EXISTS dreams (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  image_url TEXT,
  interpretations JSONB DEFAULT '[]'::jsonb,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON dreams (created_at DESC);
