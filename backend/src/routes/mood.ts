import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'

const router = express.Router()

// SSE clients
let clients: Response[] = []
let listenerReady = false

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

function sentimentFromEmoji(emoji: string): number {
  const map: Record<string, number> = {
    '😄': 4, '😢': -4, '😡': -4, '😴': -1,
    '😍': 5, '😐': 0,  '😭': -5, '🤩': 4,
    '🤔': -1,
  }
  return map[emoji] ?? 0
}

async function ensureListener() {
  if (listenerReady) return
  const client = await pool.connect()
  await client.query('LISTEN mood_created')
  client.on('notification', (msg) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'mood_created') broadcast({ type: 'mood', data })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

function pickUser() { return `Anonymous #${Math.floor(Math.random() * 1000) + 1}` }

// Create mood
router.post('/create', async (req: Request, res: Response) => {
  try {
    const id = randomUUID()
    const username = pickUser()
    const emoji = String((req.body as any)?.emoji || '').trim()
    const text = String((req.body as any)?.text || '').trim() || null
    if (!emoji) return res.status(400).json({ error: 'emoji is required' })
    const sentiment = sentimentFromEmoji(emoji)

    await pool.query(
      'INSERT INTO moods (id, username, emoji, text, sentiment) VALUES ($1, $2, $3, $4, $5)',
      [id, username, emoji, text, sentiment]
    )

    const r = await pool.query('SELECT * FROM moods WHERE id = $1', [id])
    const row = r.rows[0]

    await pool.query("SELECT pg_notify('mood_created', $1)", [JSON.stringify(row)])
    broadcast({ type: 'mood', data: row })

    res.json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create mood' })
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
    const r = await pool.query('SELECT * FROM moods ORDER BY created_at DESC LIMIT 100')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

// Average sentiment (last 200)
router.get('/average', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT AVG(sentiment)::float AS avg, COUNT(*) AS count FROM (SELECT sentiment FROM moods ORDER BY created_at DESC LIMIT 200) t')
    const avg = r.rows?.[0]?.avg ?? 0
    const count = Number(r.rows?.[0]?.count || 0)
    res.json({ average: avg, sample: count })
  } catch (e) {
    res.status(500).json({ average: 0, sample: 0 })
  }
})

export default router
