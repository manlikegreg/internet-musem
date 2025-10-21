import { Request, Response } from 'express';
import { ComplimentCreateSchema } from '../utils/validation';
import * as ComplimentModel from '../models/compliment.model';

export async function listCompliments(_req: Request, res: Response) {
  try {
    const rows = await ComplimentModel.listCompliments();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch compliments' });
  }
}

export async function addCompliment(req: Request, res: Response) {
  try {
    const parsed = ComplimentCreateSchema.parse(req.body);
    const created = await ComplimentModel.createCompliment(parsed);
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to add compliment' });
  }
}
