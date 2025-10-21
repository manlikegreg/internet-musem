import { useState } from 'react'
import { api } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

export default function Apology() {
  const [reason, setReason] = useState('Overusing semicolons in JavaScript')
  const [generated, setGenerated] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const { data } = await api.post('/apology', { reason })
    setGenerated(data.generated)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <RoomHeader emoji="😵‍💫" title="Apology Generator" subtitle="A sincere-not-sincere public apology. (AI if enabled)" color="#f472b6" />
      <form onSubmit={submit} className="flex gap-2 mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <input className="flex-1 bg-slate-950/60 border border-slate-700 p-2 rounded-xl" value={reason} onChange={e=>setReason(e.target.value)} />
        <button className="bg-slate-200 text-slate-900 rounded-xl px-4">Generate</button>
      </form>
      {generated && (
        <pre className="whitespace-pre-wrap border border-slate-800 rounded-2xl p-4 bg-slate-900/60">{generated}</pre>
      )}
    </div>
  )
}
