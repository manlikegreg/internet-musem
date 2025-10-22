import { useEffect, useRef, useState, useCallback } from 'react'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'
import { resolveMediaUrl } from '../utils/media'

interface Confession { id: number; message: string; created_at: string }

function MiniRecorderConfLegacy({ onUploaded }: { onUploaded?: ()=>void }) {
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
          const fd = new FormData(); fd.append('audio', blob, 'confession.webm')
          await fetch(`${baseURL}/confession/audio`, { method: 'POST', body: fd })
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

export default function Confession() {
  const [items, setItems] = useState<Confession[]>([])
  const [message, setMessage] = useState('')
  const [latest, setLatest] = useState<any[]>([])

  const load = useCallback(async () => {
    const { data } = await api.get<Confession[]>('/confess')
    setItems(data)
    try {
      const r = await fetch(`${baseURL}/confession?limit=10`)
      const d = await r.json()
      if (Array.isArray(d)) setLatest(d)
    } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    await api.post('/confess', { message })
    setMessage('')
    await load()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <RoomHeader emoji="😇" title="Confession Booth" subtitle="Share your tiny chaos. It feels lighter afterwards." color="#c084fc" />
      <form onSubmit={submit} className="flex gap-2 items-center mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <input className="flex-1 bg-slate-950/60 border border-slate-700 p-2 rounded-xl focus:outline-none focus:ring focus:ring-slate-700" placeholder="Tell us your sins... anonymously" value={message} onChange={e=>setMessage(e.target.value)} />
        <MiniRecorderConfLegacy onUploaded={load} />
        <button className="bg-slate-200 text-slate-900 rounded-xl px-4">Confess</button>
      </form>
      <ul className="space-y-3">
        {items.map(c => (
          <li key={c.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-900/60 text-slate-200">{c.message}</li>
        ))}
      </ul>

      {latest.length > 0 && (
        <div className="mt-8">
          <div className="text-sm text-slate-400 mb-2">Recent (live room)</div>
          <ul className="space-y-3">
            {latest.map((c:any) => (
              <li key={c.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-900/60 text-slate-200">
                {c.text && <div className="mb-1">{c.text}</div>}
                {c.audio_url && <audio src={resolveMediaUrl(c.audio_url)} controls preload="none" className="w-64" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
