import { Request, Response } from 'express';
import { TimeCapsuleCreateSchema } from '../utils/validation';
import * as Capsule from '../models/timeCapsule.model';

export async function createCapsule(req: Request, res: Response) {
  try {
    const parsed = TimeCapsuleCreateSchema.parse(req.body);
    const created = await Capsule.createTimeCapsule(parsed);
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to create time capsule' });
  }
}

export async function listOpenPublic(_req: Request, res: Response) {
  try {
    const rows = await Capsule.listPublicOpenCapsules();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch capsules' });
  }
}
