export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export function ensureUserCookie(name = 'im_uid'): string {
  if (typeof document === 'undefined') return ''
  let v = getCookie(name)
  if (!v) {
    try {
      const arr = new Uint8Array(16)
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
      v = Array.from(arr).map(x => x.toString(16).padStart(2, '0')).join('') || Math.random().toString(36).slice(2)
    } catch {
      v = Math.random().toString(36).slice(2)
    }
    const maxAge = 60 * 60 * 24 * 365 // 1 year
    document.cookie = `${name}=${encodeURIComponent(v)}; path=/; max-age=${maxAge}; SameSite=Lax`
  }
  return v as string
}
