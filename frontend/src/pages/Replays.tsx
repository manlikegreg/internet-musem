import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

interface EnrichedBattle { id: number; a_image_url?: string|null; b_image_url?: string|null; a_text?: string|null; b_text?: string|null; votes_a: number; votes_b: number }

export default function Replays() {
  const [items, setItems] = useState<EnrichedBattle[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/battle/replays')
        setItems(data)
      } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <RoomHeader emoji="🎞️" title="Replay Gallery" subtitle="Recent battles in the arena" color="#f472b6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(b => (
          <div key={b.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                {b.a_image_url && <img src={b.a_image_url} className="rounded w-full h-48 object-cover" />}
                {b.a_text && <p className="text-xs mt-1 opacity-70">{b.a_text}</p>}
              </div>
              <div>
                {b.b_image_url && <img src={b.b_image_url} className="rounded w-full h-48 object-cover" />}
                {b.b_text && <p className="text-xs mt-1 opacity-70">{b.b_text}</p>}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-2">Votes A: {b.votes_a} • Votes B: {b.votes_b}</div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div className="text-slate-400">No replays yet.</div>
        )}
      </div>
    </div>
  )
}
