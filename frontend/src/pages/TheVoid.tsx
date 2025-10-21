import { useEffect, useMemo, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(), s: 0.5 + Math.random() * 1.5
    }))
    function draw() {
      if (!canvas) return
      const w = canvas.width = canvas.offsetWidth
      const h = canvas.height = canvas.offsetHeight
      ctx.clearRect(0,0,w,h)
      for (const st of stars) {
        st.y -= 0.0008 + st.z * 0.001
        if (st.y < -0.05) st.y = 1.05
        const X = st.x * w, Y = st.y * h
        const r = st.s
        ctx.fillStyle = 'rgba(200,180,255,0.8)'
        ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI*2); ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="pointer-events-none select-none absolute inset-0" />
}

interface Echo { id: string; username: string; text: string; created_at: string }

type Msg = { type: 'seed'|'void'; data: Echo | Echo[] }

function getAnonName() {
  const k = 'im_anon_ix'
  let v = localStorage.getItem(k)
  if (!v) { v = String(Math.floor(Math.random()*9999)+1); localStorage.setItem(k, v) }
  return `Anonymous ${v}`
}

function pad(n: number) { return n.toString().padStart(2, '0') }

function VoiceRecorder() {
  const [supported, setSupported] = useState<boolean>(false)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recRef = (window as any)?.recRef || { current: null as MediaRecorder | null }
  const timerRef = useRef<number | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'MediaRecorder' in window && navigator?.mediaDevices?.getUserMedia)
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
  }, [])

  async function start() {
    if (!supported || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        setProcessing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          // Play echo of recorded audio immediately
          playEchoFromBlob(blob)
          // Upload
          const fd = new FormData()
          fd.append('audio', blob, 'scream.webm')
          await fetch(`${baseURL}/void/audio`, { method: 'POST', body: fd })
        } catch {}
        setProcessing(false)
        setRecording(false)
        setElapsed(0)
      }
      rec.start(1000)
      ;(recRef as any).current = rec
      setRecording(true)
      setElapsed(0)
      // Timer and 3-min limit
      let secs = 0
      timerRef.current = window.setInterval(() => {
        secs += 1
        setElapsed(secs)
        if (secs >= 180) stop() // auto stop at 3 minutes
      }, 1000)
    } catch {}
  }

  function stop() {
    try {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      ;(recRef as any).current?.stop()
      ;(recRef as any).current?.stream.getTracks().forEach((t: MediaStreamTrack)=>t.stop())
    } catch {}
  }

  if (!supported) return null

  return (
    <div className="flex items-center gap-2">
      {!recording ? (
        <button onClick={start} disabled={processing} title="Record up to 3 minutes"
          className="px-3 py-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50">
          🎙️
        </button>
      ) : (
        <button onClick={stop} className="px-3 py-3 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20">
          ⏹️ {pad(Math.floor(elapsed/60))}:{pad(elapsed%60)}
        </button>
      )}
    </div>
  )
}

let sharedCtx: AudioContext | null = null
function getCtx() {
  if (typeof window === 'undefined') return null
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  if (!sharedCtx) sharedCtx = new Ctx()
  return sharedCtx
}

const echoVoid = { delay: 0.22, feedback: 0.35, decay: 1.0 }

function createEchoChain(ctx: AudioContext) {
  const delay = ctx.createDelay(1.0)
  delay.delayTime.value = echoVoid.delay
  const feedback = ctx.createGain()
  feedback.gain.value = echoVoid.feedback
  const wet = ctx.createGain(); wet.gain.value = 0.9
  const dry = ctx.createGain(); dry.gain.value = 0.5
  // feedback loop
  delay.connect(feedback)
  feedback.connect(delay)
  return { delay, feedback, wet, dry }
}

async function playNoiseEcho() {
  const ctx = getCtx(); if (!ctx) return
  const dur = 1.0
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i=0; i<data.length; i++) {
    const t = i / data.length
    const env = Math.max(0, Math.pow(1 - t, echoVoid.decay))
    data[i] = (Math.random() * 2 - 1) * env
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const master = ctx.createGain(); master.gain.value = 1.0
  const { delay, wet, dry } = createEchoChain(ctx)
  src.connect(dry)
  dry.connect(master)
  src.connect(delay)
  delay.connect(wet)
  wet.connect(master)
  master.connect(ctx.destination)
  src.start()
}

async function playEchoFromBlob(blob: Blob) {
  const ctx = getCtx(); if (!ctx) return
  const url = URL.createObjectURL(blob)
  const el = new Audio(url)
  el.muted = true
  const source = ctx.createMediaElementSource(el)
  const master = ctx.createGain(); master.gain.value = 1.0
  const { delay, wet, dry } = createEchoChain(ctx)
  source.connect(dry)
  dry.connect(master)
  source.connect(delay)
  delay.connect(wet)
  wet.connect(master)
  master.connect(ctx.destination)
  el.onended = () => { try { source.disconnect(); URL.revokeObjectURL(url) } catch {} }
  await el.play().catch(()=>{})
}

export default function TheVoid() {
  const [text, setText] = useState('')
  const [items, setItems] = useState<Echo[]>([])
  const [sending, setSending] = useState(false)
  const anon = useMemo(getAnonName, [])
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    // load echo config
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/config/echo`)
        const cfg = await r.json()
        if (cfg?.void) {
          echoVoid.delay = Number(cfg.void.delay) || echoVoid.delay
          echoVoid.feedback = Number(cfg.void.feedback) || echoVoid.feedback
          echoVoid.decay = Number(cfg.void.decay) || echoVoid.decay
        }
      } catch {}
    })()

    // initial fetch (persist)
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/void?limit=50`)
        const data = await r.json()
        if (Array.isArray(data)) setItems(data)
      } catch {}
    })()

    const es = new EventSource(`${baseURL}/void/stream`)
    let hits: number[] = []
    es.onmessage = (e) => {
      try {
        const now = Date.now()
        hits = hits.filter(t => now - t < 3000)
        const msg: Msg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setItems(prev => prev.length ? prev : (msg.data as Echo[]))
        } else if (msg.type === 'void' && msg.data && !Array.isArray(msg.data)) {
          hits.push(now)
          if (hits.length >= 3) setPulse(now)
          setItems(prev => [msg.data as Echo, ...prev].slice(0, 300))
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  async function scream() {
    const body = text.trim()
    if (!body) return
    if (body.length > 200) return
    setSending(true)
    try {
      await fetch(`${baseURL}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body })
      })
      // Play an echo effect locally
      playNoiseEcho()
      setText('')
    } catch {} finally { setSending(false) }
  }

  return (
    <div className="min-h-[100svh] text-white relative overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.12),transparent_60%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.10),transparent_60%),#000]">
      <Starfield />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <RoomHeader emoji="🕳️" title="The Void" subtitle="Scream into the digital abyss. No replies, no judgment — just echoes." color="#6d28d9" />

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 mb-8">
          <label className="block text-sm text-slate-300 mb-2">Type your thoughts into The Void… (max 200 chars)</label>
          <div className="flex gap-2 items-center">
            <input value={text} onChange={e=>setText(e.target.value)} maxLength={200}
              className="flex-1 p-3 rounded-lg bg-black/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-600/40 placeholder-slate-400"
              placeholder="Let it out…" />
            <VoiceRecorder />
            <button onClick={scream} disabled={sending || !text.trim()}
              className="px-4 sm:px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-[0_0_20px_rgba(109,40,217,0.25)] active:scale-[0.99]">
              🕳️ Scream
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400">Posting as {anon}</div>
        </div>

        <div className="relative h-[60vh] sm:h-[70vh] overflow-hidden pointer-events-none select-none">
          {/* energy pulse */}
          <div key={pulse} className={`absolute inset-0 ${pulse? 'animate-[pulse_1.2s_ease-out_1]':''}`} style={{ boxShadow: pulse? 'inset 0 0 120px rgba(167,139,250,0.25)' : 'none' }} />
          {items.map((it, i) => (
            <div key={it.id + ':' + i}
              className="absolute bottom-0 left-1/2 -translate-x-1/2 text-slate-100 text-sm sm:text-base opacity-90 animate-void-float"
              style={{ animationDelay: `${(i%30)*0.3}s`, transform: `translateX(${(Math.sin(i)*40)}px)` }}>
              <span className="opacity-70">{it.username}:</span> {it.text ? `“${it.text}”` : ''}
              { (it as any).audio_url && (
                <div className="mt-2">
                  <audio src={(it as any).audio_url} controls preload="none" className="w-64 max-w-[80vw]" />
                </div>
              )}
            </div>
          ))}
          {/* subtle stars */}
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_50%_120%,rgba(109,40,217,0.08),transparent_60%)]" />
        </div>
      </div>
    </div>
  )
}