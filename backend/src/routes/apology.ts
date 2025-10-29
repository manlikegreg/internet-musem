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
  await client.query('LISTEN apology_created')
  await client.query('LISTEN apology_reacted')
  client.on('notification', (msg: any) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'apology_created') broadcast({ type: 'apology', data })
      if (msg.channel === 'apology_reacted') broadcast({ type: 'reaction', data })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

// --- Helpers ---
function pickAnonymous(): string {
  return `Anonymous ${Math.floor(Math.random() * 1000) + 1}`
}

const ALLOWED_REACTIONS = new Set(['heart', 'laugh', 'fire', 'cry'])

// --- Routes ---
// AI generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const name = String((req.body as any)?.name || '').trim() || 'Anonymous'
    const incident = String((req.body as any)?.incident || '').trim()
    const remixWith = String((req.body as any)?.remixWith || '').trim()

    const prompt = remixWith
      ? `Rewrite and escalate this public apology into a satirical sequel. Keep it formal but even more dramatic and self-serious.\n\nOriginal apology:\n${remixWith}`
      : `Write a formal, overly dramatic public apology for the following incident. It should sound like a social media statement from a public figure. Include one or two lines that show self-reflection.\n\nName: ${name}\nIncident: ${incident}`

    const key = process.env.GROQ_API_KEY
    if (!key || typeof (globalThis as any).fetch !== 'function') {
      // Fallback local template if no AI key configured or fetch not available
      const who = name || 'Anonymous'
      const inc = incident ? ` regarding ${incident}` : ''
      const fallback = `I want to take a moment to sincerely apologize for my recent actions${inc}. I understand the impact they had and the disappointment they caused. I take full responsibility, and I am committed to listening, learning, and doing better. This is not who I strive to be, and I will work to regain your trust.`
      return res.json({ apology: fallback })
    }

    // Groq OpenAI-compatible chat completions
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a witty publicist who writes overly dramatic, humorous public apologies that feel like formal social media statements.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 280,
      }),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return res.status(502).json({ error: 'AI generation failed', detail: text.slice(0, 200) })
    }
    const data = await r.json()
    const apology = data?.choices?.[0]?.message?.content?.trim() || 'I take full responsibility for my actions and I am listening and learning.'
    res.json({ apology })
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate apology' })
  }
})

// Create
router.post('/create', async (req: Request, res: Response) => {
  try {
    const id = randomUUID()
    const username = String((req.body as any)?.username || '').trim() || pickAnonymous()
    const apology = String((req.body as any)?.apology || '').trim()
    let reactions: any = (req.body as any)?.reactions
    if (!apology) return res.status(400).json({ error: 'apology is required' })
    if (!reactions || typeof reactions !== 'object') reactions = {}

    await pool.query(
      'INSERT INTO apologies (id, username, apology, reactions) VALUES ($1, $2, $3, $4)',
      [id, username, apology, JSON.stringify(reactions)]
    )

    const r = await pool.query('SELECT * FROM apologies WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('apology_created', $1)", [JSON.stringify(row)])
    broadcast({ type: 'apology', data: row })

    res.json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create apology' })
  }
})

// React
router.post('/react/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const raw = String((req.body as any)?.emoji || '').trim()

    // Map emoji to keys
    const map: Record<string, string> = {
      '❤️': 'heart', 'heart': 'heart',
      '😂': 'laugh', 'joy': 'laugh', 'laugh': 'laugh',
      '🔥': 'fire', 'fire': 'fire',
      '😭': 'cry', 'cry': 'cry'
    }
    const key = map[raw] || raw
    if (!ALLOWED_REACTIONS.has(key)) return res.status(400).json({ error: 'invalid emoji' })

    // Update atomically
    await pool.query(
      `UPDATE apologies
       SET reactions = COALESCE(reactions, '{}'::jsonb) || jsonb_build_object($1, COALESCE((reactions->>$1)::int, 0) + 1)
       WHERE id = $2`,
      [key, id]
    )

    const r = await pool.query('SELECT * FROM apologies WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('apology_reacted', $1)", [JSON.stringify({ id, reactions: row.reactions })])
    broadcast({ type: 'reaction', data: { id, reactions: row.reactions } })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to react' })
  }
})

// SSE stream
router.get('/stream', async (req: Request, res: Response) => {
  await ensureListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)

  try {
    const r = await pool.query('SELECT * FROM apologies ORDER BY created_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

export default router
