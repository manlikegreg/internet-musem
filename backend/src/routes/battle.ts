import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { generateForPrompt, getGroqApiKey } from '../utils/groqClient'
import { env } from '../config/env'

const router = express.Router()
let clients: Response[] = []

// --- In-memory rooms (multiplayer lobby) ---
interface RoomUser { username: string; ready: boolean }
interface Room {
  id: string
  name: string
  users: Map<string, RoomUser>
  createdAt: number
  capacity: number
  countdown?: { seconds: number; endsAt: number } | null
  timer?: NodeJS.Timeout | null
}
const rooms = new Map<string, Room>()

function roomToJSON(r: Room) {
  const users = Array.from(r.users.values())
  const remaining = r.countdown ? Math.max(0, Math.ceil((r.countdown.endsAt - Date.now()) / 1000)) : 0
  return {
    id: r.id,
    name: r.name,
    users,
    readyCount: users.filter(u => u.ready).length,
    total: users.length,
    capacity: r.capacity,
    countdown: r.countdown ? { seconds: remaining } : null,
    createdAt: r.createdAt,
  }
}

function broadcastRoomsList() {
  const list = Array.from(rooms.values()).map(roomToJSON)
  broadcast({ type: 'rooms', data: list })
}

function startCountdown(r: Room, seconds = 5) {
  if (r.countdown || r.timer) return
  r.countdown = { seconds, endsAt: Date.now() + seconds * 1000 }
  broadcast({ type: 'room', data: roomToJSON(r) })
  r.timer = setInterval(() => {
    const remain = r.countdown ? Math.ceil((r.countdown.endsAt - Date.now()) / 1000) : 0
    if (remain <= 0) {
      if (r.timer) clearInterval(r.timer)
      r.timer = null
      r.countdown = null
      // Countdown finished — notify clients to start
      broadcast({ type: 'room_start', data: { id: r.id } })
    } else {
      broadcast({ type: 'room', data: roomToJSON(r) })
    }
  }, 1000)
}

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

async function groqGenerateImage(prompt: string): Promise<string | null> {
  try {
    const key = await getGroqApiKey()
    if (!key) return null
    const res = await fetch('https://api.groq.com/openai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '512x512' })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.[0]?.url || null
  } catch {
    return null
  }
}

async function enrichBattle(battle: any) {
  const r = await pool.query(
    `SELECT b.*, pa.text AS a_text, pa.image_url AS a_image_url, pb.text AS b_text, pb.image_url AS b_image_url
     FROM battles b
     JOIN prompts pa ON pa.id = b.prompt_a_id
     JOIN prompts pb ON pb.id = b.prompt_b_id
     WHERE b.id = $1`, [battle.id]
  )
  return r.rows[0] || battle
}

router.post('/prompts', async (req: Request, res: Response) => {
  try {
    const { text, username } = req.body || {}
    const user = username?.trim() || `Anonymous User #${Math.floor(Math.random() * 9999)}`
    if (!text || String(text).trim().length === 0) return res.status(400).json({ error: 'text required' })

    // Try image first; fallback to text-only generation
    const imageUrl = await groqGenerateImage(text)
    let ai_text: string | null = null
    if (!imageUrl) {
      const fallback = await generateForPrompt(text)
      ai_text = fallback.text
    }

    const result = await pool.query(
      'INSERT INTO prompts (username, text, image_url, ai_text) VALUES ($1, $2, $3, $4) RETURNING *',
      [user, text, imageUrl, ai_text]
    )
    const prompt = result.rows[0]

    // Try to pair with a random other prompt not used in an active battle
    const pending = await pool.query(
      `SELECT p.* FROM prompts p
       WHERE p.id <> $1 AND NOT EXISTS (
         SELECT 1 FROM battles b WHERE (b.prompt_a_id = p.id OR b.prompt_b_id = p.id) AND b.active = TRUE
       ) ORDER BY RANDOM() LIMIT 1`,
      [prompt.id]
    )

    if (pending.rows.length > 0) {
      const opponent = pending.rows[0]
      const battleRes = await pool.query(
        'INSERT INTO battles (prompt_a_id, prompt_b_id) VALUES ($1, $2) RETURNING *',
        [prompt.id, opponent.id]
      )
      const battle = await enrichBattle(battleRes.rows[0])
      broadcast({ type: 'battle', data: battle })
    } else {
      broadcast({ type: 'prompt', data: prompt })
    }

    res.status(201).json(prompt)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create prompt' })
  }
})

router.get('/active', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query('SELECT id FROM battles WHERE active = TRUE ORDER BY id DESC LIMIT 20')
    const out = [] as any[]
    for (const row of r.rows) {
      out.push(await enrichBattle(row))
    }
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch active battles' })
  }
})

router.post('/vote/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const choice = (req.body?.choice || '').toLowerCase() === 'a' ? 'a' : 'b'
    const field = choice === 'a' ? 'votes_a' : 'votes_b'
    const r = await pool.query(`UPDATE battles SET ${field} = ${field} + 1 WHERE id = $1 RETURNING *`, [id])
    const updated = r.rows[0]
    if (updated) {
      const enr = await enrichBattle(updated)
      broadcast({ type: 'vote', data: enr })
      res.json(enr)
    } else {
      res.json(updated)
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to vote' })
  }
})

router.get('/stream', (req: Request, res: Response) => {
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)
  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

// --- Rooms API ---
router.get('/rooms', (_req: Request, res: Response) => {
  try {
    res.json(Array.from(rooms.values()).map(roomToJSON))
  } catch { res.json([]) }
})

router.get('/rooms/:id', (req: Request, res: Response) => {
  const r = rooms.get(String(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  res.json(roomToJSON(r))
})

router.post('/rooms', (req: Request, res: Response) => {
  try {
    const { name, username, capacity } = req.body || {}
    const id = Math.floor(100000 + Math.random() * 900000).toString()
    const cap = Math.max(2, Number(capacity) || 2)
    const room: Room = { id, name: (name || 'Battle Room'), users: new Map(), createdAt: Date.now(), capacity: cap, countdown: null, timer: null }
    if (username) room.users.set(String(username), { username: String(username), ready: false })
    rooms.set(id, room)
    broadcastRoomsList()
    broadcast({ type: 'room', data: roomToJSON(room) })
    res.status(201).json(roomToJSON(room))
  } catch {
    res.status(500).json({ error: 'Failed to create room' })
  }
})

router.post('/rooms/:id/join', (req: Request, res: Response) => {
  const r = rooms.get(String(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  const { username } = req.body || {}
  if (!username) return res.status(400).json({ error: 'username required' })
  const key = String(username)
  const existing = r.users.get(key)
  if (!existing) {
    if (r.users.size >= (r.capacity || 2)) return res.status(409).json({ error: 'room full' })
    r.users.set(key, { username: key, ready: false })
  }
  broadcast({ type: 'room', data: roomToJSON(r) })
  broadcastRoomsList()
  res.json(roomToJSON(r))
})

router.post('/rooms/:id/leave', (req: Request, res: Response) => {
  const r = rooms.get(String(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  const { username } = req.body || {}
  if (!username) return res.status(400).json({ error: 'username required' })
  r.users.delete(String(username))
  if (r.users.size === 0) {
    if (r.timer) clearInterval(r.timer)
    rooms.delete(r.id)
    broadcastRoomsList()
    return res.json({ ok: true })
  }
  broadcast({ type: 'room', data: roomToJSON(r) })
  broadcastRoomsList()
  res.json(roomToJSON(r))
})

router.post('/rooms/:id/ready', (req: Request, res: Response) => {
  const r = rooms.get(String(req.params.id))
  if (!r) return res.status(404).json({ error: 'Not found' })
  const { username, ready } = req.body || {}
  if (!username) return res.status(400).json({ error: 'username required' })
  const u = r.users.get(String(username))
  if (!u) return res.status(404).json({ error: 'user not in room' })
  u.ready = Boolean(ready)
  const users = Array.from(r.users.values())
  const allReady = users.length >= 2 && users.every(x => x.ready)
  if (allReady && !r.countdown && !r.timer) startCountdown(r, 5)
  broadcast({ type: 'room', data: roomToJSON(r) })
  res.json(roomToJSON(r))
})

router.get('/leaderboard', async (_req: Request, res: Response) => {
  try {
    const sql = `SELECT p.id, p.username, p.text,
      SUM(CASE WHEN b.prompt_a_id = p.id AND b.votes_a > b.votes_b THEN 1 WHEN b.prompt_b_id = p.id AND b.votes_b > b.votes_a THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN b.prompt_a_id = p.id THEN b.votes_a WHEN b.prompt_b_id = p.id THEN b.votes_b ELSE 0 END) AS total_votes
      FROM prompts p
      LEFT JOIN battles b ON (b.prompt_a_id = p.id OR b.prompt_b_id = p.id)
      GROUP BY p.id ORDER BY wins DESC NULLS LAST, total_votes DESC NULLS LAST, p.id DESC LIMIT 50`;
    const r = await pool.query(sql)
    res.json(r.rows)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load leaderboard' })
  }
})

// Replays - recent battles (enriched)
router.get('/replays', async (_req, res) => {
  try {
    const r = await pool.query('SELECT id FROM battles ORDER BY id DESC LIMIT 50')
    const out: any[] = []
    for (const row of r.rows) out.push(await enrichBattle(row))
    res.json(out)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load replays' })
  }
})

// Reactions
router.post('/react', async (req, res) => {
  try {
    const { promptId, emoji, username } = req.body || {}
    if (!promptId || !emoji) return res.status(400).json({ error: 'promptId and emoji required' })
    await pool.query('INSERT INTO prompt_reactions (prompt_id, emoji, username) VALUES ($1, $2, $3)', [promptId, emoji, username || null])
    const counts = await pool.query('SELECT emoji, COUNT(*)::int as c FROM prompt_reactions WHERE prompt_id=$1 GROUP BY emoji', [promptId])
    broadcast({ type: 'reaction', data: { promptId, counts: counts.rows } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to react' })
  }
})

router.get('/reactions/:promptId', async (req, res) => {
  try {
    const pid = Number(req.params.promptId)
    const counts = await pool.query('SELECT emoji, COUNT(*)::int as c FROM prompt_reactions WHERE prompt_id=$1 GROUP BY emoji', [pid])
    res.json(counts.rows)
  } catch (e) {
    res.status(500).json([])
  }
})

export default router
