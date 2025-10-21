-- Visits table for anonymous leaderboards
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY,
  client_id TEXT NOT NULL,
  room TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_client ON visits (client_id);
CREATE INDEX IF NOT EXISTS idx_visits_room ON visits (room);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at DESC);
