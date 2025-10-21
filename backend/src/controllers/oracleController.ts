import { Request, Response } from 'express';
import { OracleAskSchema } from '../utils/validation';
import * as Oracle from '../models/oracle.model';
import { askGroq } from '../utils/groqClient';

export async function ask(req: any, res: Response) {
  try {
    const { question } = OracleAskSchema.parse(req.body);
    const response = await askGroq(question);
    const created = await Oracle.createOracle({ question, response, source: response === 'The oracle sleeps.' ? 'none' : 'groq' });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid input', details: err.issues });
    res.status(500).json({ error: 'The oracle is silent.' });
  }
}
