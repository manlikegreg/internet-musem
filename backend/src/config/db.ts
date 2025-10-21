import { Pool } from 'pg';
import { env } from './env';

const isProd = env.NODE_ENV === 'production';

function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : (false as any),
  });
}

export let pool: Pool = createPool(env.DATABASE_URL);

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS graveyard (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  epitaph TEXT NOT NULL,
  category TEXT,
  year INT,
  created_at TIMESTAMP DEFAULT NOW(),
  resurrect_count INT DEFAULT 0,
  username TEXT,
  attachment_name TEXT,
  attachment_path TEXT,
  attachment_size INT,
  attachment_type TEXT
);

ALTER TABLE graveyard ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE graveyard ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE graveyard ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE graveyard ADD COLUMN IF NOT EXISTS attachment_size INT;
ALTER TABLE graveyard ADD COLUMN IF NOT EXISTS attachment_type TEXT;

CREATE TABLE IF NOT EXISTS confessions (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Confession Booth (v2) table for live SSE
CREATE TABLE IF NOT EXISTS confessions_booth (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_confessions_booth_created_at ON confessions_booth(created_at DESC);

CREATE TABLE IF NOT EXISTS void_messages (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  ephemeral BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- The Void room stream messages (separate from legacy void_messages)
CREATE TABLE IF NOT EXISTS void_stream_messages (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_void_stream_messages_created_at ON void_stream_messages(created_at DESC);

-- Optional media columns
ALTER TABLE void_stream_messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE confessions_booth ADD COLUMN IF NOT EXISTS audio_url TEXT;

CREATE TABLE IF NOT EXISTS prompt_battles (
  id SERIAL PRIMARY KEY,
  prompt_a TEXT,
  prompt_b TEXT,
  result JSONB,
  votes_a INT DEFAULT 0,
  votes_b INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oracle_requests (
  id SERIAL PRIMARY KEY,
  question TEXT,
  response TEXT,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Internet Oracle live tables
CREATE TABLE IF NOT EXISTS oracle_questions (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oracle_questions_created_at ON oracle_questions(created_at DESC);

CREATE TABLE IF NOT EXISTS oracle_replies (
  id UUID PRIMARY KEY,
  question_id UUID REFERENCES oracle_questions(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  reply TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oracle_replies_qid_created_at ON oracle_replies(question_id, created_at DESC);

CREATE TABLE IF NOT EXISTS time_capsules (
  id SERIAL PRIMARY KEY,
  title TEXT,
  message TEXT,
  open_at TIMESTAMP,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Time Capsule v2 table
CREATE TABLE IF NOT EXISTS capsules (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  message TEXT,
  media_url TEXT,
  unlock_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'sealed',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capsules_unlock_at ON capsules(unlock_at);
CREATE INDEX IF NOT EXISTS idx_capsules_status_unlock ON capsules(status, unlock_at);

CREATE TABLE IF NOT EXISTS apologies (
  id SERIAL PRIMARY KEY,
  reason TEXT,
  generated TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliments (
  id SERIAL PRIMARY KEY,
  message TEXT,
  from_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users for optional login/token
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  token TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prompt Battle V2 tables
CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  image_url TEXT,
  ai_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS battles (
  id SERIAL PRIMARY KEY,
  prompt_a_id INT REFERENCES prompts(id) ON DELETE CASCADE,
  prompt_b_id INT REFERENCES prompts(id) ON DELETE CASCADE,
  votes_a INT DEFAULT 0,
  votes_b INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_reactions (
  id SERIAL PRIMARY KEY,
  prompt_id INT REFERENCES prompts(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  username TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS dream_archive (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Live Mood Mirror table
CREATE TABLE IF NOT EXISTS moods (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  emoji TEXT NOT NULL,
  text TEXT,
  sentiment INT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moods_created_at ON moods(created_at DESC);

CREATE TABLE IF NOT EXISTS mood_mirror_readings (
  id SERIAL PRIMARY KEY,
  seed TEXT,
  aura TEXT,
  reading TEXT,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

export async function initDb() {
  if (!env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Database features will be disabled.');
    return;
  }
  try {
    await pool.query(SCHEMA_SQL);
  } catch (err: any) {
    // If database does not exist (3D000), attempt to create it by connecting to the maintenance DB
    if (err && (err.code === '3D000' || /does not exist/i.test(String(err.message)))) {
      try {
        const url = new URL(env.DATABASE_URL);
        const dbName = url.pathname.replace(/^\//, '') || 'postgres';
        url.pathname = '/postgres';
        const adminConn = url.toString();

        const adminPool = createPool(adminConn);
        try {
          await adminPool.query(`CREATE DATABASE ${JSON.stringify(dbName).slice(1, -1)}`);
          console.log(`Created database '${dbName}'.`);
        } catch (createErr: any) {
          // Ignore if already created concurrently or insufficient privilege
          console.warn('Could not create database (may already exist or insufficient privileges).', createErr?.message || createErr);
        } finally {
          await adminPool.end().catch(() => {});
        }

        // Recreate pool pointing to target DB and run schema
        try {
          await pool.end().catch(() => {});
        } catch {}
        pool = createPool(env.DATABASE_URL);
        await pool.query(SCHEMA_SQL);
      } catch (fatal: any) {
        console.error('Failed to init DB', fatal);
        throw fatal;
      }
    } else {
      console.error('Failed to init DB', err);
      throw err;
    }
  }
}
