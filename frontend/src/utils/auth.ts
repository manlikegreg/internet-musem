export type CookieUser = { username: string; token?: string }

export function readCookieUser(): CookieUser | null {
  try {
    const m = document.cookie.match(/im_user=([^;]+)/)
    if (!m) return null
    const v = decodeURIComponent(m[1])
    const o = JSON.parse(atob(v))
    if (!o || typeof o !== 'object') return null
    return { username: o.username || '', token: o.token }
  } catch {
    return null
  }
}