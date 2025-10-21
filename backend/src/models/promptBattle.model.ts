import { pool } from '../config/db';
import type { PromptBattle } from '../types';

export async function createPromptBattle(input: { prompt_a: string; prompt_b: string; result?: any }): Promise<PromptBattle> {
  const { rows } = await pool.query<PromptBattle>(
    `INSERT INTO prompt_battles (prompt_a, prompt_b, result) VALUES ($1, $2, $3) RETURNING *`,
    [input.prompt_a, input.prompt_b, input.result ?? null]
  );
  return rows[0];
}

export async function getPromptBattle(id: number): Promise<PromptBattle | null> {
  const { rows } = await pool.query<PromptBattle>(`SELECT * FROM prompt_battles WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function votePromptBattle(id: number, choice: 'A'|'B'): Promise<PromptBattle | null> {
  const field = choice === 'A' ? 'votes_a' : 'votes_b';
  const { rows } = await pool.query<PromptBattle>(
    `UPDATE prompt_battles SET ${field} = ${field} + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

export async function setPromptBattleResult(id: number, result: any): Promise<PromptBattle | null> {
  const { rows } = await pool.query<PromptBattle>(
    `UPDATE prompt_battles SET result = $2 WHERE id = $1 RETURNING *`,
    [id, result]
  );
  return rows[0] ?? null;
}
