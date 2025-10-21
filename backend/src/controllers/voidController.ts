import { Request, Response } from 'express';
import { VoidCreateSchema } from '../utils/validation';
import * as VoidModel from '../models/void.model';

export async function dropIntoVoid(req: Request, res: Response) {
  try {
    const parsed = VoidCreateSchema.parse(req.body);
    const created = await VoidModel.createVoidMessage({ content: parsed.content });
    res.status(201).json({ ok: true, id: created.id });
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'The Void rejects your scream.' });
  }
}
