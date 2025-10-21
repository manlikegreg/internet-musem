-- Moods table for the Mood Mirror room
-- Run this in PostgreSQL

CREATE TABLE IF NOT EXISTS moods (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  emoji TEXT NOT NULL,
  text TEXT,
  sentiment INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moods_created_at ON moods (created_at DESC);
