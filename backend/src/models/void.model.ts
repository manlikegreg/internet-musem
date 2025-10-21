import { pool } from '../config/db';
import type { VoidMessage } from '../types';

export async function createVoidMessage(input: { content: string; ephemeral?: boolean }): Promise<VoidMessage> {
  const { rows } = await pool.query<VoidMessage>(
    `INSERT INTO void_messages (content, ephemeral) VALUES ($1, $2) RETURNING *`,
    [input.content, input.ephemeral ?? true]
  );
  return rows[0];
}
