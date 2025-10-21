import express, { Request, Response } from 'express'

const router = express.Router()

let clients: Response[] = []
let count = 0

function broadcast() {
  const msg = `data: ${JSON.stringify({ type: 'count', data: { count } })}\n\n`
  clients.forEach(c => c.write(msg))
}

router.get('/stream', async (req: Request, res: Response) => {
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
  ;(res as any).flushHeaders?.()
  res.write(': connected\n\n')
  clients.push(res)
  count++
  broadcast()
  req.on('close', () => {
    clients = clients.filter(c => c !== res)
    count = Math.max(0, count - 1)
    broadcast()
  })
})

router.get('/count', (_req: Request, res: Response) => {
  res.json({ count })
})

export default router
