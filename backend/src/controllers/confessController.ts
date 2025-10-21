import { Request, Response } from 'express';
import { ConfessionCreateSchema } from '../utils/validation';
import * as Confession from '../models/confession.model';

export async function getConfessions(_req: Request, res: Response) {
  try {
    const rows = await Confession.listConfessions();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch confessions' });
  }
}

export async function addConfession(req: Request, res: Response) {
  try {
    const parsed = ConfessionCreateSchema.parse(req.body);
    const created = await Confession.createConfession(parsed);
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to add confession' });
  }
}
