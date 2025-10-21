import { pool } from '../config/db';
import type { Apology } from '../types';

export async function createApology(input: { reason: string; generated: string }): Promise<Apology> {
  const { rows } = await pool.query<Apology>(
    `INSERT INTO apologies (reason, generated) VALUES ($1, $2) RETURNING *`,
    [input.reason, input.generated]
  );
  return rows[0];
}
