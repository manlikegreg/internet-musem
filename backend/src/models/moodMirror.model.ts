import { pool } from '../config/db';
import type { MoodReading } from '../types';

export async function createReading(input: { seed?: string | null; aura: string; reading: string; source: string }): Promise<MoodReading> {
  const { rows } = await pool.query<MoodReading>(
    `INSERT INTO mood_mirror_readings (seed, aura, reading, source) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.seed ?? null, input.aura, input.reading, input.source]
  );
  return rows[0];
}
