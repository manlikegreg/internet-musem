import { pool } from '../config/db';
import type { TimeCapsule } from '../types';

export async function createTimeCapsule(input: { title: string; message: string; open_at: string; is_public: boolean }): Promise<TimeCapsule> {
  const { rows } = await pool.query<TimeCapsule>(
    `INSERT INTO time_capsules (title, message, open_at, is_public) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.title, input.message, input.open_at, input.is_public]
  );
  return rows[0];
}

export async function listPublicOpenCapsules(): Promise<TimeCapsule[]> {
  const { rows } = await pool.query<TimeCapsule>(
    `SELECT * FROM time_capsules WHERE is_public = TRUE AND open_at <= NOW() ORDER BY created_at DESC LIMIT 100`
  );
  return rows;
}
