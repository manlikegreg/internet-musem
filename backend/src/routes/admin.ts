import express, { Request, Response, NextFunction } from 'express'
import { pool } from '../config/db'
import { env } from '../config/env'
import { getGroqApiKey, completeText } from '../utils/groqClient'

const router = express.Router()

// Admin auth and login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const password = String((req.body as any)?.password || '').trim()
    const expected = await getAdminToken()
    if (!expected) return res.json({ ok: true, mode: 'open' })
    if (!password) return res.status(400).json({ error: 'password required' })
    if (password !== expected) return res.status(401).json({ error: 'Invalid password' })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to login' })
  }
})

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = await getAdminToken()
  if (!expected) return next()
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  if (token && token === expected) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

router.use(requireAdmin as any)

// Summarize counts per table
router.get('/stats', async (_req, res) => {
  try {
    const tables = [
      'graveyard','confessions_booth','void_stream_messages','prompt_battles','oracle_questions','capsules','apologies','compliments',
      'dream_archive','mood_mirror_readings'
    ]
    const out: Record<string, number> = {}
    for (const t of tables) {
      try {
        const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`)
        out[t] = r.rows[0]?.c ?? 0
      } catch {
        out[t] = 0
      }
    }
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// Purge data by table and time range
router.post('/purge', async (req, res) => {
  try {
    const { table, range, customInterval, since, until } = req.body as { table: string, range?: string, customInterval?: string, since?: string, until?: string }
    const allowed: Record<string,string> = {
      graveyard:'graveyard', confessions_booth:'confessions_booth', void_stream_messages:'void_stream_messages', prompt_battles:'prompt_battles', oracle_questions:'oracle_questions', capsules:'capsules', apologies:'apologies', compliments:'compliments', dream_archive:'dream_archive', mood_mirror_readings:'mood_mirror_readings'
    }
    const t = allowed[table]
    if (!t) return res.status(400).json({ error: 'Invalid table' })

    function normalizeInterval(input: string): string | null {
      const s = String(input).trim().toLowerCase()
      // Accept forms like "18 months", "5 years", or short forms like 90d, 36h, 2w, 3m, 5y
      const m = s.match(/^(\d+)\s*(h|d|w|m|y|hours?|days?|weeks?|months?|years?)$/)
      if (!m) return null
      const n = m[1]
      let unit = m[2]
      const map: Record<string,string> = {
        h:'hours', hour:'hours', hours:'hours',
        d:'days', day:'days', days:'days',
        w:'weeks', week:'weeks', weeks:'weeks',
        m:'months', month:'months', months:'months',
        y:'years', year:'years', years:'years'
      }
      unit = map[unit] || unit
      return `${n} ${unit}`
    }

    let sql = ''
    let params: any[] = []

    if (!range || range === 'all') {
      if (since || until) {
        // Delete within a custom time window
        if (since && until) {
          sql = `DELETE FROM ${t} WHERE created_at BETWEEN $1 AND $2`
          params = [since, until]
        } else if (since) {
          sql = `DELETE FROM ${t} WHERE created_at >= $1`
          params = [since]
        } else if (until) {
          sql = `DELETE FROM ${t} WHERE created_at <= $1`
          params = [until]
        } else {
          sql = `DELETE FROM ${t}`
        }
      } else if (customInterval) {
        const iv = normalizeInterval(customInterval)
        if (!iv) return res.status(400).json({ error: 'Invalid customInterval format' })
        sql = `DELETE FROM ${t} WHERE created_at >= NOW() - INTERVAL '${iv}'`
      } else if (range === 'all') {
        sql = `DELETE FROM ${t}`
      } else {
        sql = `DELETE FROM ${t}`
      }
    } else {
      const map: Record<string,string> = { '3h':'3 hours', '3d':'3 days', '2w':'2 weeks', '1y':'1 year', '2y':'2 years', '3y':'3 years', '5y':'5 years', '10y':'10 years' }
      if (range === 'custom') {
        if (!customInterval) return res.status(400).json({ error: 'customInterval required when range=custom' })
        const iv = normalizeInterval(customInterval)
        if (!iv) return res.status(400).json({ error: 'Invalid customInterval format' })
        sql = `DELETE FROM ${t} WHERE created_at >= NOW() - INTERVAL '${iv}'`
      } else {
        const iv = map[range]
        if (!iv) return res.status(400).json({ error: 'Invalid range' })
        sql = `DELETE FROM ${t} WHERE created_at >= NOW() - INTERVAL '${iv}'`
      }
    }

    const r = await pool.query(sql + (params.length ? '' : ' RETURNING 1'), params)
    res.json({ ok: true, deleted: params.length ? r.rowCount : r.rowCount })
  } catch (e) {
    res.status(500).json({ error: 'Failed to purge' })
  }
})

// Groq models list
router.get('/groq/models', async (_req, res) => {
  try {
    if (!env.ADMIN_TOKEN) return res.status(403).json({ error: 'ADMIN_TOKEN not set' })
    const key = await getGroqApiKey()
    const fallback = ['mixtral-8x7b','llama3-8b','llama3-70b','gpt-image-1']
    if (!key) return res.json({ models: fallback, note: 'No GROQ key configured; returning defaults' })
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } })
      if (!r.ok) return res.json({ models: fallback, note: 'Could not fetch models; using defaults' })
      const data = await r.json() as any
      const names = Array.isArray(data?.data) ? data.data.map((m: any) => m.id).slice(0, 100) : fallback
      res.json({ models: names })
    } catch {
      res.json({ models: fallback, note: 'Network error; using defaults' })
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to load models' })
  }
})

// Groq test connection
router.post('/groq/test', async (req, res) => {
  try {
    const { model = 'mixtral-8x7b', prompt = 'Hello from Internet Museum' } = req.body || {}
    const key = await getGroqApiKey()
    if (!key) return res.status(400).json({ ok: false, error: 'No GROQ API key configured' })
    const text = await completeText(prompt, model)
    res.json({ ok: !!text, model, sample: text || null })
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to contact Groq' })
  }
})

// Groq API key config endpoints
router.get('/config/groq', async (_req, res) => {
  try {
    const r = await pool.query("SELECT value FROM site_config WHERE key='GROQ_API_KEY' LIMIT 1")
    res.json({ configured: r.rows.length > 0 && !!r.rows[0].value })
  } catch {
    res.json({ configured: false })
  }
})

router.post('/config/groq', async (req, res) => {
  try {
    const { key } = req.body || {}
    if (!key || typeof key !== 'string' || key.trim().length < 10) return res.status(400).json({ error: 'Invalid API key' })
    await pool.query("INSERT INTO site_config (key, value) VALUES ('GROQ_API_KEY', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key.trim()])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to save key' })
  }
})

// Data explorer endpoints
router.get('/data/void', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
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

router.get('/data/confessions', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    const sql = before
      ? 'SELECT * FROM confessions_booth WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2'
      : 'SELECT * FROM confessions_booth ORDER BY created_at DESC LIMIT $1'
    const params = before ? [before.toISOString(), limit] : [limit]
    const r = await pool.query(sql, params as any)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

// Generic data endpoint for multiple rooms/tables
router.get('/data', async (req, res) => {
  try {
    const table = String(req.query.table || '').trim()
    const allowed: Record<string,string> = {
      void:'void_stream_messages',
      confessions:'confessions_booth',
      graveyard:'graveyard',
      battles:'battles',
      prompts:'prompts',
      prompt_battles:'prompt_battles',
      oracle:'oracle_requests',
      oracle_questions:'oracle_questions',
      oracle_replies:'oracle_replies',
      timecapsule:'time_capsules',
      apologies:'apologies',
      compliments:'compliments',
      dreams:'dream_archive',
      mood_mirror:'mood_mirror_readings'
    }
    const t = allowed[table]
    if (!t) return res.status(400).json({ error: 'Invalid table' })
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500)
    const before = req.query.before ? new Date(String(req.query.before)) : null
    const sql = before
      ? `SELECT * FROM ${t} WHERE created_at < $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM ${t} ORDER BY created_at DESC LIMIT $1`
    const params = before ? [before.toISOString(), limit] : [limit]
    const r = await pool.query(sql, params as any)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

// Echo settings (admin)
router.get('/config/echo', async (_req, res) => {
  try {
    const rows = await pool.query("SELECT key, value FROM site_config WHERE key IN ('ECHO_VOID_DELAY','ECHO_VOID_FEEDBACK','ECHO_VOID_DECAY','ECHO_CONF_DELAY','ECHO_CONF_FEEDBACK','ECHO_CONF_DECAY')")
    const map = Object.fromEntries(rows.rows.map((r:any)=>[r.key, r.value]))
    const num = (k:string,d:number)=> (map[k]!==undefined ? Number(map[k]) : d)
    res.json({
      void: { delay: num('ECHO_VOID_DELAY', 0.22), feedback: num('ECHO_VOID_FEEDBACK', 0.35), decay: num('ECHO_VOID_DECAY', 1.0) },
      confession: { delay: num('ECHO_CONF_DELAY', 0.38), feedback: num('ECHO_CONF_FEEDBACK', 0.55), decay: num('ECHO_CONF_DECAY', 2.3) }
    })
  } catch (e) {
    res.status(500).json({ void: { delay: 0.22, feedback: 0.35, decay: 1.0 }, confession: { delay: 0.38, feedback: 0.55, decay: 2.3 } })
  }
})

router.post('/config/echo', async (req, res) => {
  try {
    const { void: v, confession: c } = req.body || {}
    const pairs: [string, any][] = []
    const clamp = (x:any, min:number, max:number, d:number) => {
      const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
    }
    if (v) {
      pairs.push(['ECHO_VOID_DELAY', clamp(v.delay, 0.05, 1.0, 0.22)])
      pairs.push(['ECHO_VOID_FEEDBACK', clamp(v.feedback, 0.0, 0.95, 0.35)])
      pairs.push(['ECHO_VOID_DECAY', clamp(v.decay, 0.5, 5.0, 1.0)])
    }
    if (c) {
      pairs.push(['ECHO_CONF_DELAY', clamp(c.delay, 0.05, 1.5, 0.38)])
      pairs.push(['ECHO_CONF_FEEDBACK', clamp(c.feedback, 0.0, 0.95, 0.55)])
      pairs.push(['ECHO_CONF_DECAY', clamp(c.decay, 0.5, 6.0, 2.3)])
    }
    for (const [k, v] of pairs) {
      await pool.query("INSERT INTO site_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, String(v)])
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to save echo settings' })
  }
})

// Ambient sound settings
router.get('/config/ambient', async (_req, res) => {
  try {
    const r = await pool.query("SELECT value FROM site_config WHERE key='AMBIENT_SOUND_URL' LIMIT 1")
    res.json({ url: r.rows.length > 0 ? r.rows[0].value : null })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch ambient sound settings' })
  }
})

import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/ambient')
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    // Use timestamp + original extension for unique filename
    const ext = path.extname(file.originalname)
    cb(null, `ambient_sound_${Date.now()}${ext}`)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    // Accept only audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Only audio files are allowed'))
    }
  }
})

router.post('/config/ambient', upload.single('sound'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    // Create URL for the uploaded file
    const baseUrl = req.protocol + '://' + req.get('host')
    const relativePath = '/uploads/ambient/' + path.basename(req.file.path)
    const fileUrl = baseUrl + relativePath

    // Save URL to database
    await pool.query(
      "INSERT INTO site_config (key, value) VALUES ('AMBIENT_SOUND_URL', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", 
      [fileUrl]
    )

    res.json({ 
      ok: true, 
      url: fileUrl
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to upload ambient sound' })
  }
})

// Social & Support links config
router.get('/config/links', async (_req, res) => {
  try {
    const keys = ['KOFI_URL','CONTACT_WHATSAPP','CONTACT_TELEGRAM','CONTACT_TIKTOK']
    const r = await pool.query("SELECT key, value FROM site_config WHERE key = ANY($1)", [keys])
    const map: Record<string,string> = {}
    for (const row of r.rows) { map[row.key] = row.value }
    res.json({
      kofi: map['KOFI_URL'] || 'https://ko-fi.com/its_simon_only',
      whatsapp: map['CONTACT_WHATSAPP'] || '',
      telegram: map['CONTACT_TELEGRAM'] || '',
      tiktok: map['CONTACT_TIKTOK'] || ''
    })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch links config' })
  }
})

router.post('/config/links', async (req, res) => {
  try {
    const { kofi, whatsapp, telegram, tiktok } = req.body || {}
    const pairs: Array<[string,string]> = []
    if (typeof kofi === 'string' && kofi.trim()) pairs.push(['KOFI_URL', kofi.trim()])
    if (typeof whatsapp === 'string') pairs.push(['CONTACT_WHATSAPP', whatsapp.trim()])
    if (typeof telegram === 'string') pairs.push(['CONTACT_TELEGRAM', telegram.trim()])
    if (typeof tiktok === 'string') pairs.push(['CONTACT_TIKTOK', tiktok.trim()])
    for (const [k,v] of pairs) {
      await pool.query("INSERT INTO site_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [k, v])
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to save links config' })
  }
})

export default router

async function getAdminToken(): Promise<string> {
  try {
    const r = await pool.query("SELECT value FROM site_config WHERE key='ADMIN_TOKEN' LIMIT 1")
    const dbTok = r.rows?.[0]?.value || ''
    return dbTok || env.ADMIN_TOKEN || ''
  } catch {
    return env.ADMIN_TOKEN || ''
  }
}
router.get('/config/admin', async (_req, res) => {
  try {
    const t = await getAdminToken()
    res.json({ configured: !!t })
  } catch {
    res.json({ configured: false })
  }
})

router.post('/config/admin', async (req, res) => {
  try {
    const { token } = req.body || {}
    const v = String(token || '').trim()
    if (!v || v.length < 4) return res.status(400).json({ error: 'Invalid password' })
    await pool.query("INSERT INTO site_config (key, value) VALUES ('ADMIN_TOKEN', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [v])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to update admin password' })
  }
})
