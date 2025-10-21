import { pool } from '../config/db';
import type { OracleRequest } from '../types';

export async function createOracle(input: { question: string; response: string; source: string }): Promise<OracleRequest> {
  const { rows } = await pool.query<OracleRequest>(
    `INSERT INTO oracle_requests (question, response, source) VALUES ($1, $2, $3) RETURNING *`,
    [input.question, input.response, input.source]
  );
  return rows[0];
}
