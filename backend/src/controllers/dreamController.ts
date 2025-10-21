import { Request, Response } from 'express';
import { z } from 'zod';
import * as DreamModel from '../models/dream.model';

const DreamCreateSchema = z.object({ content: z.string().min(1) });

export async function listDreams(_req: Request, res: Response) {
  try {
    const rows = await DreamModel.listDreams();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dreams' });
  }
}

export async function addDream(req: Request, res: Response) {
  try {
    const { content } = DreamCreateSchema.parse(req.body);
    const created = await DreamModel.createDream({ content });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to add dream' });
  }
}
