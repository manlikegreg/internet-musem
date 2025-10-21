import { pool } from '../config/db';
import type { Confession } from '../types';

export async function listConfessions(): Promise<Confession[]> {
  const { rows } = await pool.query<Confession>('SELECT * FROM confessions ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function createConfession(input: { message: string }): Promise<Confession> {
  const { rows } = await pool.query<Confession>(
    `INSERT INTO confessions (message) VALUES ($1) RETURNING *`,
    [input.message]
  );
  return rows[0];
}
