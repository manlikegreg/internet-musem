import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

interface Compliment { id: number; message: string; from_name?: string | null }

export default function Compliments() {
  const [items, setItems] = useState<Compliment[]>([])
  const [message, setMessage] = useState('You make CSS look easy.')
  const [from, setFrom] = useState('Anonymous')

  async function load() {
    const { data } = await api.get<Compliment[]>('/compliment')
    setItems(data)
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await api.post('/compliment', { message, from_name: from })
    setMessage('')
    setFrom('Anonymous')
    await load()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <RoomHeader emoji="🌈" title="Compliment Machine" subtitle="Wholesome transmissions for fellow travelers." color="#22d3ee" />
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <input className="bg-slate-950/60 border border-slate-700 p-2 rounded-xl md:col-span-2" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a compliment" />
        <input className="bg-slate-950/60 border border-slate-700 p-2 rounded-xl" value={from} onChange={e=>setFrom(e.target.value)} placeholder="From" />
        <button className="bg-slate-200 text-slate-900 rounded-xl p-2 md:col-span-3">Send</button>
      </form>
      <ul className="space-y-3">
        {items.map(c => (
          <li key={c.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-900/60">
            <div>{c.message}</div>
            <div className="text-xs text-slate-500 mt-1">— {c.from_name || 'Anonymous'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
