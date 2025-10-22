import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

// Upload handling for confession audio
const uploadRoot = path.resolve(process.cwd(), 'uploads', 'confession')
try { fs.mkdirSync(uploadRoot, { recursive: true }) } catch {}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const id = randomUUID()
    const ext = (file.mimetype && file.mimetype.split('/')[1]) || 'dat'
    cb(null, `${id}.${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }) // ~25MB

// SSE clients for confession stream
let clients: Response[] = []
let listenerReady = false

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach((c) => c.write(msg))
}

async function ensureListener() {
  if (listenerReady) return
  const client = await pool.connect()
  await client.query('LISTEN confession_new')
  await client.query('LISTEN confession_reaction')
  client.on('notification', (msg) => {
    try {
      const payload = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'confession_new') broadcast({ type: 'new', data: payload })
      if (msg.channel === 'confession_reaction') broadcast({ type: 'reaction', data: payload })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text || '').trim()
    if (!text || text.length > 300) return res.status(400).json({ error: 'text required (max 300)' })
    const id = randomUUID()
    const username = `Anonymous ${Math.floor(Math.random() * 9999) + 1}`
    const r = await pool.query(
      'INSERT INTO confessions_booth (id, username, text) VALUES ($1, $2, $3) RETURNING *',
      [id, username, text]
    )
    const row = r.rows[0]
    await pool.query("SELECT pg_notify('confession_new', $1)", [JSON.stringify(row)])
    broadcast({ type: 'new', data: row })
    res.status(201).json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit confession' })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    const q = String(req.query.q || '').trim()
    let sql = ''
    let params: any[] = []
    if (q && before) {
      sql = 'SELECT * FROM confessions_booth WHERE created_at < $1 AND text ILIKE $2 ORDER BY created_at DESC LIMIT $3'
      params = [before.toISOString(), `%${q}%`, limit]
    } else if (q) {
      sql = 'SELECT * FROM confessions_booth WHERE text ILIKE $1 ORDER BY created_at DESC LIMIT $2'
      params = [`%${q}%`, limit]
    } else if (before) {
      sql = 'SELECT * FROM confessions_booth WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2'
      params = [before.toISOString(), limit]
    } else {
      sql = 'SELECT * FROM confessions_booth ORDER BY created_at DESC LIMIT $1'
      params = [limit]
    }
    const r = await pool.query(sql, params)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

router.get('/stream', async (_req: Request, res: Response) => {
  await ensureListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)

  // Seed last 50 confessions
  try {
    const r = await pool.query('SELECT * FROM confessions_booth ORDER BY created_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  _req.on('close', () => {
    clients = clients.filter((c) => c !== res)
  })
})

router.post('/react/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const emoji = String(req.body?.emoji || '').trim()
    const allowed = ['💔','🙏','😳','😭']
    if (!allowed.includes(emoji)) return res.status(400).json({ error: 'invalid emoji' })

    // Increment reaction count in JSONB
    const sql = `UPDATE confessions_booth
      SET reactions = jsonb_set(COALESCE(reactions, '{}'::jsonb), '{${emoji}}',
        to_jsonb(COALESCE(NULLIF(reactions->>'${emoji}', '')::int, 0) + 1), true)
      WHERE id = $1
      RETURNING *`
    const r = await pool.query(sql, [id])
    const row = r.rows[0]
    if (row) {
      const payload = { id, emoji, reactions: row.reactions }
      await pool.query("SELECT pg_notify('confession_reaction', $1)", [JSON.stringify(payload)])
      broadcast({ type: 'reaction', data: payload })
      return res.json({ ok: true, reactions: row.reactions })
    }
    res.status(404).json({ error: 'not found' })
  } catch (e) {
    res.status(500).json({ error: 'failed to react' })
  }
})

// Audio upload for confession booth
router.post('/audio', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio required' })
    const text = (req.body?.text !== undefined ? String(req.body.text).trim() : '')
    const username = `Anonymous ${Math.floor(Math.random() * 9999) + 1}`
    const id = randomUUID()
    const rel = `/uploads/confession/${req.file.filename}`
    const base = req.protocol + '://' + req.get('host')
    const abs = base + rel
    const result = await pool.query(
      'INSERT INTO confessions_booth (id, username, text, audio_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, username, text, abs]
    )
    const row = result.rows[0]
    await pool.query("SELECT pg_notify('new_confession', $1)", [JSON.stringify(row)])
    res.status(201).json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to upload audio' })
  }
})

export default router
