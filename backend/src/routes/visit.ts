import express, { Request, Response } from 'express'
import { pool } from '../config/db'
import { randomUUID } from 'crypto'

const router = express.Router()

function anonLabel(client_id: string): string {
  // Derive a stable number from the client_id
  let sum = 0
  for (let i = 0; i < client_id.length; i++) sum = (sum * 31 + client_id.charCodeAt(i)) >>> 0
  const num = (sum % 999) + 1
  return `Anonymous #${num}`
}

const KNOWN_ROOMS = [
  'ConfessionBooth','Void','Oracle','ComplimentMachine','MoodMirror','TimeCapsule','DreamArchive','PromptBattle','Graveyard','InternetOracle'
]

// Record a visit
router.post('/visit/hit', async (req: Request, res: Response) => {
  try {
    const client_id = String((req.body as any)?.client_id || '').trim()
    const room = String((req.body as any)?.room || '').trim()
    if (!client_id || !room) return res.status(400).json({ error: 'client_id and room required' })

    await pool.query('INSERT INTO visits (id, client_id, room) VALUES ($1, $2, $3)', [randomUUID(), client_id, room])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to record visit' })
  }
})

// Leaderboard: most active users
router.get('/leaderboard/active', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT client_id,
             COUNT(*) AS total_visits,
             COUNT(DISTINCT room) AS rooms_visited
      FROM visits
      WHERE created_at > now() - interval '30 days'
      GROUP BY client_id
      ORDER BY rooms_visited DESC, total_visits DESC
      LIMIT 20
    `)
    const rows = r.rows.map((row: any) => ({
      client_id: row.client_id,
      label: anonLabel(row.client_id),
      total_visits: Number(row.total_visits || 0),
      rooms_visited: Number(row.rooms_visited || 0),
      all_rooms: KNOWN_ROOMS.length,
      visited_all: Number(row.rooms_visited || 0) >= KNOWN_ROOMS.length
    }))
    res.json(rows)
  } catch (e) {
    res.status(500).json([])
  }
})

// For a single user
router.get('/leaderboard/for/:client_id', async (req: Request, res: Response) => {
  try {
    const client_id = String(req.params.client_id)
    const r = await pool.query(`
      SELECT room, COUNT(*) AS visits
      FROM visits
      WHERE client_id = $1
      GROUP BY room
      ORDER BY room
    `, [client_id])
    const rooms = r.rows.map((row: any) => ({ room: row.room, visits: Number(row.visits || 0) }))
    const unique = rooms.length
    res.json({
      client_id,
      label: anonLabel(client_id),
      rooms,
      roomsVisited: unique,
      all_rooms: KNOWN_ROOMS.length,
      visited_all: unique >= KNOWN_ROOMS.length
    })
  } catch (e) {
    res.status(500).json({ client_id: req.params.client_id, rooms: [], roomsVisited: 0, all_rooms: KNOWN_ROOMS.length, visited_all: false })
  }
})

export default router
