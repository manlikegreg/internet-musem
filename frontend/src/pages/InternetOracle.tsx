import { useEffect, useMemo, useRef, useState } from 'react'
import { baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

interface Reply { id: string; question_id: string; username: string; reply: string; created_at: string }
interface QA { id: string; username: string; question: string; answer?: string | null; created_at: string; replies?: Reply[] }

type Msg = { type: 'seed'|'question'|'reply'; data: any }

function anonSeeker() {
  const k = 'im_oracle_anon'
  let v = localStorage.getItem(k)
  if (!v) { v = String(Math.floor(Math.random()*9999)+1); localStorage.setItem(k, v) }
  return `Seeker ${v}`
}

let ctxOracle: AudioContext | null = null
function getAudioCtx() {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!AC) return null
  if (!ctxOracle) ctxOracle = new AC()
  return ctxOracle
}
function createImpulse(ctx: AudioContext, seconds=2, decay=3) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c=0;c<2;c++) {
    const d = buf.getChannelData(c)
    for (let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decay)
  }
  return buf
}
async function playGong() {
  const ctx = getAudioCtx(); if (!ctx) return
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 420
  const gain = ctx.createGain(); gain.gain.setValueAtTime(0.9, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8)
  const conv = ctx.createConvolver(); conv.buffer = createImpulse(ctx, 2.2, 2.8)
  osc.connect(gain); gain.connect(conv); conv.connect(ctx.destination)
  osc.start(); osc.stop(ctx.currentTime + 1.9)
}

function classify(q: QA): 'prophetic'|'funny'|'dark'|'other' {
  const text = `${q.answer || ''} ${(q.replies||[]).map(r=>r.reply).join(' ')}`.toLowerCase()
  const has = (arr:string[]) => arr.some(s=>text.includes(s))
  if (has(['lol','haha','funny','😂','😆','joke'])) return 'funny'
  if (has(['doom','void','dark','death','fear','ominous'])) return 'dark'
  if (has(['shall','destiny','prophecy','stars','omen','fate'])) return 'prophetic'
  return 'other'
}

export default function InternetOracle() {
  const [question, setQuestion] = useState('')
  const [items, setItems] = useState<QA[]>([])
  const [sending, setSending] = useState(false)
  const seeker = useMemo(anonSeeker, [])
  const [replying, setReplying] = useState<Record<string,string>>({})
  const [openReply, setOpenReply] = useState<Record<string, boolean>>({})

  const seeded = useRef(false)
  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch(`${baseURL}/oracle/questions?limit=50`)
        const data = await r.json()
        if (Array.isArray(data)) setItems(data)
      } catch {}
    })()

    const es = new EventSource(`${baseURL}/oracle/stream`)
    es.onmessage = (e) => {
      try {
        const msg: Msg = JSON.parse(e.data)
        if (msg.type === 'seed' && Array.isArray(msg.data)) {
          setItems(prev => prev.length ? prev : msg.data)
          seeded.current = true
        } else if (msg.type === 'question' && msg.data) {
          setItems(prev => [msg.data, ...prev])
          if (seeded.current) playGong()
        } else if (msg.type === 'reply' && msg.data) {
          const r: Reply = msg.data
          setItems(prev => prev.map(q => q.id === r.question_id ? { ...q, replies: [...(q.replies||[]), r] } : q))
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  async function ask() {
    const text = question.trim()
    if (!text) return
    setSending(true)
    try {
      await fetch(`${baseURL}/oracle/question`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      setQuestion('')
    } catch {} finally { setSending(false) }
  }

  async function replyTo(qid: string) {
    const text = (replying[qid] || '').trim()
    if (!text) return
    setReplying(v => ({ ...v, [qid]: '' }))
    try {
      await fetch(`${baseURL}/oracle/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId: qid, text }) })
    } catch {}
  }

  const [filter, setFilter] = useState<'all'|'prophetic'|'funny'|'dark'>('all')
  const trending = useMemo(() => {
    const scored = items.map(q => ({ q, score: (q.replies?.length || 0) + (q.answer ? 1 : 0) }))
    return scored.sort((a,b)=>b.score-a.score).slice(0,5).map(s=>s.q)
  }, [items])
  const visible = useMemo(() => items.filter(q => filter==='all' ? true : classify(q)===filter), [items, filter])

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-[#0f0a14] to-[#1a0f2a] text-white px-4 sm:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <RoomHeader emoji="🧿" title="The Internet Oracle" subtitle="Ask your question and witness the Oracle and others speak back." color="#a78bfa" />

        <div className="flex max-w-2xl mx-auto mb-8 gap-2">
          <input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={200}
            placeholder="What truth do you seek?"
            className="flex-1 bg-white/10 p-3 rounded-l-lg border border-white/10 placeholder-gray-400 focus:outline-none" />
          <button onClick={ask} disabled={sending || !question.trim()} className="bg-purple-600 hover:bg-purple-700 px-5 py-3 rounded-r-lg disabled:opacity-50">Ask</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={()=>setFilter('all')} className={`px-2 py-1 rounded text-sm ${filter==='all'?'bg-white/10':'bg-white/5 hover:bg-white/10'}`}>All</button>
              <button onClick={()=>setFilter('prophetic')} className={`px-2 py-1 rounded text-sm ${filter==='prophetic'?'bg-white/10':'bg-white/5 hover:bg-white/10'}`}>Prophetic</button>
              <button onClick={()=>setFilter('funny')} className={`px-2 py-1 rounded text-sm ${filter==='funny'?'bg-white/10':'bg-white/5 hover:bg-white/10'}`}>Funny</button>
              <button onClick={()=>setFilter('dark')} className={`px-2 py-1 rounded text-sm ${filter==='dark'?'bg-white/10':'bg-white/5 hover:bg-white/10'}`}>Dark</button>
            </div>
            {visible.map(q => (
            <div key={q.id} className="bg-white/5 p-4 rounded-xl shadow border border-white/10">
              <p className="text-sm opacity-80">{q.username} asks:</p>
              <p className="italic text-slate-200 mt-1">“{q.question}”</p>
              {q.answer && (
                <p className="mt-3 text-purple-300">🧿 Oracle: {q.answer}</p>
              )}
              <div className="mt-3 space-y-2">
                {(q.replies||[]).map(r => (
                  <div key={r.id} className="text-sm text-slate-300 ml-3 pl-3 border-l border-purple-500/30">
                    {r.username}: {r.reply}
                  </div>
                ))}
                {openReply[q.id] ? (
                  <div className="flex gap-2 mt-2">
                    <input value={replying[q.id] || ''} onChange={e=>setReplying(v=>({ ...v, [q.id]: e.target.value }))} maxLength={100}
                      placeholder="Reply to this prophecy…"
                      className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-sm placeholder-slate-400" />
                    <button onClick={()=>replyTo(q.id)} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Send</button>
                    <button onClick={()=>setOpenReply(v=>({ ...v, [q.id]: false }))} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>setOpenReply(v=>({ ...v, [q.id]: true }))} className="mt-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Reply</button>
                )}
              </div>
            </div>
            ))}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm text-slate-300 mb-2">Trending</div>
              <div className="space-y-3">
                {trending.map(t => (
                  <div key={t.id} className="p-2 rounded bg-white/5 border border-white/10">
                    <div className="text-xs opacity-80">{t.username}</div>
                    <div className="text-sm italic text-slate-200 line-clamp-2">“{t.question}”</div>
                    <div className="text-xs text-slate-400 mt-1">{t.replies?.length || 0} replies</div>
                  </div>
                ))}
                {trending.length === 0 && <div className="text-slate-400 text-sm">No trends yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
