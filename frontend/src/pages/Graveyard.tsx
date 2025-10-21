import { useEffect, useMemo, useRef, useState } from 'react'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'
import { Modal } from '../components/Modal'

type Grave = { id: number; username?: string | null; title: string; epitaph: string; category?: string | null; created_at: string; resurrect_count?: number; attachment_path?: string | null; attachment_name?: string | null; attachment_size?: number | null; attachment_type?: string | null }

export default function Graveyard() {
  const [graves, setGraves] = useState<Grave[]>([])
  const [form, setForm] = useState({ title: '', epitaph: '', category: '' })
  const [loading, setLoading] = useState(false)
  const feedRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Grave | null>(null)
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [category, setCategory] = useState<'all'|'idea'|'project'|'meme'|'regret'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return graves.filter(g => {
      const catOk = category === 'all' || (g.category || '').toLowerCase() === category
      if (!q) return catOk
      const hay = `${g.title} ${g.epitaph} ${g.username || ''}`.toLowerCase()
      return catOk && hay.includes(q)
    })
  }, [graves, query, category])

  useEffect(() => {
    let es: EventSource | null = null
    ;(async () => {
      const { data } = await api.get<Grave[]>('/graveyard')
      setGraves(data)
      es = new EventSource(`${baseURL}/graveyard/stream`)
      es.onmessage = (e) => {
        try {
          const g: Grave = JSON.parse(e.data)
          setGraves(prev => {
            const idx = prev.findIndex(x => x.id === g.id)
            if (idx >= 0) {
              const copy = prev.slice()
              copy[idx] = g
              return copy
            }
            return [g, ...prev].slice(0, 50)
          })
        } catch {}
      }
    })()
    return () => { es?.close() }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.epitaph.trim()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('epitaph', form.epitaph)
      if (form.category) fd.append('category', form.category)
      const fileInput = document.querySelector<HTMLInputElement>('input[type=file][name=attachment]')
      const file = fileInput?.files?.[0]
      if (file) fd.append('attachment', file)
      const { data } = await api.post<Grave>('/graveyard', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm({ title: '', epitaph: '', category: '' })
      setGraves(prev => {
        const exists = prev.some(x => x.id === data.id)
        return exists ? prev.map(x => (x.id === data.id ? data : x)) : [data, ...prev]
      })
      feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setLoading(false) }
  }

  async function resurrect(id: number) {
    const { data } = await api.post<Grave>(`/graveyard/${id}/resurrect`)
    setGraves(prev => prev.map(g => g.id === id ? data : g))
    const item = graves.find(g => g.id === id) || data
    setActive(item)
    setOpen(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-slate-800 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <RoomHeader emoji="🪦" title="Internet Graveyard" subtitle="Rest in pixels, dear ideas." color="#94a3b8" />
        <div className="flex flex-col md:flex-row gap-6">
          {/* Form */}
          <form onSubmit={submit} className="w-full md:w-1/3 bg-white/5 border border-white/10 p-4 rounded-2xl">
            <input className="w-full p-2 mb-3 rounded bg-black/40 text-white placeholder-slate-400 border border-white/10" placeholder="Title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
            <textarea className="w-full p-2 mb-3 rounded bg-black/40 text-white placeholder-slate-400 border border-white/10" placeholder="Epitaph" rows={4} value={form.epitaph} onChange={e=>setForm(f=>({...f,epitaph:e.target.value}))}></textarea>
            <select className="w-full p-2 mb-3 rounded bg-black/40 text-white border border-white/10" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              <option value="">Select Category</option>
              <option value="idea">Idea</option>
              <option value="project">Project</option>
              <option value="meme">Meme</option>
              <option value="regret">Regret</option>
            </select>
            <label className="text-xs text-slate-300 mb-1 inline-block">Optional attachment (README/docs, max 25MB)</label>
            <input type="file" name="attachment" accept=".txt,.md,.pdf,.doc,.docx,.zip,.rar,.7z,.json,.csv,.png,.jpg,.jpeg,.gif" className="w-full file:mr-2 file:px-3 file:py-1 file:rounded file:border file:border-white/10 file:bg-black/40 file:text-white file:text-xs file:hover:bg-black/60 mb-3" />
            <button disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-full">💀 Bury It</button>
          </form>

          {/* Live feed */}
          <div ref={feedRef} className="flex-1 h-[600px] overflow-y-auto bg-white/5 border border-white/10 p-4 rounded-2xl">
            {/* Search + Filter */}
            <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-sm rounded-lg p-2 mb-3 border border-white/10">
              <div className="flex items-center gap-2">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search graves..." className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-2 text-sm" />
                <button onClick={()=>setShowFilters(s=>!s)} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm">{showFilters ? 'Hide Filters' : 'Filters'}</button>
              </div>
              {showFilters && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {(['all','idea','project','meme','regret'] as const).map(c => (
                    <button key={c} onClick={()=>setCategory(c)} className={`px-3 py-1 rounded border ${category===c ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>{c.toUpperCase()}</button>
                  ))}
                </div>
              )}
            </div>
            {filtered.map((g) => (
              <div key={g.id} className="mb-3 p-3 bg-white/10 rounded-lg hover:bg-white/20 transition">
                <div className="flex items-center justify-between">
                  <p className="text-xs opacity-70">{g.username || 'Anonymous'}</p>
                  <button onClick={() => resurrect(g.id)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">Resurrect {g.resurrect_count ? `(${g.resurrect_count})` : ''}</button>
                </div>
                <p className="font-semibold">{g.title}</p>
                <p className="text-sm opacity-80 italic">{g.epitaph}</p>
                <p className="text-xs text-gray-400">💀 {g.category || 'unknown'} — {new Date(g.created_at).toLocaleString()}</p>
                {g.attachment_path && (
                  <button onClick={() => { setActive(g); setOpen(true) }} className="text-xs underline text-slate-200">View attachment</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)}>
        {active && (
          <div>
            <h3 className="text-xl font-semibold mb-1">{active.title}</h3>
            <p className="text-slate-300 mb-2 italic">{active.epitaph}</p>
            <p className="text-xs text-slate-400 mb-4">By {active.username || 'Anonymous'} • {new Date(active.created_at).toLocaleString()} • {active.category || 'unknown'}</p>
            {active.attachment_path ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-300">Attachment: {active.attachment_name || 'file'} {active.attachment_size ? `(${Math.ceil(active.attachment_size/1024)} KB)` : ''}</div>
                <a href={active.attachment_path} className="inline-block px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm" target="_blank" rel="noreferrer">Download file</a>
              </div>
            ) : (
              <div className="text-sm text-slate-400">No attachment provided.</div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
