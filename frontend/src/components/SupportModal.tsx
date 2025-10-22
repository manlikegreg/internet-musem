import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Links = {
  kofi?: string
  whatsapp?: string
  telegram?: string
  tiktok?: string
}

export function SupportModal({ open, onClose, links: initialLinks }: { open: boolean, onClose: ()=>void, links?: Links }) {
  const [links, setLinks] = useState<Links>(initialLinks || {})

  useEffect(() => {
    if (initialLinks) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await api.get('/admin/config/links')
        if (!cancelled) setLinks(resp.data || {})
      } catch (err) {
        // ignore
      }
    })()
    return () => { cancelled = true }
  }, [initialLinks])

  if (!open) return null

  // Build full URLs from raw identifiers if admin stored only number/username/handle
  const formatUrl = (key: keyof Links, raw?: string) => {
    const v = (raw || '').trim()
    if (!v) return ''
    if (/^https?:\/\//i.test(v)) return v
    if (key === 'whatsapp') {
      const digits = v.replace(/[^0-9]/g, '')
      return digits ? `https://wa.me/${digits}` : ''
    }
    if (key === 'telegram') {
      const user = v.replace(/^@/, '')
      return user ? `https://t.me/${user}` : ''
    }
    if (key === 'tiktok') {
      const handle = v.replace(/^@/, '')
      return handle ? `https://www.tiktok.com/@${handle}` : ''
    }
    return v
  }

  const kofiUrl = links.kofi || 'https://ko-fi.com/its_simon_only'
  const socials: { key: keyof Links, label: string }[] = [
    { key: 'whatsapp', label: 'wa.me' },
    { key: 'telegram', label: 't.me' },
    { key: 'tiktok', label: 'tiktok.com' },
  ]

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <h2 className="text-lg font-bold text-slate-100">Support the Museum</h2>
            <button onClick={onClose} className="px-3 py-1 text-sm rounded-md border border-white/20 text-slate-200 hover:bg-white/10">Close</button>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="text-slate-300 text-sm">If you enjoy the experience, you can support us here:</div>
              <a href={kofiUrl} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-400 text-black font-extrabold shadow hover:bg-yellow-300">
                ☕ Buy me a coffee
              </a>
            </div>

            <div className="pt-2">
              <div className="text-slate-300 text-sm mb-2">Contact us</div>
              <div className="flex flex-wrap gap-2">
                {socials.map(({ key, label }) => {
                  const url = formatUrl(key, links[key])
                  let styles = 'px-3 py-2 rounded-lg text-sm font-semibold shadow'
                  if (key === 'whatsapp') styles += ' bg-emerald-500 text-white hover:bg-emerald-400'
                  else if (key === 'telegram') styles += ' bg-blue-500 text-white hover:bg-blue-400'
                  else if (key === 'tiktok') styles += ' bg-pink-500 text-white hover:bg-pink-400'
                  const disabled = !url
                  if (disabled) styles += ' opacity-50 cursor-not-allowed hover:opacity-60'
                  return (
                    <a
                      key={key}
                      href={url || '#'}
                      target={url ? '_blank' : undefined}
                      rel={url ? 'noopener noreferrer' : undefined}
                      onClick={disabled ? (e) => e.preventDefault() : undefined}
                      className={styles}
                      aria-disabled={disabled}
                      title={disabled ? 'Configure in Admin' : undefined}
                    >
                      {label}
                    </a>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}