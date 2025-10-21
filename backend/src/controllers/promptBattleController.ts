import { Request, Response } from 'express';
import { PromptBattleCreateSchema, VoteSchema } from '../utils/validation';
import * as PB from '../models/promptBattle.model';
import { judgePrompts } from '../utils/groqClient';

export async function createBattle(req: Request, res: Response) {
  try {
    const parsed = PromptBattleCreateSchema.parse(req.body);
    // Create baseline battle
    const battle = await PB.createPromptBattle({ prompt_a: parsed.prompt_a, prompt_b: parsed.prompt_b });
    // Ask AI (optional)
    const verdict = await judgePrompts(parsed.prompt_a, parsed.prompt_b);
    const updated = await PB.setPromptBattleResult(battle.id, verdict);
    res.status(201).json(updated ?? battle);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to create prompt battle' });
  }
}

export async function vote(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { choice } = VoteSchema.parse(req.body);
    const updated = await PB.votePromptBattle(id, choice);
    if (!updated) return res.status(404).json({ error: 'Battle not found' });
    res.json(updated);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid vote', details: err.issues });
    res.status(500).json({ error: 'Failed to register vote' });
  }
}
