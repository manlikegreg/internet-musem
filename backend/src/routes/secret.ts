import express, { Request, Response } from 'express'

const router = express.Router()

let clients: Response[] = []
let messages: { id: string; user: string; text: string; at: string }[] = []

function broadcast(payload: any) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`
  clients.forEach(c => c.write(msg))
}

router.get('/eligibility', (req: Request, res: Response) => {
  // Placeholder eligibility: client provides flag; in production, check visits aggregation
  const ok = String(req.query.ok || '') === '1'
  res.json({ eligible: ok })
})

router.get('/stream', (req: Request, res: Response) => {
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(`data: ${JSON.stringify({ type: 'seed', data: messages.slice(-50) })}\n\n`)
  clients.push(res)
  req.on('close', () => { clients = clients.filter(c => c !== res) })
})

router.post('/send', (req: Request, res: Response) => {
  try {
    const user = String((req.body as any)?.user || 'Anonymous')
    const text = String((req.body as any)?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text required' })
    const row = { id: Math.random().toString(36).slice(2), user, text, at: new Date().toISOString() }
    messages.push(row)
    broadcast({ type: 'message', data: row })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to send' })
  }
})

export default router
