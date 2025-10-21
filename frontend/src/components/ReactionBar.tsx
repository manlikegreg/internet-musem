import { useEffect, useState } from 'react'
import { api, baseURL } from '../api/client'

export function ReactionBar({ promptId, username }: { promptId: number; username?: string }) {
  const [counts, setCounts] = useState<{ emoji: string; c: number }[]>([])
  const choices = ['👍','🔥','😂','😍','😮','😢']

  useEffect(() => {
    let es: EventSource | null = null
    ;(async () => {
      try {
        const { data } = await api.get(`/battle/reactions/${promptId}`)
        setCounts(data || [])
      } catch {}
      try {
        es = new EventSource(`${baseURL}/battle/stream`)
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg?.type === 'reaction' && msg?.data?.promptId === promptId) {
              setCounts(msg.data.counts || [])
            }
          } catch {}
        }
      } catch {}
    })()
    return () => { try { es?.close() } catch {} }
  }, [promptId])

  async function react(emoji: string) {
    try {
      await api.post('/battle/react', { promptId, emoji, username })
    } catch {}
  }

  function getCount(e: string) {
    return counts.find(x => x.emoji === e)?.c || 0
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-sm">
      {choices.map(e => (
        <button key={e} onClick={()=>react(e)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10">
          <span className="mr-1">{e}</span><span className="opacity-70">{getCount(e)}</span>
        </button>
      ))}
    </div>
  )
}