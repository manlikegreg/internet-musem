import { useEffect, useMemo, useRef, useState } from 'react'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

type Mood = {
  id: string
  username: string
  emoji: string
  text: string | null
  sentiment: number
  created_at: string
}

const EMOJIS = ['😄','😢','😡','😴','😍','😐','😭','🤩','🤔'] as const

function sentimentFromEmoji(e: string) {
  const map: Record<string, number> = {
    '😄': 4, '😢': -4, '😡': -4, '😴': -1,
    '😍': 5, '😐': 0,  '😭': -5, '🤩': 4,
    '🤔': -1,
  }
  return map[e] ?? 0
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

function gradientForAverage(avg: number) {
  // Map average sentiment -> gradient (happy/sad/angry/calm/anxious/excited)
  if (avg >= 4) return 'linear-gradient(135deg, #ff80bf, #fb923c)'
  if (avg >= 2) return 'linear-gradient(135deg, #ffd166, #ff9e80)'
  if (avg >= 0.5) return 'linear-gradient(135deg, #14b8a6, #06b6d4)'
  if (avg <= -4) return 'linear-gradient(135deg, #ef4444, #7f1d1d)'
  if (avg <= -2) return 'linear-gradient(135deg, #1e3a8a, #475569)'
  if (avg <= -0.5) return 'linear-gradient(135deg, #a78bfa, #ec4899)'
  return 'linear-gradient(135deg, #94a3b8, #e2e8f0)'
}

function toneLabel(avg: number) {
  if (avg >= 4) return 'Excited'
  if (avg >= 2) return 'Happy'
  if (avg >= 0.5) return 'Calm'
  if (avg <= -4) return 'Angry'
  if (avg <= -2) return 'Sad'
  if (avg <= -0.5) return 'Anxious'
  return 'Neutral'
}

function getMoodColor(sentiment: number) {
  if (sentiment >= 4) return '#fb923c'
  if (sentiment >= 2) return '#f59e0b'
  if (sentiment >= 1) return '#10b981'
  if (sentiment <= -4) return '#ef4444'
  if (sentiment <= -2) return '#2563eb'
  if (sentiment <= -1) return '#a78bfa'
  return '#94a3b8'
}

function hashTo01(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

function MoodBubble({ mood }: { mood: Mood }) {
  const x = useMemo(() => 5 + hashTo01(mood.id + 'x') * 90, [mood.id])
  const y = useMemo(() => 5 + hashTo01(mood.id + 'y') * 70, [mood.id])
  const size = useMemo(() => 28 + Math.floor(hashTo01(mood.id + 's') * 28), [mood.id])
  const dur = useMemo(() => 10 + Math.floor(hashTo01(mood.id + 'd') * 12), [mood.id])
  return (
    <div
      className="absolute select-none"
      style={{
        left: `${x}%`,
        bottom: `${y}%`,
        fontSize: `${size}px`,
        color: getMoodColor(mood.sentiment),
        filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.3))',
        animation: `floatY ${dur}s ease-in-out infinite, driftX ${dur + 6}s ease-in-out infinite`,
      }}
      title={mood.text || ''}
    >
      {mood.emoji}
    </div>
  )
}

function MoodInput({ onSubmit }: { onSubmit: (emoji: string, text: string) => Promise<void> }) {
  const [emoji, setEmoji] = useState<string>('😐')
  const [text, setText] = useState<string>('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!emoji) return
        setBusy(true)
        try { await onSubmit(emoji, text) } finally { setBusy(false); setText('') }
      }}
      className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur shadow-inner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-slate-400 text-sm">How do you feel?</div>
        <div className="flex gap-2">
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`h-10 w-10 rounded-xl border ${emoji===e?'border-slate-200 bg-slate-200/10':'border-slate-700 hover:border-slate-500'}`}
            >
              <span className="text-xl leading-10 block">{e}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 bg-slate-950/60 border border-slate-700 p-2 rounded-xl text-slate-200 placeholder-slate-500"
          placeholder="Describe your mood in one line..."
          value={text}
          onChange={e=>setText(e.target.value)}
          maxLength={160}
        />
        <button
          disabled={busy}
          className="shrink-0 rounded-xl px-4 bg-slate-200 text-slate-900 hover:bg-white transition"
        >{busy? 'Reflecting…' : 'Reflect Mood'}</button>
      </div>
    </form>
  )
}

function MoodStream({ moods }: { moods: Mood[] }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 max-h-72 overflow-auto">
      <div className="text-xs text-slate-400 mb-2">Mood Stream (Live)</div>
      <ul className="space-y-1">
        {moods.slice(0, 30).map(m => (
          <li key={m.id} className="text-sm text-slate-200/90">
            <span className="text-slate-400">{m.username}:</span> <span className="text-lg align-middle mr-1">{m.emoji}</span>
            {m.text ? <span className="text-slate-300">“{m.text}”</span> : <span className="text-slate-500">(no text)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function MoodVisualizer({ avg }: { avg: number }) {
  const grad = useMemo(() => gradientForAverage(avg), [avg])
  const opacity = 0.7
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
      <div
        className="absolute -inset-10 blur-3xl transition-all duration-700"
        style={{ backgroundImage: grad, opacity }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_60%)]" />
    </div>
  )
}

export default function MoodMirror() {
  const [moods, setMoods] = useState<Mood[]>([])
  const [connected, setConnected] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const average = useMemo(() => {
    if (!moods.length) return 0
    const sum = moods.reduce((acc, m) => acc + (typeof m.sentiment === 'number' ? m.sentiment : 0), 0)
    return Math.round((sum / moods.length) * 10) / 10
  }, [moods])

  useEffect(() => {
    const es = new EventSource(`${baseURL}/mood/stream`)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        if (payload?.type === 'seed' && Array.isArray(payload.data)) {
          setMoods(payload.data)
        } else if (payload?.type === 'mood' && payload.data) {
          setMoods(prev => [payload.data as Mood, ...prev.filter(p => p.id !== payload.data.id)])
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  async function submitMood(emoji: string, text: string) {
    await api.post('/mood/create', { emoji, text })
  }

  const tone = toneLabel(average)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <RoomHeader emoji="🪞" title="Mood Mirror" subtitle="Share how you feel — and watch the world change." color="#a78bfa" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="relative rounded-3xl border border-slate-800 bg-slate-900/50 p-4 md:p-6 overflow-hidden min-h-[28rem]">
            <MoodVisualizer avg={average} />

            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-300 text-sm">Collective Mood: <span className="font-medium text-slate-100">{tone}</span> <span className="text-slate-500">(avg {average.toFixed(1)})</span></div>
              <div className={`text-xs ${connected? 'text-emerald-400':'text-slate-500'}`}>{connected? 'Live' : 'Offline'}</div>
            </div>

            <MoodInput onSubmit={submitMood} />

            <div ref={listRef} className="relative mt-6 h-[18rem]">
              {moods.slice(0, 60).map(m => (
                <MoodBubble key={m.id} mood={m} />
              ))}
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5" />
          </div>
        </div>

        <div>
          <MoodStream moods={moods} />
        </div>
      </div>

      {/* Local keyframes for subtle float/drift */}
      <style>{`
        @keyframes floatY { 0%{ transform: translateY(0) } 50%{ transform: translateY(-18px) } 100%{ transform: translateY(0) } }
        @keyframes driftX { 0%{ transform: translateX(-6px) } 50%{ transform: translateX(6px) } 100%{ transform: translateX(-6px) } }
      `}</style>
    </div>
  )
}
