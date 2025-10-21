import { z } from 'zod';

export const GraveCreateSchema = z.object({
  title: z.string().min(1),
  epitaph: z.string().min(1),
  category: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
});

export const ConfessionCreateSchema = z.object({
  message: z.string().min(1),
});

export const VoidCreateSchema = z.object({
  content: z.string().min(1),
});

export const PromptBattleCreateSchema = z.object({
  prompt_a: z.string().min(1),
  prompt_b: z.string().min(1),
});

export const VoteSchema = z.object({
  choice: z.enum(['A', 'B']),
});

export const OracleAskSchema = z.object({
  question: z.string().min(1),
});

export const TimeCapsuleCreateSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  open_at: z.string().datetime().or(z.string().min(1)),
  is_public: z.boolean().default(false),
});

export const ApologyCreateSchema = z.object({
  reason: z.string().min(1),
});

export const ComplimentCreateSchema = z.object({
  message: z.string().min(1),
  from_name: z.string().optional().nullable(),
});
