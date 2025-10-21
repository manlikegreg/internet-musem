import { pool } from '../config/db';
import type { Grave } from '../types';

export async function listGraves(): Promise<Grave[]> {
  const { rows } = await pool.query<Grave>('SELECT * FROM graveyard ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function createGrave(input: { username: string; title: string; epitaph: string; category?: string | null; }): Promise<Grave> {
  const { username, title, epitaph, category } = input;
  const { rows } = await pool.query<Grave>(
    `INSERT INTO graveyard (username, title, epitaph, category, year) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [username, title, epitaph, category ?? null, null]
  );
  return rows[0];
}
