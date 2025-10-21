import { useEffect, useMemo, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'

interface Compliment { id: string; username: string; compliment: string; created_at: string; reactions?: Record<string, number> }

type StreamMsg =
  | { type: 'seed'; data: Compliment[] }
  | { type: 'compliment'; data: Compliment }

function randomPastel() {
  const hues = [330, 280, 200, 160, 45]
  const h = hues[Math.floor(Math.random() * hues.length)]
  const s = 70 + Math.floor(Math.random() * 15)
  const l = 85 + Math.floor(Math.random() * 10)
  return `hsl(${h} ${s}% ${l}%)`
}

import { motion } from 'framer-motion'

export default function ComplimentMachine() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [bubbles, setBubbles] = useState<{ id: string; msg: string; user: string; color: string; left: number; size: number; reactions?: Record<string, number> }[]>([])
  const [seeded, setSeeded] = useState(false)

  const esRef = useRef<EventSource | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'ComplimentMachine' }) }).catch(()=>{})
    const es = new EventSource(`${baseURL}/compliment/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const msg: StreamMsg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setSeeded(true)
          // show only a subset from seed as bubbles so the view stays airy
          const seed = (msg.data || []).slice(0, 10)
          seed.forEach(c => pushBubble(c))
        } else if (msg.type === 'compliment' && msg.data) {
          pushBubble(msg.data)
        } else if ((msg as any)?.type === 'reaction' && (msg as any)?.data) {
          const { id, reactions } = (msg as any).data
          setBubbles(prev => prev.map(b => b.id === id ? { ...b, reactions } : b))
        }
      } catch {}
    }
    return () => { es.close(); esRef.current = null }
  }, [])

  function displayName() {
    return `Anonymous ${Math.floor(Math.random() * 1000) + 1}`
  }

  function ensureAudio() {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(()=>{})
  }

  function playChime() {
    try {
      ensureAudio()
      const ctx = audioCtxRef.current
      if (!ctx) return
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
      gain.connect(ctx.destination)

      const o1 = ctx.createOscillator()
      o1.type = 'sine'
      o1.frequency.setValueAtTime(880, now) // A5
      o1.connect(gain)
      o1.start(now)
      o1.stop(now + 0.5)

      const o2 = ctx.createOscillator()
      o2.type = 'sine'
      o2.frequency.setValueAtTime(1175, now) // D6-ish
      o2.connect(gain)
      o2.start(now + 0.02)
      o2.stop(now + 0.45)
    } catch {}
  }

  function pushBubble(c: Compliment) {
    const id = c.id || Math.random().toString(36).slice(2)
    const msg = c.compliment
    const user = c.username
    const color = randomPastel()
    const left = Math.floor(Math.random() * 80) + 10 // 10% to 90%
    const size = Math.floor(Math.random() * 18) + 14 // font size in px
    const reactions = c.reactions || {}
    const b = { id, msg, user, color, left, size, reactions }
    setBubbles(prev => [b, ...prev].slice(0, 30))

    // play gentle chime when bubble appears
    playChime()

    // remove after 9s (animation length)
    setTimeout(() => {
      setBubbles(prev => prev.filter(x => x.id !== id))
    }, 9000)
  }

  async function sendCompliment() {
    if (!text.trim()) return
    setSending(true)
    try {
      await fetch(`${baseURL}/compliment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: displayName(), compliment: text.trim() })
      })
      setText('')
      // new bubble will arrive via SSE
    } finally {
      setSending(false)
    }
  }

  async function generate() {
    setGenerating(true)
    try {
      const r = await fetch(`${baseURL}/compliment/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await r.json()
      if (data?.compliment) setText(data.compliment)
    } finally {
      setGenerating(false)
    }
  }

  async function react(id: string, emoji: string) {
    // optimistic update if bubble still on screen
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, reactions: { ...(b.reactions || {}), [emoji]: ((b.reactions || {})[emoji] || 0) + 1 } } : b))
    await fetch(`${baseURL}/compliment/react/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji })
    }).catch(()=>{})
  }

  return (
    <motion.div className="min-h-[100svh] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #ffe6f0, #fff5ff 50%, #e6f7ff)' }} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0.98, scale: 0.98 }} transition={{ duration: 0.5 }}>
      {/* Background glowing orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle, #ffd1e6, transparent 60%)' }} />
        <div className="absolute bottom-0 right-20 w-72 h-72 rounded-full blur-3xl opacity-40" style={{ background: 'radial-gradient(circle, #d1e8ff, transparent 60%)' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}>🌈 The Compliment Machine</h1>
          <p className="text-black/70 mt-2">Send good vibes into the world. Someone out there needs it.</p>
        </header>

        <div className="bg-white/60 backdrop-blur rounded-2xl border border-white/70 shadow p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 bg-white border border-black/10 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200"
              placeholder="Write your compliment..."
              value={text}
              onChange={e=>setText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button onClick={sendCompliment} disabled={sending || !text.trim()} className="px-3 py-2 rounded-xl bg-pink-500 text-white shadow hover:shadow-md disabled:opacity-50">{sending ? 'Sending…' : 'Send Compliment'}</button>
              <button onClick={generate} disabled={generating} className="px-3 py-2 rounded-xl bg-white border border-black/10 hover:bg-black/5">{generating ? 'Thinking…' : 'Generate Random Compliment'}</button>
            </div>
          </div>
        </div>

        {/* Floating feed area */}
        <div className="relative mt-10 h-[420px]">
          {bubbles.map(b => (
            <div key={b.id} className="absolute animate-float will-change-transform" style={{ left: `${b.left}%`, bottom: '-16px', animationDuration: `${8 + Math.random()*3}s` }}>
              <div className="px-4 py-2 rounded-2xl shadow-lg text-black flex items-center gap-2 relative" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.7)', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.08))' }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="font-medium" style={{ fontSize: `${b.size}px` }}>{b.msg}</span>
                <span className="text-xs text-black/50">— {b.user}</span>

                {/* Reactions overlay */}
                <div className="absolute -top-3 right-1 bg-white/80 backdrop-blur px-2 py-0.5 rounded-full border border-white/70 text-[11px] flex items-center gap-1 shadow">
                  <button className="hover:scale-110 transition" onClick={()=>react(b.id, '💖')}>💖 <span className="text-black/50">{b.reactions?.['💖'] || b.reactions?.heart || 0}</span></button>
                  <button className="hover:scale-110 transition" onClick={()=>react(b.id, '😭')}>😭 <span className="text-black/50">{b.reactions?.['😭'] || b.reactions?.cry || 0}</span></button>
                  <button className="hover:scale-110 transition" onClick={()=>react(b.id, '🌈')}>🌈 <span className="text-black/50">{b.reactions?.['🌈'] || b.reactions?.rainbow || 0}</span></button>
                  <button className="hover:scale-110 transition" onClick={()=>react(b.id, '✨')}>✨ <span className="text-black/50">{b.reactions?.['✨'] || b.reactions?.sparkle || 0}</span></button>
                </div>
              </div>
            </div>
          ))}
          {!seeded && bubbles.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-black/40">Listening for kindness…</div>
          )}
        </div>
      </div>

      {/* page-scoped styles */}
      <style>
        {`
        @keyframes float {
          0% { transform: translateY(0) scale(0.98); opacity: 0.0; }
          10% { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.03); opacity: 0; }
        }
        .animate-float { animation: float 9s ease-in-out forwards }
        `}
      </style>
    </motion.div>
  )
}
