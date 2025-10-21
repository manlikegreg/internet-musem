import express, { Request, Response } from 'express'
import { pool } from '../config/db'

const router = express.Router()

router.get('/weekly', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query("SELECT AVG(sentiment)::float AS avg FROM moods WHERE created_at > now() - interval '7 days'")
    const avg = Number(r.rows?.[0]?.avg || 0)
    const tone = avg > 2 ? 'joyful' : avg > 0.5 ? 'hopeful' : avg > -0.5 ? 'reflective' : avg > -2 ? 'melancholic' : 'heartbroken'
    const summary = `This week, the Internet felt mostly ${tone}. The collective mood drifted with an average sentiment of ${(avg).toFixed(2)}.`
    res.json({ summary, average: avg })
  } catch (e) {
    res.status(500).json({ summary: 'This week, the Internet whispered quietly. (No data available)' })
  }
})

export default router
