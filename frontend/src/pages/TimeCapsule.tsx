import { useEffect, useMemo, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'
import { RoomHeader } from '../components/RoomHeader'

interface Capsule { id: string; username: string; message?: string|null; media_url?: string|null; unlock_at: string; status: string; created_at: string }

type Msg = { type: 'seed'|'opened'|'sealed'; data: any }

function CapsuleForm({ onCreated }: { onCreated: ()=>void }) {
  const [message, setMessage] = useState('')
  const [seal, setSeal] = useState<'1h'|'1d'|'1w'|'custom'>('1h')
  const [custom, setCustom] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)

  function computeUnlockAt(): string {
    if (seal === 'custom' && custom) return new Date(custom).toISOString()
    const now = Date.now()
    const add = seal==='1h'? 3600e3 : seal==='1d'? 86400e3 : 7*86400e3
    return new Date(now + add).toISOString()
  }

  async function submit() {
    setSending(true)
    try {
      const unlockAt = computeUnlockAt()
      if (file) {
        const fd = new FormData()
        fd.append('message', message)
        fd.append('unlockAt', unlockAt)
        fd.append('media', file)
        await fetch(`${baseURL}/timecapsule/create`, { method: 'POST', body: fd })
      } else {
        await fetch(`${baseURL}/timecapsule/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, unlockAt })
        })
      }
      setMessage(''); setFile(null); setCustom(''); setSeal('1h')
      onCreated()
    } catch {} finally { setSending(false) }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <label className="text-sm text-slate-300">Your message to the future</label>
      <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 mb-3" placeholder="Leave a memory..." />
      <div className="mb-3">
        <label className="text-sm text-slate-300 block mb-1">Attachment (optional)</label>
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-3 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400 truncate">
            {file ? <span>{file.name}</span> : <span>Attach image or audio</span>}
          </div>
          <div className="flex items-center gap-2">
            {file && <button type="button" onClick={()=>setFile(null)} className="text-xs text-slate-400 hover:text-slate-200 underline">Remove</button>}
            <label className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
              <span className="text-xs">Choose</span>
              <input type="file" accept="image/*,audio/*" onChange={e=>setFile(e.target.files?.[0] || null)} className="hidden" />
            </label>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <select value={seal} onChange={e=>setSeal(e.target.value as any)} className="bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2">
          <option value="1h">Seal for 1 hour</option>
          <option value="1d">Seal for 1 day</option>
          <option value="1w">Seal for 1 week</option>
          <option value="custom">Custom date</option>
        </select>
        {seal==='custom' && (
          <input type="datetime-local" value={custom} onChange={e=>setCustom(e.target.value)} className="bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2" />
        )}
        <button onClick={submit} disabled={sending} className="ml-auto px-4 py-2 rounded-xl bg-slate-200 text-slate-900 hover:bg-white">{sending ? 'Sealing...' : 'Seal Capsule'}</button>
      </div>
    </div>
  )
}

import { motion } from 'framer-motion'

export default function TimeCapsule() {
  const [items, setItems] = useState<Capsule[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'TimeCapsule' }) }).catch(()=>{})
  }, [])
  const [sealedItems, setSealedItems] = useState<Capsule[]>([])
  const [sealedLoading, setSealedLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [hasMediaOnly, setHasMediaOnly] = useState(false)
  const [density, setDensity] = useState<'cozy'|'compact'>('cozy')
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(c => (
      (!hasMediaOnly || !!c.media_url) &&
      (!q || (c.message?.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)))
    ))
  }, [items, query, hasMediaOnly])

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${baseURL}/timecapsule/opened?limit=50`)
        const data = await r.json()
        if (Array.isArray(data)) setItems(data)
      } catch {
      } finally {
        setLoading(false)
      }
    })()
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/timecapsule/sealed?limit=50`)
        const data = await r.json()
        if (Array.isArray(data)) setSealedItems(data)
      } catch {
      } finally {
        setSealedLoading(false)
      }
    })()
    const es = new EventSource(`${baseURL}/timecapsule/stream`)
    es.onmessage = (e) => {
      try {
        const msg: Msg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setItems(prev => prev.length ? prev : msg.data)
        } else if (msg.type === 'opened' && msg.data) {
          setItems(prev => [msg.data, ...prev])
        } else if (msg.type === 'sealed' && msg.data) {
          setSealedItems(prev => [msg.data, ...prev])
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  function onCreated() {
    // nothing required; capsule will appear when unlocked
  }

  function renderMedia(url?: string|null) {
    if (!url) return null
    const full = `${baseURL.replace(/\/api\/?$/, '')}${url}`
    const lower = full.toLowerCase()
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
      return <img src={full} className="mt-3 rounded-lg max-h-64 object-contain" />
    }
    if (lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.wav') || lower.endsWith('.webm')) {
      return <audio src={full} controls preload="none" className="mt-3 w-full" />
    }
    return <a href={full} target="_blank" rel="noreferrer" className="mt-3 underline text-amber-400">View attachment</a>
  }

  function fmtETA(iso: string) {
    const target = new Date(iso).getTime()
    if (!isFinite(target)) return ''
    const diff = target - Date.now()
    const past = diff <= 0
    const abs = Math.abs(diff)
    const h = Math.floor(abs / 3600000)
    const m = Math.floor((abs % 3600000) / 60000)
    if (h > 0) return past ? `${h}h ${m}m ago` : `in ${h}h ${m}m`
    const s = Math.max(0, Math.floor((abs % 60000) / 1000))
    if (m > 0) return past ? `${m}m ago` : `in ${m}m`
    return past ? `${s}s ago` : `in ${s}s`
  }

  return (
    <motion.div className="px-4 sm:px-6 py-6 text-white" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45 }}>
      <div className="max-w-5xl mx-auto">
        <RoomHeader emoji="📦" title="Time Capsule" subtitle="Seal a message for later. A gentle note to future-you." color="#f59e0b" />
        <CapsuleForm onCreated={onCreated} />

        <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search messages or users..."
                  className="w-full sm:w-80 bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="text-xs text-slate-400 hover:text-slate-200 underline">Clear</button>
                )}
              </div>
              <label className="text-xs text-slate-300 inline-flex items-center gap-2">
                <input type="checkbox" checked={hasMediaOnly} onChange={e=>setHasMediaOnly(e.target.checked)} /> Has media
              </label>
              <div className="inline-flex rounded-xl border border-slate-700 bg-slate-950/60 overflow-hidden">
                <button type="button" onClick={()=>setDensity('cozy')} aria-pressed={density==='cozy'} className={`${density==='cozy' ? 'bg-slate-800 text-slate-100' : 'text-slate-300'} px-3 py-1.5 text-xs`}>Cozy</button>
                <button type="button" onClick={()=>setDensity('compact')} aria-pressed={density==='compact'} className={`${density==='compact' ? 'bg-slate-800 text-slate-100' : 'text-slate-300'} px-3 py-1.5 text-xs border-l border-slate-700`}>Compact</button>
              </div>
            </div>

            <div className={`mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-2 ${density === 'cozy' ? 'gap-4' : 'gap-3'}`}>
              {loading && filteredItems.length === 0 && [1,2,3,4].map(i => (
                <div key={`sk-${i}`} className="border border-slate-800 rounded-2xl p-4 bg-slate-900/60 animate-pulse">
                  <div className="h-4 w-24 bg-slate-800 rounded mb-3"></div>
                  <div className="h-5 w-5/6 bg-slate-800 rounded mb-2"></div>
                  <div className="h-5 w-2/3 bg-slate-800 rounded"></div>
                </div>
              ))}

              {filteredItems.map(c => (
                <div key={c.id} className={`border border-slate-800 rounded-2xl ${density === 'cozy' ? 'p-4' : 'p-3'} bg-slate-900/60 transform transition-transform duration-200 hover:-translate-y-0.5 hover:ring-1 ring-slate-700/50 hover:shadow-lg shadow-slate-900/30`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">{c.username}</p>
                    {c.media_url && (
                      <span className="text-[10px] uppercase tracking-wide bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">Media</span>
                    )}
                  </div>
                  {c.message && <p className={density === 'cozy' ? 'text-slate-300 mt-2' : 'text-slate-300 text-sm mt-1'}>{c.message}</p>}
                  {renderMedia(c.media_url)}
                  <p className="text-xs text-slate-500 mt-3">⏱️ Released {new Date(c.unlock_at).toLocaleString()}</p>
                </div>
              ))}
              {filteredItems.length === 0 && !loading && (
                <div className="text-slate-500">No opened capsules yet.</div>
              )}
            </div>
          </div>

          <aside className="md:col-span-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium text-slate-200">Sealed (Live)</div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Live
                </div>
              </div>
              <div className="divide-y divide-slate-800">
                {sealedLoading && sealedItems.length === 0 && [1,2,3,4,5].map(i => (
                  <div key={`ssk-${i}`} className="py-3">
                    <div className="h-4 w-3/4 bg-slate-800 rounded mb-2 animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-slate-800 rounded animate-pulse"></div>
                  </div>
                ))}
                {sealedItems.slice(0, 8).map(s => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-300 truncate">
                        {s.message || '(no message)'}
                      </div>
                      {s.media_url && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full shrink-0">Media</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">by {s.username} • unlocks {fmtETA(s.unlock_at)}</div>
                  </div>
                ))}
                {!sealedLoading && sealedItems.length === 0 && (
                  <div className="text-slate-500 text-sm py-6">No sealed capsules yet.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  )
}

