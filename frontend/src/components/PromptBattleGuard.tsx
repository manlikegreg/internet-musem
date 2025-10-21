import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { readCookieUser } from '../utils/auth'

export function PromptBattleGuard({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const u = readCookieUser()
    if (!u || !u.token) {
      setOk(false)
    } else {
      setOk(true)
    }
  }, [])

  if (ok === null) return null
  if (!ok) return <Navigate to="/prompt-battle/login" replace />
  return <>{children}</>
}