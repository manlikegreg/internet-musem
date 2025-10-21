import { Request, Response } from 'express';
import { ApologyCreateSchema } from '../utils/validation';
import * as ApologyModel from '../models/apology.model';
import { completeText } from '../utils/groqClient';
import { env } from '../config/env';

function generateApology(reason: string): string {
  return `Dear Internet,\n\nI am profoundly sorry for ${reason}. In a moment of questionable judgment, I forgot the sacred laws of vibes. I promise to reflect, meme responsibly, and touch grass.\n\nSincerely,\nA slightly wiser human`;
}

export async function makeApology(req: Request, res: Response) {
  try {
    const { reason } = ApologyCreateSchema.parse(req.body);
    let generated: string;
    if (env.GROQ_API_KEY) {
      const prompt = `Write a short, over-the-top public apology in first person. It should be dramatic but kind, wholesome, and a bit absurd. Reason: ${reason}`;
      generated = (await completeText(prompt)) || generateApology(reason);
    } else {
      generated = generateApology(reason);
    }
    const created = await ApologyModel.createApology({ reason, generated });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Failed to generate apology' });
  }
}
