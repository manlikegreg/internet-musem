import { Request, Response } from 'express';
import { GraveCreateSchema } from '../utils/validation';
import * as Graveyard from '../models/graveyard.model';

export async function getGraves(_req: Request, res: Response) {
  try {
    const rows = await Graveyard.listGraves();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch graves' });
  }
}

export async function addGrave(req: Request, res: Response) {
  try {
    const parsed = GraveCreateSchema.parse(req.body);
    const created = await Graveyard.createGrave(parsed);
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to add grave' });
  }
}
