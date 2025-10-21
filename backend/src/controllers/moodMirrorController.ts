import { Request, Response } from 'express';
import { z } from 'zod';
import * as MoodModel from '../models/moodMirror.model';
import { completeText } from '../utils/groqClient';
import { env } from '../config/env';

const MirrorSchema = z.object({ seed: z.string().optional().nullable() });

function fallbackReading(seed?: string | null) {
  const auras = ['neon mist', 'soft static', 'cozy glitch', 'midnight bloom', 'pixel dusk'];
  const moods = [
    'Your tabs hum like distant cities.',
    'You are buffering a new chapter.',
    'Today you are a friendly 404, wandering but cute.',
    'Your cursor leaves stardust in its wake.',
    'You contain multitudes of open drafts.'
  ];
  const aura = auras[Math.floor(Math.random() * auras.length)];
  const reading = `${seed ? 'Reflecting your note: "' + seed + '" — ' : ''}${moods[Math.floor(Math.random() * moods.length)]}`;
  return { aura, reading, source: 'random' as const };
}

export async function reflect(req: Request, res: Response) {
  try {
    const { seed } = MirrorSchema.parse(req.body);

    let aura = '';
    let reading = '';
    let source = 'random';

    if (env.GROQ_API_KEY) {
      const prompt = `You are the Mood Mirror. Given an optional seed text, describe a poetic internet aura (one short noun phrase) and a 2-sentence whimsical reading. Reply in JSON: {"aura": string, "reading": string}. Seed: ${seed ?? ''}`;
      const text = await completeText(prompt);
      try {
        const parsed = JSON.parse(text);
        aura = String(parsed.aura || '').slice(0, 80);
        reading = String(parsed.reading || '').slice(0, 500);
        source = 'groq';
      } catch {
        // If not JSON, just take the text as reading
        reading = (text || '').slice(0, 500);
        aura = 'cozy glitch';
        source = 'groq-freeform';
      }
    }

    if (!reading) {
      const fb = fallbackReading(seed);
      aura = fb.aura;
      reading = fb.reading;
      source = fb.source;
    }

    const created = await MoodModel.createReading({ seed: seed ?? null, aura, reading, source });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'Could not reflect mood' });
  }
}
