import { env } from '../config/env';
import { pool } from '../config/db';

export async function getGroqApiKey(): Promise<string> {
  try {
    const r = await pool.query<{ value: string }>("SELECT value FROM site_config WHERE key = 'GROQ_API_KEY' LIMIT 1");
    const dbKey = r.rows?.[0]?.value || '';
    return dbKey || env.GROQ_API_KEY || '';
  } catch {
    return env.GROQ_API_KEY || '';
  }
}

export async function completeText(prompt: string, model: string = 'mixtral-8x7b'): Promise<string> {
  const key = await getGroqApiKey();
  if (!key) return '';
  const res = await fetch('https://api.groq.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({ model, prompt })
  });
  if (!res.ok) return '';
  const data = await res.json();
  return data.choices?.[0]?.text?.trim() ?? '';
}

// Generate a description/text for a prompt (fallback to text if images not available)
export async function generateForPrompt(prompt: string): Promise<{ image_url: string | null; text: string }>{
  const description = await completeText(
    `Create a concise, vivid 1-2 sentence scene description for this creative prompt. Keep it under 220 chars.\nPrompt: ${prompt}`
  )
  return { image_url: null, text: description || `Concept: ${prompt}` }
}

function computeOracleMood(): string {
  // Hourly style variations
  const moods = [
    'prophetic and solemn, with starry metaphors',
    'whimsical and funny, with a wink',
    'dark and ominous, like a storm at sea',
    'cryptic and minimalist, speak in riddles',
    'pragmatic but mystical, concise and kind',
  ]
  const h = new Date().getHours()
  return moods[h % moods.length]
}

export async function askGroq(question: string): Promise<string> {
  const mood = computeOracleMood()
  const prompt = `You are the Internet Oracle. Your current mood is: ${mood}.
Answer in 1-3 sentences, with evocative imagery and a faint glow.
Question: ${question}`
  const text = await completeText(prompt);
  return text || 'The oracle sleeps.';
}

export async function judgePrompts(promptA: string, promptB: string): Promise<{ winner: 'A'|'B'|'tie'; reason: string; source: string; }>{
  const key = await getGroqApiKey();
  if (!key) {
    return { winner: 'tie', reason: 'No AI key configured; call it a draw.', source: 'none' };
  }
  const res = await fetch('https://api.groq.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b',
      prompt: `You are a strict judge. Between Prompt A and Prompt B, pick the better for creativity and engagement. Reply in JSON with keys winner (A|B|tie) and reason.\nPrompt A: ${promptA}\nPrompt B: ${promptB}`
    })
  });
  if (!res.ok) return { winner: 'tie', reason: 'The judge refused to decide.', source: 'groq-error' };
  try {
    const data = await res.json();
    const text: string = data.choices?.[0]?.text ?? '';
    const parsed = JSON.parse(text);
    const winner = parsed.winner === 'A' || parsed.winner === 'B' ? parsed.winner : 'tie';
    return { winner, reason: String(parsed.reason || '').slice(0, 500), source: 'groq' };
  } catch {
    return { winner: 'tie', reason: 'Could not parse AI response.', source: 'groq-parse' };
  }
}
