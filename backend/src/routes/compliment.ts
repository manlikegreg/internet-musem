import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'

const router = express.Router()

// --- SSE state ---
let clients: Response[] = []
let listenerReady = false

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

async function ensureListener() {
  if (listenerReady) return
  const client = await pool.connect()
  await client.query('LISTEN compliment_created')
  await client.query('LISTEN compliment_reacted')
  client.on('notification', (msg) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'compliment_created') broadcast({ type: 'compliment', data })
      if (msg.channel === 'compliment_reacted') broadcast({ type: 'reaction', data })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

function pickAnonymous(): string {
  return `Anonymous ${Math.floor(Math.random() * 1000) + 1}`
}

// --- AI generate ---
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const topic = String((req.body as any)?.topic || '').trim()
    const key = process.env.GROQ_API_KEY
    // Fallback compliments list for when GROQ is not configured
    if (!key || typeof (globalThis as any).fetch !== 'function') {
      const samples = [
        'Your presence makes Wi‑Fi feel stronger.',
        'Your code reads like poetry.',
        'You make debugging look easy.',
        'You bring sunshine to stack traces.',
        'Even your TODOs feel encouraging.',
        'You refactor with kindness.',
        'Your ideas light up the room.',
        'Somewhere, the bugs are afraid of you.',
        'Your pull requests give me hope.',
        'The terminal smiles when you type.'
      ]
      const pick = samples[Math.floor(Math.random() * samples.length)]
      return res.json({ compliment: pick })
    }

    const prompt = `Generate a short, kind, and unique compliment (max 20 words). It should sound natural, not generic.${topic ? ` Topic: ${topic}` : ''}`

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You write wholesome, short, natural compliments that feel human and specific.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 60,
      }),
    })

    if (!r.ok) {
      const text = await r.text().catch(()=> '')
      return res.status(502).json({ error: 'AI generation failed', detail: text.slice(0, 200) })
    }
    const data = await r.json()
    const compliment = data?.choices?.[0]?.message?.content?.trim() || 'You are a bright spot on the internet.'
    res.json({ compliment })
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate compliment' })
  }
})

// --- Create compliment ---
router.post('/create', async (req: Request, res: Response) => {
  try {
    const id = randomUUID()
    const username = String((req.body as any)?.username || '').trim() || pickAnonymous()
    const compliment = String((req.body as any)?.compliment || '').trim()
    if (!compliment) return res.status(400).json({ error: 'compliment is required' })

    await pool.query(
      'INSERT INTO compliments (id, username, compliment) VALUES ($1, $2, $3)',
      [id, username, compliment]
    )

    const r = await pool.query('SELECT * FROM compliments WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('compliment_created', $1)", [JSON.stringify(row)])
    broadcast({ type: 'compliment', data: row })

    res.json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create compliment' })
  }
})

// --- SSE stream ---
router.get('/stream', async (req: Request, res: Response) => {
  await ensureListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)

  try {
    const r = await pool.query('SELECT * FROM compliments ORDER BY created_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

// --- React to a compliment ---
router.post('/react/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const raw = String((req.body as any)?.emoji || '').trim()

    const map: Record<string, string> = {
      '💖': 'heart', 'heart': 'heart',
      '😭': 'cry', 'cry': 'cry',
      '🌈': 'rainbow', 'rainbow': 'rainbow',
      '✨': 'sparkle', 'sparkle': 'sparkle', 'sparkles': 'sparkle'
    }
    const key = map[raw] || raw
    const allowed = new Set(['heart','cry','rainbow','sparkle'])
    if (!allowed.has(key)) return res.status(400).json({ error: 'invalid emoji' })

    await pool.query(
      `UPDATE compliments
       SET reactions = COALESCE(reactions, '{}'::jsonb) || jsonb_build_object($1, COALESCE((reactions->>$1)::int, 0) + 1)
       WHERE id = $2`,
      [key, id]
    )

    const r = await pool.query('SELECT id, reactions FROM compliments WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('compliment_reacted', $1)", [JSON.stringify({ id, reactions: row.reactions })])
    broadcast({ type: 'reaction', data: { id, reactions: row.reactions } })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to react' })
  }
})

export default router
