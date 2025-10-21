import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

let clients: Response[] = []
let listenerReady = false

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

async function ensureListener() {
  if (listenerReady) return
  const client = await pool.connect()
  await client.query('LISTEN capsule_opened')
  await client.query('LISTEN capsule_sealed')
  client.on('notification', (msg) => {
    try {
      const data = msg.payload ? JSON.parse(msg.payload) : null
      if (msg.channel === 'capsule_opened') broadcast({ type: 'opened', data })
      if (msg.channel === 'capsule_sealed') broadcast({ type: 'sealed', data })
    } catch {}
  })
  client.on('error', () => {})
  listenerReady = true
}

// Upload handling
const uploadRoot = path.resolve(process.cwd(), 'uploads', 'capsules')
try { fs.mkdirSync(uploadRoot, { recursive: true }) } catch {}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const id = randomUUID()
    const ext = (((file.mimetype || '').split('/')[1]) || 'dat').split(';')[0]
    cb(null, `${id}.${ext}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } })

router.post('/create', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const username = `Timekeeper ${Math.floor(Math.random() * 9999) + 1}`
    const id = randomUUID()
    let message = ''
    let unlockAt = ''
    let mediaUrl: string | null = null

    if (req.is('multipart/form-data')) {
      message = String(req.body?.message || '').trim()
      unlockAt = String(req.body?.unlockAt || '').trim()
      if (req.file) mediaUrl = `/uploads/capsules/${req.file.filename}`
    } else {
      message = String((req.body as any)?.message || '').trim()
      unlockAt = String((req.body as any)?.unlockAt || '').trim()
      mediaUrl = String((req.body as any)?.mediaUrl || '').trim() || null
    }

    if (!unlockAt) return res.status(400).json({ error: 'unlockAt required' })
    const unlockDate = new Date(unlockAt)
    if (isNaN(unlockDate.getTime())) return res.status(400).json({ error: 'invalid unlockAt' })

    const now = Date.now()
    const status = unlockDate.getTime() <= now ? 'opened' : 'sealed'

    await pool.query(
      'INSERT INTO capsules (id, username, message, media_url, unlock_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, message || null, mediaUrl, unlockDate.toISOString(), status]
    )

    const r = await pool.query('SELECT * FROM capsules WHERE id = $1', [id])
    const row = r.rows[0]

    if (status === 'opened') {
      await pool.query("SELECT pg_notify('capsule_opened', $1)", [JSON.stringify(row)])
      broadcast({ type: 'opened', data: row })
    } else {
      await pool.query("SELECT pg_notify('capsule_sealed', $1)", [JSON.stringify(row)])
      broadcast({ type: 'sealed', data: row })
    }

    res.json({ id, username, message, media_url: mediaUrl, unlock_at: unlockDate.toISOString(), status })
  } catch (e) {
    res.status(500).json({ error: 'Failed to create capsule' })
  }
})

router.get('/opened', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const r = await pool.query('SELECT * FROM capsules WHERE status = \'opened\' ORDER BY unlock_at DESC LIMIT $1', [limit])
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

router.get('/sealed', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    // Show soonest to unlock first
    const r = await pool.query('SELECT * FROM capsules WHERE status = \'sealed\' ORDER BY unlock_at ASC LIMIT $1', [limit])
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

router.get('/stream', async (req: Request, res: Response) => {
  await ensureListener()
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)

  try {
    const r = await pool.query('SELECT * FROM capsules WHERE status = \'opened\' ORDER BY unlock_at DESC LIMIT 50')
    res.write(`data: ${JSON.stringify({ type: 'seed', data: r.rows })}\n\n`)
  } catch {}

  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

export default router
