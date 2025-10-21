import { useEffect, useState } from 'react'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'
import { ReactionBar } from '../components/ReactionBar'
import { useNavigate } from 'react-router-dom'

interface EnrichedBattle { id: number; prompt_a_id: number; prompt_b_id: number; a_image_url?: string|null; b_image_url?: string|null; a_text?: string|null; b_text?: string|null; votes_a: number; votes_b: number }

type StreamMsg = { type: 'prompt'|'battle'|'vote'; data: any }

export default function PromptBattle() {
  const [username, setUsername] = useState<string>(() => {
    const m = document.cookie.match(/im_user=([^;]+)/)
    if (m) { try { const v = decodeURIComponent(m[1]); const o = JSON.parse(atob(v)); return o.username || '' } catch {} }
    return ''
  })
  const [promptText, setPromptText] = useState('A neon city with cyberpunk raccoons')
  const [feed, setFeed] = useState<any[]>([])
  const [active, setActive] = useState<EnrichedBattle | null>(null)
  const [ongoing, setOngoing] = useState<EnrichedBattle[]>([])
  const [recent, setRecent] = useState<EnrichedBattle[]>([])
  const [matching, setMatching] = useState(false)
  const [matchingCtl, setMatchingCtl] = useState<AbortController | null>(null)
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const es = new EventSource(`${baseURL}/battle/stream`)
    es.onmessage = (e) => {
      try {
        const msg: StreamMsg = JSON.parse(e.data)
        if (msg.type === 'battle' || (msg.type === 'vote' && msg.data?.id === active?.id)) setActive(msg.data)
        // keep feed
        setFeed(prev => [msg.data, ...prev].slice(0, 100))
        // update ongoing list
        if (msg.type === 'battle') {
          setOngoing(prev => [msg.data, ...prev.filter(b => b.id !== msg.data.id)].slice(0, 20))
        }
        if (msg.type === 'vote') {
          setOngoing(prev => prev.map(b => b.id === msg.data?.id ? { ...b, ...msg.data } : b))
        }
      } catch {}
    }
    return () => es.close()
  }, [active?.id])

  // Preload ongoing battles and recent results
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/battle/active')
        setOngoing(data || [])
        if (!active && data && data.length) setActive(data[0])
      } catch {}
      try {
        const { data: reps } = await api.get('/battle/replays')
        setRecent((reps || []).slice(0, 10))
      } catch {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ensureUser() {
    if (!username.trim()) {
      const u = `Anonymous User #${Math.floor(Math.random()*9999)}`
      setUsername(u)
      const payload = btoa(JSON.stringify({ username: u }))
      document.cookie = `im_user=${encodeURIComponent(payload)}; path=/; max-age=${60*60*24*365}`
      return u
    }
    return username.trim()
  }

  async function submitPrompt() {
    const user = await ensureUser()
    if (!promptText.trim()) return
    await api.post('/battle/prompts', { text: promptText, username: user })
    setPromptText('')
  }

  async function quickPlay() {
    if (matching) return
    const ctl = new AbortController()
    setMatchingCtl(ctl)
    setMatching(true)
    setJoinedRoomId(null)
    try {
      const user = await ensureUser()
      // Try to find an available room (not in countdown and not full)
      const { data: rooms } = await api.get('/battle/rooms', { signal: ctl.signal as any })
      const pick = (rooms || []).find((r: any) => !r.countdown && (r.total < (r.capacity || 2)))
      let target = pick
      if (!target) {
        const { data } = await api.post('/battle/rooms', { name: 'Quick Match', username: user, capacity: 2 }, { signal: ctl.signal as any })
        target = data
      } else {
        try {
          await api.post(`/battle/rooms/${target.id}/join`, { username: user }, { signal: ctl.signal as any })
        } catch (err: any) {
          if (err?.response?.status === 409) {
            const { data } = await api.post('/battle/rooms', { name: 'Quick Match', username: user, capacity: 2 }, { signal: ctl.signal as any })
            target = data
          } else { throw err }
        }
      }
      setJoinedRoomId(target.id)
      // Auto-ready the user
      await api.post(`/battle/rooms/${target.id}/ready`, { username: user, ready: true }, { signal: ctl.signal as any })
      if (!ctl.signal.aborted) navigate(`/prompt-battle/room/${target.id}`)
    } catch (e) {
      // silently ignore aborts
    } finally {
      setMatching(false)
      setMatchingCtl(null)
    }
  }

  async function cancelMatching() {
    if (!matching) return
    const ctl = matchingCtl
    try {
      ctl?.abort()
    } catch {}
    if (joinedRoomId) {
      try {
        const user = await ensureUser()
        await api.post(`/battle/rooms/${joinedRoomId}/leave`, { username: user })
      } catch {}
    }
    setMatching(false)
    setJoinedRoomId(null)
    setMatchingCtl(null)
  }

  async function vote(choice: 'a'|'b') {
    if (!active) return
    await api.post(`/battle/vote/${active.id}`, { choice })
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto text-white">
      <RoomHeader emoji="🤖" title="AI Prompt Battle" subtitle="Submit your prompt. Watch AI creations duel. Vote for the winner." color="#60a5fa" />
      {matching && (
        <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm flex items-center justify-between" aria-live="polite">
          <span className="opacity-90">Matching you with an opponent…</span>
          <span className="text-xs opacity-70">You can cancel while matching.</span>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 col-span-12 lg:col-span-3">
          <label className="text-sm text-slate-300">Your name (optional)</label>
          <input className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mb-3" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Anonymous..." />
          <textarea className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mb-3" rows={4} value={promptText} onChange={e=>setPromptText(e.target.value)} placeholder="Type your wildest idea..." />
          <div className="flex gap-2">
            <button onClick={quickPlay} disabled={matching} className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded mb-2">{matching ? '⏳ Matching…' : '🚀 Enter Battle'}</button>
            {matching && (
              <button onClick={cancelMatching} className="w-28 bg-white/10 hover:bg-white/20 py-2 rounded mb-2 border border-white/10">Cancel</button>
            )}
          </div>
          <button onClick={submitPrompt} className="w-full bg-white/10 hover:bg-white/20 py-2 rounded mb-2 border border-white/10">Submit Prompt Only</button>
          <a href="/prompt-battle/room" className="block text-center text-xs underline text-slate-300">Or join a Battle Room →</a>
        </div>

        <div className="col-span-12 lg:col-span-6">
          {active ? (
<div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div onClick={()=>vote('a')} className="cursor-pointer bg-white/10 border border-purple-400/20 rounded-2xl p-4 hover:bg-purple-800/30 transition">
                {active.a_image_url && <img src={active.a_image_url} alt="Prompt A" className="rounded-lg object-cover w-full aspect-[4/3] sm:aspect-[16/10] hover:scale-105 transition" />}
                {active.a_text && <p className="mt-2 text-sm opacity-70">{active.a_text}</p>}
                <p className="text-xs text-slate-400">Votes: {active.votes_a}</p>
                {typeof (active as any).prompt_a_id === 'number' && (
                  <ReactionBar promptId={(active as any).prompt_a_id} username={username} />
                )}
              </div>
              <div onClick={()=>vote('b')} className="cursor-pointer bg-white/10 border border-pink-400/20 rounded-2xl p-4 hover:bg-purple-800/30 transition">
                {active.b_image_url && <img src={active.b_image_url} alt="Prompt B" className="rounded-lg object-cover w-full aspect-[4/3] sm:aspect-[16/10] hover:scale-105 transition" />}
                {active.b_text && <p className="mt-2 text-sm opacity-70">{active.b_text}</p>}
                <p className="text-xs text-slate-400">Votes: {active.votes_b}</p>
                {typeof (active as any).prompt_b_id === 'number' && (
                  <ReactionBar promptId={(active as any).prompt_b_id} username={username} />
                )}
              </div>
              <div className="absolute -inset-1 rounded-2xl border border-fuchsia-500/30 animate-pulse pointer-events-none" />
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-slate-300">Waiting for a battle...</div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-300">Ongoing Battles</div>
            <a href="/replays" className="text-xs underline">View all</a>
          </div>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {ongoing.slice(0,6).map(b => (
              <div key={b.id} className="p-3 rounded bg-white/10 border border-white/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {b.a_image_url && <img src={b.a_image_url} className="rounded w-full h-28 object-cover" />}
                    {b.a_text && <p className="text-xs mt-1 opacity-70">{b.a_text}</p>}
                  </div>
                  <div>
                    {b.b_image_url && <img src={b.b_image_url} className="rounded w-full h-28 object-cover" />}
                    {b.b_text && <p className="text-xs mt-1 opacity-70">{b.b_text}</p>}
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">Votes A: {b.votes_a} • Votes B: {b.votes_b}</div>
              </div>
            ))}
            {ongoing.length === 0 && <div className="text-slate-400 text-sm">No active battles yet.</div>}
          </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 h-[300px] overflow-y-auto">
          <div className="text-sm text-slate-300 mb-2">Recent Results</div>
          <div className="space-y-3">
            {recent.slice(0,6).map(b => (
              <div key={b.id} className="p-3 rounded bg-white/10 border border-white/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {b.a_image_url && <img src={b.a_image_url} className="rounded w-full h-20 object-cover" />}
                    {b.a_text && <p className="text-xs mt-1 opacity-70">{b.a_text}</p>}
                  </div>
                  <div>
                    {b.b_image_url && <img src={b.b_image_url} className="rounded w-full h-20 object-cover" />}
                    {b.b_text && <p className="text-xs mt-1 opacity-70">{b.b_text}</p>}
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">Votes A: {b.votes_a} • Votes B: {b.votes_b}</div>
              </div>
            ))}
            {recent.length === 0 && <div className="text-slate-400 text-sm">No results yet.</div>}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
