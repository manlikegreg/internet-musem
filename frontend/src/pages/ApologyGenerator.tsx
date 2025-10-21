import { useEffect, useMemo, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'

interface Apology {
  id: string
  username: string
  apology: string
  reactions: Record<string, number>
  created_at: string
}

type StreamMsg =
  | { type: 'seed'; data: Apology[] }
  | { type: 'apology'; data: Apology }
  | { type: 'reaction'; data: { id: string; reactions: Record<string, number> } }

export default function ApologyGenerator() {
  const [name, setName] = useState('')
  const [incident, setIncident] = useState('')
  const [text, setText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [pubError, setPubError] = useState<string | null>(null)
  const [items, setItems] = useState<Apology[]>([])
  const [seeded, setSeeded] = useState(false)
  const [activity, setActivity] = useState<string[]>([])

  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'ApologyGenerator' }) }).catch(()=>{})
    const es = new EventSource(`${baseURL}/apology/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const msg: StreamMsg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setItems(prev => prev.length ? prev : msg.data)
          setSeeded(true)
        } else if (msg.type === 'apology') {
          setItems(prev => [msg.data, ...prev])
          const snippet = truncateSnippet(msg.data.apology)
          addActivity(`${msg.data.username} just issued an apology: "${snippet}"`)
        } else if (msg.type === 'reaction') {
          setItems(prev => prev.map(p => p.id === msg.data.id ? { ...p, reactions: msg.data.reactions } : p))
        }
      } catch {}
    }
    return () => { es.close(); esRef.current = null }
  }, [])

  function addActivity(s: string) {
    setActivity(prev => [s, ...prev].slice(0, 6))
  }

  function truncateSnippet(s: string, max = 80) {
    const t = s.replace(/\s+/g, ' ').trim()
    return t.length > max ? `${t.slice(0, max - 1)}…` : t
  }

  async function generate(remixWith?: string) {
    setGenError(null)
    setGenerating(true)
    try {
      const r = await fetch(`${baseURL}/apology/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, incident, remixWith: remixWith || undefined })
      })
      if (!r.ok) {
        const t = await r.text().catch(()=> '')
        setGenError('Failed to generate. Try again or type your own statement.')
        return
      }
      const data = await r.json()
      if (data?.apology) setText(data.apology)
    } catch (e) {
      setGenError('Failed to generate. Check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  function displayName() {
    return (name || '').trim() || `Anonymous ${Math.floor(Math.random() * 1000) + 1}`
  }

  async function publish() {
    if (!text.trim()) return
    setPubError(null)
    setPublishing(true)
    try {
      const r = await fetch(`${baseURL}/apology/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: displayName(), apology: text, reactions: {} })
      })
      if (!r.ok) {
        setPubError('Failed to publish. Please try again.')
        return
      }
      setText('')
      setIncident('')
      addActivity(`${displayName()} published a new apology.`)
      // new item will arrive via SSE
    } catch (e) {
      setPubError('Failed to publish. Check your connection and try again.')
    } finally {
      setPublishing(false)
    }
  }

  async function react(id: string, emoji: string) {
    // optimistic
    setItems(prev => prev.map(p => p.id === id ? {
      ...p,
      reactions: { ...p.reactions, [emoji]: (p.reactions?.[emoji] || 0) + 1 }
    } : p))
    await fetch(`${baseURL}/apology/react/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji })
    }).catch(()=>{})
  }

  function remix(source: Apology) {
    generate(source.apology)
  }

  const palette = {
    bg: '#f8f9fb',
    text: '#111111',
    accent: '#e11d48', // subtle red
    blue: '#2563eb',
  }

  return (
    <div className="min-h-[100svh]" style={{ backgroundColor: palette.bg, color: palette.text }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <header className="mb-6">
          <div className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
            <span>😵‍💫</span>
            <h1>The Apology Generator</h1>
          </div>
          <p className="text-sm sm:text-base text-black/60 mt-1">Craft your perfect public apology — for anything and everything.</p>

          <div className="mt-4 bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="px-3 py-2 text-xs uppercase tracking-wide bg-black/5 flex items-center justify-between">
              <span>Live Activity</span>
              <span className="inline-flex items-center gap-2 text-[11px] text-black/60">
                <span className="inline-block w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
                Streaming
              </span>
            </div>
            <div className="px-3 py-2 text-sm">
              {activity.length === 0 ? (
                <span className="text-black/40">Waiting for the next scandal…</span>
              ) : (
                <div className="grid gap-1">
                  {activity.map((a, i) => (
                    <div key={i} className="truncate">{a}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white border border-black/10 rounded-xl p-4 shadow-sm">
              <div className="text-sm font-medium mb-2">Press Release Console</div>
              <input
                className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Who’s apologizing? (optional)"
                value={name}
                onChange={e=>setName(e.target.value)}
              />
              <textarea
                className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-black/10"
                placeholder="Incident details (what happened?)"
                rows={3}
                value={incident}
                onChange={e=>setIncident(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-2 mb-2">
                {['accidentally ate my roommate\'s snacks', 'forgot to mute during a video call', 'posted a meme at 3am without context'].map((s, i)=> (
                  <button key={i} type="button" className="px-2 py-1 text-xs rounded-full bg-black/5 hover:bg-black/10 border border-black/10" onClick={()=>setIncident(s)}>{s}</button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => generate()}
                  disabled={generating}
                  className="px-3 py-2 rounded-lg text-sm bg-black text-white hover:bg-black/90 disabled:opacity-50">
                  {generating ? 'Generating…' : 'Generate AI Apology'}
                </button>
                {genError && <span className="text-xs text-rose-600">{genError}</span>}
                <button
                  onClick={publish}
                  disabled={publishing || !text.trim()}
                  className="px-3 py-2 rounded-lg text-sm bg-white border border-black/10 hover:bg-black/5 disabled:opacity-50">
                  {publishing ? 'Publishing…' : 'Publish Apology'}
                </button>
                {pubError && <span className="text-xs text-rose-600">{pubError}</span>}
              </div>
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-black/50 mb-1">Draft</div>
                <textarea
                  className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  rows={7}
                  value={text}
                  onChange={e=>setText(e.target.value)}
                  placeholder="Your apology will appear here…"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="grid gap-4">
              {!seeded && (
                <>
                  {[1,2,3].map(i => (
                    <div key={`sk-${i}`} className="bg-white border border-black/10 rounded-xl p-4 shadow-sm animate-pulse">
                      <div className="h-3 w-40 bg-black/10 rounded mb-3"></div>
                      <div className="h-4 w-5/6 bg-black/10 rounded mb-2"></div>
                      <div className="h-4 w-3/4 bg-black/10 rounded"></div>
                    </div>
                  ))}
                </>
              )}

              {items.map(item => (
                <ApologyCard key={item.id} item={item} onReact={react} onRemix={remix} />
              ))}
              {seeded && items.length === 0 && (
                <div className="text-black/50">No apologies yet. Be the first to issue a statement.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ApologyCard({ item, onReact, onRemix }: {
  item: Apology,
  onReact: (id: string, emoji: string) => void,
  onRemix: (a: Apology) => void,
}) {
  const reactions = item.reactions || {}
  const btn = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm border border-black/10 hover:bg-black/5 active:scale-110 transition'

  return (
    <article className="bg-white border border-black/10 rounded-xl p-4 shadow-sm transition hover:shadow-md">
      <div className="text-xs text-black/60 mb-2">🗞️ Official Apology from <span className="font-medium text-black">{item.username}</span></div>
      <div className="whitespace-pre-wrap leading-relaxed">{item.apology}</div>
      <div className="mt-2 text-xs text-black/50">– The Management</div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btn} onClick={()=>onReact(item.id,'heart')} title="Heart">❤️ <span>{reactions.heart || 0}</span></button>
        <button className={btn} onClick={()=>onReact(item.id,'laugh')} title="Laugh">😂 <span>{reactions.laugh || 0}</span></button>
        <button className={btn} onClick={()=>onReact(item.id,'fire')} title="Fire">🔥 <span>{reactions.fire || 0}</span></button>
        <button className={btn} onClick={()=>onReact(item.id,'cry')} title="Cry">😭 <span>{reactions.cry || 0}</span></button>
        <div className="ml-auto"></div>
        <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm bg-black text-white hover:bg-black/90" onClick={()=>onRemix(item)}>
          Remix (Make it worse)
        </button>
      </div>
    </article>
  )
}
