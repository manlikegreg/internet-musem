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
  await client.query('LISTEN dream_created')
  await client.query('LISTEN dream_interpreted')
  await client.query('LISTEN dream_reacted')
  client.on('notification', (msg) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'dream_created') broadcast({ type: 'dream', data })
      if (msg.channel === 'dream_interpreted') broadcast({ type: 'interpretation', data })
      if (msg.channel === 'dream_reacted') broadcast({ type: 'reaction', data })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

function pickDreamer() {
  return `Anonymous Dreamer #${Math.floor(Math.random() * 1000) + 1}`
}

// --- Create a dream ---
router.post('/create', async (req: Request, res: Response) => {
  try {
    const id = randomUUID()
    const username = pickDreamer()
    const text = String((req.body as any)?.text || '').trim()
    const imageUrl = String((req.body as any)?.imageUrl || '').trim() || null
    if (!text) return res.status(400).json({ error: 'text is required' })

    await pool.query(
      'INSERT INTO dreams (id, username, text, image_url) VALUES ($1, $2, $3, $4)',
      [id, username, text, imageUrl]
    )

    const r = await pool.query('SELECT * FROM dreams WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('dream_created', $1)", [JSON.stringify(row)])
    broadcast({ type: 'dream', data: row })

    res.json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create dream' })
  }
})

// --- Interpret a dream ---
router.post('/interpret/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const interpId = randomUUID()
    const username = `Anonymous #${Math.floor(Math.random() * 1000) + 1}`
    const text = String((req.body as any)?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text is required' })

    const obj = { id: interpId, username, text, created_at: new Date().toISOString() }

    await pool.query(
      `UPDATE dreams
       SET interpretations = COALESCE(interpretations, '[]'::jsonb) || $1::jsonb
       WHERE id = $2`,
      [JSON.stringify([obj]), id]
    )

    const r = await pool.query('SELECT interpretations FROM dreams WHERE id = $1', [id])
    const interpretations = r.rows[0]?.interpretations || []

    await pool.query("SELECT pg_notify('dream_interpreted', $1)", [JSON.stringify({ id, interpretation: obj, interpretations })])
    broadcast({ type: 'interpretation', data: { id, interpretation: obj, interpretations } })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to add interpretation' })
  }
})

// --- React to a dream ---
router.post('/react/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const raw = String((req.body as any)?.emoji || '').trim()

    const map: Record<string, string> = {
      '💭': 'comment', 'comment': 'comment',
      '🔮': 'mystic', 'mystic': 'mystic',
      '🫧': 'bubble', 'bubble': 'bubble',
      '🪶': 'feather', 'feather': 'feather',
    }
    const key = map[raw] || raw
    const allowed = new Set(['comment','mystic','bubble','feather'])
    if (!allowed.has(key)) return res.status(400).json({ error: 'invalid emoji' })

    await pool.query(
      `UPDATE dreams
       SET reactions = COALESCE(reactions, '{}'::jsonb) || jsonb_build_object($1, COALESCE((reactions->>$1)::int, 0) + 1)
       WHERE id = $2`,
      [key, id]
    )

    const r = await pool.query('SELECT id, reactions FROM dreams WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('dream_reacted', $1)", [JSON.stringify({ id, reactions: row.reactions })])
    broadcast({ type: 'reaction', data: { id, reactions: row.reactions } })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to react' })
  }
})

// --- Generate poetic text or image prompt ---
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const text = String((req.body as any)?.text || '').trim()
    const mode = String((req.body as any)?.mode || 'poem')
    const key = process.env.GROQ_API_KEY

    if (!key || typeof (globalThis as any).fetch !== 'function') {
      if (mode === 'prompt') {
        const prompt = `A surreal scene of ${text || 'a drifting city of light'}, painted in indigo and silver, ethereal and quiet.`
        return res.json({ prompt })
      } else {
        const poem = `I dreamed of ${text || 'blue corridors'} and soft electricity. The moon debugged my thoughts, and I woke with code on my hands.`
        return res.json({ text: poem })
      }
    }

    const promptText = mode === 'prompt'
      ? `Write a concise, evocative AI image prompt (max 30 words) for this dream: ${text}. Use colors, atmosphere, and surreal motifs.`
      : `Write a short, poetic dream line (max 50 words), intimate and surreal, inspired by: ${text}.`

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: 'You speak in dreamy, poetic tones — intimate, surreal, and concise.' },
          { role: 'user', content: promptText },
        ],
        temperature: 0.9,
        max_tokens: 120,
      })
    })

    if (!r.ok) {
      const text = await r.text().catch(()=> '')
      return res.status(502).json({ error: 'AI generation failed', detail: text.slice(0, 200) })
    }
    const data = await r.json()
    const content = data?.choices?.[0]?.message?.content?.trim() || ''
    if (mode === 'prompt') return res.json({ prompt: content })
    return res.json({ text: content })
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate dream content' })
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
    const r = await pool.query('SELECT * FROM dreams ORDER BY created_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

export default router
