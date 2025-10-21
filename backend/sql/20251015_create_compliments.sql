-- Compliments table for the Compliment Machine room
-- Run this in your PostgreSQL database

CREATE TABLE IF NOT EXISTS compliments (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  compliment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliments_created_at ON compliments (created_at DESC);
