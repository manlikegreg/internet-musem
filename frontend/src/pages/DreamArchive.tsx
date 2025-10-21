import { useEffect, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'

interface Interpretation { id: string; username: string; text: string; created_at: string }
interface Dream {
  id: string
  username: string
  text: string
  image_url?: string | null
  interpretations: Interpretation[]
  reactions: Record<string, number>
  created_at: string
}

type StreamMsg =
  | { type: 'seed'; data: Dream[] }
  | { type: 'dream'; data: Dream }
  | { type: 'interpretation'; data: { id: string; interpretation: Interpretation; interpretations: Interpretation[] } }
  | { type: 'reaction'; data: { id: string; reactions: Record<string, number> } }

import { motion } from 'framer-motion'

export default function DreamArchive() {
  const [text, setText] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [visualize, setVisualize] = useState(false)
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [dreams, setDreams] = useState<Dream[]>([])
  const [showInterpret, setShowInterpret] = useState<{ open: boolean; id?: string }>(() => ({ open: false }))
  const [interpText, setInterpText] = useState('')

  const esRef = useRef<EventSource | null>(null)
  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'DreamArchive' }) }).catch(()=>{})
  }, [])

  useEffect(() => {
    const es = new EventSource(`${baseURL}/dream/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const msg: StreamMsg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setDreams(prev => prev.length ? prev : msg.data)
        } else if (msg.type === 'dream') {
          setDreams(prev => [msg.data, ...prev])
        } else if (msg.type === 'interpretation') {
          const { id, interpretations } = msg.data
          setDreams(prev => prev.map(d => d.id === id ? { ...d, interpretations } : d))
        } else if (msg.type === 'reaction') {
          const { id, reactions } = msg.data
          setDreams(prev => prev.map(d => d.id === id ? { ...d, reactions } : d))
        }
      } catch {}
    }
    return () => { es.close(); esRef.current = null }
  }, [])

  function dreamerName() { return `Anonymous Dreamer #${Math.floor(Math.random() * 1000) + 1}` }

  async function archiveDream() {
    if (!text.trim()) return
    setSending(true)
    try {
      // If visualize toggle is on and we have no prompt yet, try to fetch one
      let imageUrl: string | null = null
      if (visualize && !imagePrompt.trim()) {
        try {
          const r = await fetch(`${baseURL}/dream/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mode: 'prompt' }) })
          const data = await r.json()
          setImagePrompt(data?.prompt || '')
        } catch {}
      }
      // NOTE: actual image generation is optional; keeping imageUrl null in MVP
      await fetch(`${baseURL}/dream/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl })
      })
      setText('')
    } finally {
      setSending(false)
    }
  }

  async function generatePoem() {
    setGenerating(true)
    try {
      const r = await fetch(`${baseURL}/dream/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mode: 'poem' }) })
      const data = await r.json()
      if (data?.text) setText(data.text)
    } finally {
      setGenerating(false)
    }
  }

  async function react(id: string, emoji: string) {
    // optimistic
    setDreams(prev => prev.map(d => d.id === id ? { ...d, reactions: { ...(d.reactions || {}), [emoji]: (d.reactions?.[emoji] || 0) + 1 } } : d))
    await fetch(`${baseURL}/dream/react/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) }).catch(()=>{})
  }

  async function submitInterpretation() {
    const id = showInterpret.id
    if (!id || !interpText.trim()) return
    const t = interpText
    setInterpText('')
    setShowInterpret({ open: false, id: undefined })
    await fetch(`${baseURL}/dream/interpret/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) }).catch(()=>{})
  }

  return (
    <motion.div className="min-h-[100svh] relative overflow-hidden bg-gradient-to-b from-[#0b1020] via-[#0f1430] to-[#111633] text-white" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0.98, scale: 0.98 }} transition={{ duration: 0.5 }}>
      {/* floating particles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-10 left-10 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.4), transparent 60%)' }} />
        <div className="absolute bottom-0 right-20 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle at 70% 70%, rgba(168,85,247,0.35), transparent 60%)' }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-6">
          <div className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <span>💤</span>
            <h1>The Dream Archive</h1>
          </div>
          <p className="text-slate-300 mt-1">Record what you saw in the dark, and watch others dream too.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
              <div className="text-sm text-slate-300 mb-2">Describe your dream…</div>
              <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500/40" value={text} onChange={e=>setText(e.target.value)} placeholder="I was chasing code through a field of pixels…" />
              <label className="mt-2 text-xs text-slate-400 inline-flex items-center gap-2">
                <input type="checkbox" checked={visualize} onChange={e=>setVisualize(e.target.checked)} /> Ask the Oracle to visualize it (AI prompt)
              </label>
              {visualize && (
                <div className="mt-2">
                  <div className="text-xs text-slate-400 mb-1">Image prompt (optional)</div>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2" value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} placeholder="E.g., indigo city, silver fog, translucent code-birds" />
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={archiveDream} disabled={sending || !text.trim()} className="px-3 py-2 rounded-xl bg-indigo-500/90 hover:bg-indigo-500 text-white disabled:opacity-50">{sending ? 'Archiving…' : 'Archive Dream'}</button>
                <button onClick={generatePoem} disabled={generating} className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15">{generating ? 'Summoning…' : 'Generate Poetic Line'}</button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="grid gap-4">
              {dreams.map(dream => (
                <DreamCard key={dream.id} dream={dream} onReact={react} onInterpret={() => setShowInterpret({ open: true, id: dream.id })} />
              ))}
              {dreams.length === 0 && (
                <div className="text-slate-400">No dreams yet. Whisper yours to the archive.</div>
              )}
            </div>
          </div>
        </section>
      </div>

      {showInterpret.open && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/60">
          <div className="w-[92vw] max-w-md rounded-2xl bg-[#0f1430] border border-white/10 p-4">
            <div className="text-slate-200 mb-2">Interpret this dream</div>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 min-h-[100px]" value={interpText} onChange={e=>setInterpText(e.target.value)} placeholder="Offer a gentle, poetic explanation…" />
            <div className="mt-3 flex items-center gap-2 justify-end">
              <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15" onClick={()=>setShowInterpret({ open: false })}>Cancel</button>
              <button className="px-3 py-2 rounded-xl bg-indigo-500/90 hover:bg-indigo-500" onClick={submitInterpretation} disabled={!interpText.trim()}>Send</button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
        @keyframes drift { 0% { transform: translateY(0); opacity: .95 } 100% { transform: translateY(-40px); opacity: 0 } }
        .animate-drift { animation: drift 20s ease-in-out forwards }
        `}
      </style>
    </motion.div>
  )
}

function DreamCard({ dream, onReact, onInterpret }: { dream: Dream, onReact: (id: string, emoji: string) => void, onInterpret: ()=>void }) {
  const reactions = dream.reactions || {}
  return (
    <article className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 shadow-md animate-drift">
      <p className="text-indigo-200 text-sm">{dream.username}</p>
      <p className="text-slate-100 mt-2 whitespace-pre-wrap">{dream.text}</p>
      {dream.image_url && (
        <img src={dream.image_url} className="rounded-lg mt-3 max-h-56 object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-3 text-slate-300 text-xs mt-3">
        <button className="hover:text-white" onClick={()=>onReact(dream.id,'💭')}>💭 {dream.interpretations?.length || 0}</button>
        <button className="hover:text-white" onClick={()=>onReact(dream.id,'🪶')}>🪶 {reactions.feather || 0}</button>
        <button className="hover:text-white" onClick={()=>onReact(dream.id,'🔮')}>🔮 {reactions.mystic || 0}</button>
        <button className="hover:text-white" onClick={()=>onReact(dream.id,'🫧')}>🫧 {reactions.bubble || 0}</button>
        <div className="ml-auto"></div>
        <button className="px-2 py-1 rounded-lg bg-white/10 border border-white/10 hover:bg-white/15" onClick={onInterpret}>Interpret Dream</button>
      </div>
      {/* Interpretations list (small) */}
      {dream.interpretations?.length > 0 && (
        <div className="mt-3 space-y-2">
          {dream.interpretations.slice(0, 3).map(it => (
            <div key={it.id} className="text-slate-300 text-sm border-l-2 border-indigo-400/40 pl-3">
              <span className="text-indigo-200 text-xs">{it.username}</span>
              <div>{it.text}</div>
            </div>
          ))}
          {dream.interpretations.length > 3 && (
            <div className="text-indigo-300 text-xs">and {dream.interpretations.length - 3} more…</div>
          )}
        </div>
      )}
    </article>
  )
}
