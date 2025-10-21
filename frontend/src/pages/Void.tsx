import { useEffect, useRef, useState } from 'react'
import { api, baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'
import { RoomHeader } from '../components/RoomHeader'

function MiniRecorderVoid({ onUploaded }: { onUploaded?: ()=>void }) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  useEffect(()=>{ setSupported(typeof window!=='undefined' && 'MediaRecorder' in window && !!(window.navigator && window.navigator.mediaDevices && typeof window.navigator.mediaDevices.getUserMedia === 'function')) }, [])
  async function start(){
    if (!supported || recording) return
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e=>{ if (e.data && e.data.size>0) chunksRef.current.push(e.data) }
      rec.onstop = async ()=>{
        setProcessing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
          const fd = new FormData(); fd.append('audio', blob, 'void.webm')
          await fetch(`${baseURL}/void/audio`, { method: 'POST', body: fd })
          onUploaded?.()
        } catch {}
        setProcessing(false); setRecording(false); setElapsed(0)
      }
      rec.start(1000); recRef.current = rec; setRecording(true); setElapsed(0)
      let s=0; timerRef.current = window.setInterval(()=>{ s++; setElapsed(s); if(s>=180) stop() }, 1000)
    } catch {}
  }
  function stop(){ try { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current=null; recRef.current?.stop(); (recRef.current as any)?.stream?.getTracks?.().forEach((t:MediaStreamTrack)=>t.stop()) } catch {} }
  if (!supported) return null
  return (
    <div>
      {!recording ? (
        <button onClick={start} disabled={processing} className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800">🎙️</button>
      ) : (
        <button onClick={stop} className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20">⏹️ {Math.floor(elapsed/60).toString().padStart(2,'0')}:{(elapsed%60).toString().padStart(2,'0')}</button>
      )}
    </div>
  )
}

export default function VoidPage() {
  const [content, setContent] = useState('')
  const [sent, setSent] = useState(false)
  const [latest, setLatest] = useState<any[]>([])
  // Ambient wind
  const audioCtxRef = useRef<AudioContext | null>(null)
  const windNodeRef = useRef<AudioBufferSourceNode | ScriptProcessorNode | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const [windOn, setWindOn] = useState(false)

  function ensureAudio() {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {}
    }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume().catch(()=>{})
  }

  function startWind() {
    ensureAudio()
    const ctx = audioCtxRef.current; if (!ctx) return
    if (windNodeRef.current) return
    const bufferSize = 2 ** 14
    const node = ctx.createScriptProcessor(bufferSize, 1, 1)
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 300; filter.Q.value = 0.6
    const gain = ctx.createGain(); gain.gain.value = 0.02
    node.onaudioprocess = (e: any) => {
      const out = e.outputBuffer.getChannelData(0)
      for (let i=0;i<out.length;i++) {
        out[i] = (Math.random()*2 - 1) * 0.6
      }
    }
    node.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    windNodeRef.current = node; filterRef.current = filter; gainRef.current = gain
    setWindOn(true)
  }
  function stopWind() {
    try { (windNodeRef.current as any)?.disconnect?.(); filterRef.current?.disconnect(); gainRef.current?.disconnect() } catch {}
    windNodeRef.current = null; filterRef.current = null; gainRef.current = null
    setWindOn(false)
  }

  async function loadLatest() {
    try {
      const r = await fetch(`${baseURL}/void?limit=10`)
      const d = await r.json()
      if (Array.isArray(d)) setLatest(d)
    } catch {}
  }

  useEffect(() => { loadLatest() }, [])
  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'Void' }) }).catch(()=>{})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/void', { content })
    setContent('')
    setSent(true)
    setTimeout(() => setSent(false), 1500)
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <RoomHeader emoji="🕳️" title="The Void" subtitle="Catharsis achieved. Nothing is stored." color="#64748b" />
        <button className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800" onClick={()=>{ windOn ? stopWind() : startWind() }}>{windOn ? '🔇 Wind' : '🔊 Wind'}</button>
      </div>
      <form onSubmit={submit} className="flex gap-2 items-center rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <input className="flex-1 bg-slate-950/60 border border-slate-700 p-2 rounded-xl focus:outline-none focus:ring focus:ring-slate-700" placeholder="Scream safely into the void..." value={content} onChange={e=>setContent(e.target.value)} />
        <MiniRecorderVoid onUploaded={loadLatest} />
        <button className="bg-slate-200 text-slate-900 rounded-xl px-4">Scream</button>
      </form>
      {sent && <div className="mt-4 text-green-400">The void has accepted your offering.</div>}

      {latest.length > 0 && (
        <div className="mt-8">
          <div className="text-sm text-slate-400 mb-2">Recent (live room)</div>
          <ul className="space-y-3">
            {latest.map((it:any) => (
              <li key={it.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-900/60 text-slate-200">
                {it.text && <div className="mb-1">{it.text}</div>}
                {it.audio_url && <audio src={it.audio_url} controls preload="none" className="w-64" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
