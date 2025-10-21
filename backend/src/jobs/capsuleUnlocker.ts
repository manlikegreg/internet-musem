import { pool } from '../config/db'

export async function unlockCapsules() {
  try {
    const r = await pool.query(`UPDATE capsules SET status = 'opened'
      WHERE status = 'sealed' AND unlock_at <= NOW()
      RETURNING *`)
    for (const row of r.rows) {
      await pool.query("SELECT pg_notify('capsule_opened', $1)", [JSON.stringify(row)])
    }
  } catch (e) {
    // ignore
  }
}