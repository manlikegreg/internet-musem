import { Router } from 'express'
import { pool } from '../config/db'

const router = Router()

router.get('/echo', async (_req, res) => {
  try {
    const rows = await pool.query("SELECT key, value FROM site_config WHERE key IN ('ECHO_VOID_DELAY','ECHO_VOID_FEEDBACK','ECHO_VOID_DECAY','ECHO_CONF_DELAY','ECHO_CONF_FEEDBACK','ECHO_CONF_DECAY')")
    const map = Object.fromEntries(rows.rows.map((r:any)=>[r.key, r.value]))
    const num = (k:string,d:number)=> (map[k]!==undefined ? Number(map[k]) : d)
    res.json({
      void: { delay: num('ECHO_VOID_DELAY', 0.22), feedback: num('ECHO_VOID_FEEDBACK', 0.35), decay: num('ECHO_VOID_DECAY', 1.0) },
      confession: { delay: num('ECHO_CONF_DELAY', 0.38), feedback: num('ECHO_CONF_FEEDBACK', 0.55), decay: num('ECHO_CONF_DECAY', 2.3) }
    })
  } catch (e) {
    res.json({ void: { delay: 0.22, feedback: 0.35, decay: 1.0 }, confession: { delay: 0.38, feedback: 0.55, decay: 2.3 } })
  }
})

export default router
