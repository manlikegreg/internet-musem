import { useEffect, useMemo, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'
import { RoomHeader } from '../components/RoomHeader'

interface ConfessionRow {
  id: string
  username: string
  text: string
  reactions: Record<string, number>
  created_at: string
}

type StreamMsg = { type: 'seed'|'new'|'reaction', data: any }

let sharedCtxConf: AudioContext | null = null
function getCtxConf() {
  if (typeof window === 'undefined') return null
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtxConf) sharedCtxConf = new Ctx()
  return sharedCtxConf
}

function createImpulse(ctx: AudioContext, seconds = 2.5, decay = 2.0) {
  const rate = ctx.sampleRate
  const len = rate * seconds
  const impulse = ctx.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const chan = impulse.getChannelData(c)
    for (let i=0; i<len; i++) {
      chan[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay)
    }
  }
  return impulse
}

const echoConf = { delay: 0.38, feedback: 0.55, decay: 2.3 }

function createEchoChainConf(ctx: AudioContext) {
  const delay = ctx.createDelay(2.0)
  delay.delayTime.value = echoConf.delay // longer than Void
  const feedback = ctx.createGain(); feedback.gain.value = echoConf.feedback
  const wet = ctx.createGain(); wet.gain.value = 0.95
  const dry = ctx.createGain(); dry.gain.value = 0.4
  const convolver = ctx.createConvolver(); convolver.buffer = createImpulse(ctx, 2.6, echoConf.decay)
  // delay feedback
  delay.connect(feedback); feedback.connect(delay)
  // chain: source -> dry & (delay -> convolver)
  return { delay, feedback, wet, dry, convolver }
}

async function playConfTextEcho() {
  const ctx = getCtxConf(); if (!ctx) return
  const dur = 1.2
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i=0;i<data.length;i++){
    const t = i/data.length
    const env = Math.max(0, 1 - t)
    data[i] = (Math.random()*2-1) * env
  }
  const src = ctx.createBufferSource(); src.buffer = buffer
  const master = ctx.createGain(); master.gain.value = 1.0
  const { delay, wet, dry, convolver } = createEchoChainConf(ctx)
  src.connect(dry); dry.connect(master)
  src.connect(delay); delay.connect(convolver); convolver.connect(wet); wet.connect(master)
  master.connect(ctx.destination)
  src.start()
}

async function playConfEchoFromBlob(blob: Blob) {
  const ctx = getCtxConf(); if (!ctx) return
  const url = URL.createObjectURL(blob)
  const el = new Audio(url)
  el.muted = true
  const source = ctx.createMediaElementSource(el)
  const master = ctx.createGain(); master.gain.value = 1.0
  const { delay, wet, dry, convolver } = createEchoChainConf(ctx)
  source.connect(dry); dry.connect(master)
  source.connect(delay); delay.connect(convolver); convolver.connect(wet); wet.connect(master)
  master.connect(ctx.destination)
  el.onended = () => { try { source.disconnect(); URL.revokeObjectURL(url) } catch {} }
  await el.play().catch(()=>{})
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const s = Math.floor(diff/1000); if (s < 10) return 'a moment ago'; if (s<60) return `${s}s ago`
  const m = Math.floor(s/60); if (m<60) return `${m}m ago`
  const h = Math.floor(m/60); if (h<24) return `${h}h ago`
  const days = Math.floor(h/24); return `${days}d ago`
}

function VoiceRecorderConf() {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)

  useEffect(() => { setSupported(typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator?.mediaDevices?.getUserMedia) }, [])

  async function start(){
    if (!supported || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        setProcessing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          // Local echo
          playConfEchoFromBlob(blob)
          const fd = new FormData(); fd.append('audio', blob, 'confession.webm')
          await fetch(`${baseURL}/confession/audio`, { method: 'POST', body: fd })
        } catch {}
        setProcessing(false); setRecording(false); setElapsed(0)
      }
      rec.start(1000)
      recRef.current = rec
      setRecording(true); setElapsed(0)
      let s=0; timerRef.current = window.setInterval(()=>{ s++; setElapsed(s); if (s>=180) stop() }, 1000)
    } catch {}
  }
  function stop(){
    try { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; recRef.current?.stop(); (recRef.current as any)?.stream?.getTracks?.().forEach((t:MediaStreamTrack)=>t.stop()) } catch {}
  }
  if (!supported) return null
  return (
    <div className="flex items-center">
      {!recording ? (
        <button onClick={start} disabled={processing} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10">🎙️</button>
      ) : (
        <button onClick={stop} className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20">⏹️ {Math.floor(elapsed/60).toString().padStart(2,'0')}:{(elapsed%60).toString().padStart(2,'0')}</button>
      )}
    </div>
  )
}

export default function ConfessionBooth() {
  const [text, setText] = useState('')
  const [items, setItems] = useState<ConfessionRow[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const qRef = useRef('')
  const containerRef = useRef<HTMLDivElement>(null)
  const userId = useMemo(() => {
    const k = 'im_confess_uid'
    let v = localStorage.getItem(k)
    if (!v) { v = Math.random().toString(36).slice(2); localStorage.setItem(k, v) }
    return v
  }, [])

  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'ConfessionBooth' }) }).catch(()=>{})
    // Load echo config
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/config/echo`)
        const cfg = await r.json()
        if (cfg?.confession) {
          echoConf.delay = Number(cfg.confession.delay) || echoConf.delay
          echoConf.feedback = Number(cfg.confession.feedback) || echoConf.feedback
          echoConf.decay = Number(cfg.confession.decay) || echoConf.decay
        }
      } catch {}
    })()

    // Initial fetch to persist across refresh and enable pagination
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/confession?limit=50`)
        const data = await r.json()
        if (Array.isArray(data)) setItems(data)
      } catch {}
    })()
    const es = new EventSource(`${baseURL}/confession/stream`)
    es.onmessage = (e) => {
      try {
        const msg: StreamMsg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          // Only set from seed if we don't have initial HTTP data yet
          setItems(prev => prev.length ? prev : msg.data)
        }
        if (msg.type === 'new' && msg.data) {
          // If searching, only add if it matches
          const ok = !qRef.current || (String(msg.data?.text || '').toLowerCase().includes(qRef.current.toLowerCase()))
          if (ok) setItems(prev => [msg.data, ...prev].slice(0, 200))
        }
        if (msg.type === 'reaction' && msg.data) {
          const { id, reactions } = msg.data
          setItems(prev => prev.map(it => it.id === id ? { ...it, reactions: reactions || it.reactions } : it))
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  async function submit() {
    setError('')
    const body = text.trim()
    if (!body) return
    if (body.length > 300) { setError('Max 300 characters'); return }
    setPosting(true)
    try {
      await fetch(`${baseURL}/confession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ text: body })
      })
      setText('')
    } catch (e: any) {
      setError('Failed to confess')
    } finally { setPosting(false) }
  }

  // Search bar debounce
  useEffect(() => {
    qRef.current = q
    const t = setTimeout(async () => {
      try {
        const url = q.trim() ? `${baseURL}/confession?limit=50&q=${encodeURIComponent(q.trim())}` : `${baseURL}/confession?limit=50`
        const r = await fetch(url)
        const data = await r.json()
        if (Array.isArray(data)) setItems(data)
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function react(id: string, emoji: string) {
    try {
      await fetch(`${baseURL}/confession/react/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) })
    } catch {}
  }

  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  async function loadMore() {
    if (loadingMore || !items.length) return
    setLoadingMore(true)
    try {
      const oldest = items[items.length - 1]
      const r = await fetch(`${baseURL}/confession?before=${encodeURIComponent(oldest.created_at)}&limit=30`)
      const data = await r.json()
      if (Array.isArray(data) && data.length) {
        // De-duplicate by id
        const map = new Map(items.map(i => [i.id, i]))
        for (const row of data) if (!map.has(row.id)) map.set(row.id, row)
        setItems(Array.from(map.values()).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()))
        if (data.length < 30) setHasMore(false)
      } else {
        setHasMore(false)
      }
    } catch {
      // ignore
    } finally { setLoadingMore(false) }
  }

  return (
    <div className="min-h-[100svh] text-white bg-gradient-to-b from-[#120916] via-[#0b0a16] to-black">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <RoomHeader emoji="🕯️" title="The Confession Booth" subtitle="Whisper your secrets into the digital void. They’ll live briefly, then fade away." color="#8b5cf6" />

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 mb-6 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none animate-pulse" style={{background: 'radial-gradient(60% 80% at 10% 0%, rgba(139,92,246,0.10) 0%, transparent 60%)'}} />
          <label className="relative z-10 block text-sm text-slate-300 mb-2">Your confession (max 300 chars)</label>
          <textarea value={text} onChange={e=>setText(e.target.value)} maxLength={300}
            className="relative z-10 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/40 shadow-inner"
            rows={3} placeholder="I still think about that one time..." />
          <div className="relative z-10 mt-3 flex items-center gap-3">
            <VoiceRecorderConf />
            <button onClick={submit} disabled={posting || !text.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg shadow-md">
              🕯️ Confess
            </button>
            {error && <div className="text-xs text-slate-300">{error}</div>}
            <div className="ml-auto text-xs text-slate-400">{text.length}/300</div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4 overflow-hidden min-h-[50vh]">
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div className="text-sm text-slate-300">Live confessions</div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search confessions..." className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm" />
          </div>
          <div className="absolute inset-0 animate-[pulse_8s_ease-in-out_infinite] opacity-40" style={{background: 'radial-gradient(50% 70% at 100% 0%, rgba(168,85,247,0.08) 0%, transparent 70%)'}} />
          <div className="relative z-10 space-y-3">
            {items.map((c) => (
              <div key={c.id}
                className="group p-3 sm:p-4 rounded-xl bg-black/40 border border-white/10 backdrop-blur-sm transition-all duration-700 ease-out opacity-100 translate-y-0 hover:bg-black/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-200">{c.username}</div>
                  <div className="text-xs text-slate-400">{timeAgo(c.created_at)}</div>
                </div>
                {c.text && <div className="mt-2 text-slate-100 leading-relaxed">{c.text}</div>}
                {(c as any).audio_url && (
                  <div className="mt-2"><audio src={(c as any).audio_url} controls preload="none" className="w-64 max-w-[80vw]" /></div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  {['💔','🙏','😳','😭'].map(e => (
                    <button key={e} onClick={()=>react(c.id, e)}
                      className="px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition flex items-center gap-1">
                      <span>{e}</span>
                      <span className="text-xs opacity-70">{(c.reactions && (c.reactions as any)[e]) || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center text-slate-400 py-10">The booth is quiet. Be the first to whisper.</div>
            )}
            {items.length > 0 && hasMore && (
              <div className="pt-3">
                <button onClick={loadMore} disabled={loadingMore}
                  className="w-full text-sm px-3 py-2 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50">
                  {loadingMore ? 'Loading more whispers…' : 'Load older whispers'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}