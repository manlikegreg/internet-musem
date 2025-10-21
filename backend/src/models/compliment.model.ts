import { pool } from '../config/db';
import type { Compliment } from '../types';

export async function listCompliments(): Promise<Compliment[]> {
  const { rows } = await pool.query<Compliment>('SELECT * FROM compliments ORDER BY created_at DESC LIMIT 100');
  return rows;
}

export async function createCompliment(input: { message: string; from_name?: string | null }): Promise<Compliment> {
  const { rows } = await pool.query<Compliment>(
    `INSERT INTO compliments (message, from_name) VALUES ($1, $2) RETURNING *`,
    [input.message, input.from_name ?? null]
  );
  return rows[0];
}
