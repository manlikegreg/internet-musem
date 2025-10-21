import express, { Request, Response } from 'express'
import { pool } from '../config/db'

const router = express.Router()

function generateToken(): string {
  // 8-digit numeric token
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// Login or register: returns a token (existing or new)
router.post('/login', async (req: Request, res: Response) => {
  try {
    let { username, token } = req.body || {}
    username = (username || '').trim()
    if (!username) return res.status(400).json({ error: 'username required' })

    const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    if (existing.rows.length > 0) {
      const row = existing.rows[0]
      const outToken = row.token || token || generateToken()
      if (!row.token) await pool.query('UPDATE users SET token = $2 WHERE id = $1', [row.id, outToken])
      return res.json({ username, token: outToken })
    }

    const newToken = token || generateToken()
    const r = await pool.query('INSERT INTO users (username, token) VALUES ($1, $2) RETURNING *', [username, newToken])
    res.json({ username: r.rows[0].username, token: r.rows[0].token })
  } catch (e) {
    res.status(500).json({ error: 'Failed to login/register' })
  }
})

// Validate username+token
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const { username, token } = req.query as any
    if (!username || !token) return res.json({ ok: false })
    const r = await pool.query('SELECT 1 FROM users WHERE username = $1 AND token = $2', [username, token])
    res.json({ ok: r.rows.length > 0 })
  } catch (e) {
    res.status(500).json({ ok: false })
  }
})

export default router