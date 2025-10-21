import { pool } from '../config/db';
import type { Dream } from '../types';

export async function listDreams(): Promise<Dream[]> {
  const { rows } = await pool.query<Dream>('SELECT * FROM dream_archive ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function createDream(input: { content: string }): Promise<Dream> {
  const { rows } = await pool.query<Dream>(
    `INSERT INTO dream_archive (content) VALUES ($1) RETURNING *`,
    [input.content]
  );
  return rows[0];
}
