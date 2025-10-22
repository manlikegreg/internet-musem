import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

// In-memory SSE clients
let clients: Response[] = []
let voidListenerReady = false
let voidListenerClient: any = null

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

// Upload handling
const uploadRoot = path.resolve(process.cwd(), 'uploads', 'void')
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

async function ensureVoidListener() {
  if (voidListenerReady) return
  try {
    const client = await pool.connect()
    voidListenerClient = client
    await client.query('LISTEN new_void')
    client.on('notification', (msg: any) => {
      try {
        const data = msg.payload ? JSON.parse(msg.payload) : null
        if (msg.channel === 'new_void') broadcast({ type: 'void', data })
      } catch {}
    })
    client.on('error', (_err: any) => {
      voidListenerReady = false
      try { client.release?.() } catch {}
      setTimeout(() => { ensureVoidListener().catch(() => {}) }, 1000)
    })
    client.on('end', () => {
      voidListenerReady = false
      setTimeout(() => { ensureVoidListener().catch(() => {}) }, 1000)
    })
    voidListenerReady = true
  } catch (_err) {
    voidListenerReady = false
    setTimeout(() => { ensureVoidListener().catch(() => {}) }, 1000)
  }
}

// Optional: list recent for persistence across refresh and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    const sql = before
      ? 'SELECT * FROM void_stream_messages WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2'
      : 'SELECT * FROM void_stream_messages ORDER BY created_at DESC LIMIT $1'
    const params = before ? [before.toISOString(), limit] : [limit]
    const r = await pool.query(sql, params as any)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text ?? req.body?.content ?? '').trim()
    if (!text || text.length > 200) return res.status(400).json({ error: 'text required (max 200)' })
    const username = `Anonymous ${Math.floor(Math.random() * 9999) + 1}`
    const id = randomUUID()
    const result = await pool.query(
      'INSERT INTO void_stream_messages (id, username, text) VALUES ($1, $2, $3) RETURNING *',
      [id, username, text]
    )
    const row = result.rows[0]
    await pool.query("SELECT pg_notify('new_void', $1)", [JSON.stringify(row)])
    broadcast({ type: 'void', data: row })
    res.status(201).json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to scream into the void' })
  }
})

// Audio upload (max ~3 minutes; enforced by client, ~25MB server limit)
router.post('/audio', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio required' })
    const text = (req.body?.text !== undefined ? String(req.body.text).trim() : '')
    const username = `Anonymous ${Math.floor(Math.random() * 9999) + 1}`
    const id = randomUUID()
    const rel = `/uploads/void/${req.file.filename}`
    const base = req.protocol + '://' + req.get('host')
    const abs = base + rel
    const result = await pool.query(
      'INSERT INTO void_stream_messages (id, username, text, audio_url) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, username, text, abs]
    )
    const row = result.rows[0]
    await pool.query("SELECT pg_notify('new_void', $1)", [JSON.stringify(row)])
    broadcast({ type: 'void', data: row })
    res.status(201).json(row)
  } catch (e) {
    res.status(500).json({ error: 'Failed to upload audio' })
  }
})

router.get('/stream', async (req: Request, res: Response) => {
  await ensureVoidListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)

  // Seed recent messages
  try {
    const r = await pool.query('SELECT * FROM void_stream_messages ORDER BY created_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => {
    clients = clients.filter(c => c !== res)
  })
})

export default router
