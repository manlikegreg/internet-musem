import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'
import { askGroq } from '../utils/groqClient'

const router = express.Router()

let clients: Response[] = []
let listener = false

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

async function ensureListener() {
  if (listener) return
  const client = await pool.connect()
  await client.query('LISTEN oracle_question')
  await client.query('LISTEN oracle_reply')
  client.on('notification', (msg: any) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'oracle_question') broadcast({ type: 'question', data })
      if (msg.channel === 'oracle_reply') broadcast({ type: 'reply', data })
    } catch {}
  })
  client.on('error', () => {})
  listener = true
}

// Seed recent questions with replies
router.get('/questions', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const r = await pool.query(`
      SELECT q.*, COALESCE((
        SELECT json_agg(r ORDER BY r.created_at ASC)
        FROM oracle_replies r WHERE r.question_id = q.id
      ), '[]') as replies
      FROM oracle_questions q
      ORDER BY q.created_at DESC
      LIMIT $1
    `, [limit])
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

// Single question with replies
router.get('/questions/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const r = await pool.query(`
      SELECT q.*, COALESCE((
        SELECT json_agg(r ORDER BY r.created_at ASC)
        FROM oracle_replies r WHERE r.question_id = q.id
      ), '[]') as replies
      FROM oracle_questions q
      WHERE q.id = $1
      LIMIT 1
    `, [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json(r.rows[0])
  } catch (e) {
    res.status(500).json({ error: 'failed' })
  }
})

// Ask a question
router.post('/question', async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text required' })
    const id = randomUUID()
    const username = `Seeker ${Math.floor(Math.random() * 9999) + 1}`
    const q = await pool.query('INSERT INTO oracle_questions (id, username, question) VALUES ($1, $2, $3) RETURNING *', [id, username, text])
    // Generate answer
    const answer = await askGroq(text)
    await pool.query('UPDATE oracle_questions SET answer=$1 WHERE id=$2', [answer, id])
    const full = { ...q.rows[0], answer }
    await pool.query("SELECT pg_notify('oracle_question', $1)", [JSON.stringify(full)])
    broadcast({ type: 'question', data: full })
    res.json(full)
  } catch (e) {
    res.status(500).json({ error: 'Failed to ask the oracle' })
  }
})

// Reply to a question
router.post('/reply', async (req: Request, res: Response) => {
  try {
    const questionId = String(req.body?.questionId || '')
    const text = String(req.body?.text || '').trim()
    if (!questionId || !text) return res.status(400).json({ error: 'questionId and text required' })
    const id = randomUUID()
    const username = `Voice ${Math.floor(Math.random() * 9999) + 1}`
    const r = await pool.query('INSERT INTO oracle_replies (id, question_id, username, reply) VALUES ($1, $2, $3, $4) RETURNING *', [id, questionId, username, text])
    const row = r.rows[0]
    await pool.query("SELECT pg_notify('oracle_reply', $1)", [JSON.stringify(row)])
    broadcast({ type: 'reply', data: row })
    res.json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to reply' })
  }
})

// SSE stream
router.get('/stream', async (req: Request, res: Response) => {
  await ensureListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)
  // Seed last 50
  try {
    const r = await pool.query(`
      SELECT q.*, COALESCE((
        SELECT json_agg(r ORDER BY r.created_at ASC)
        FROM oracle_replies r WHERE r.question_id = q.id
      ), '[]') as replies
      FROM oracle_questions q
      ORDER BY q.created_at DESC
      LIMIT 50
    `)
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}
  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

// Back-compat route for older oracle ask
router.post('/', async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.question || req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'question required' })
    const answer = await askGroq(text)
    res.json({ question: text, response: answer, source: 'groq' })
  } catch (e) {
    res.status(500).json({ error: 'Oracle failed' })
  }
})

export default router
