import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

type Row = { id: number; username: string; text: string; wins: number; total_votes: number }

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/battle/leaderboard')
        setRows(data)
      } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="p-6 max-w-4xl mx-auto text-white">
      <RoomHeader emoji="🏆" title="Prompt Battle Leaderboard" subtitle="Top prompts by wins and votes" color="#a78bfa" />
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Prompt</th>
              <th className="text-left p-3">Wins</th>
              <th className="text-left p-3">Votes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="p-3 opacity-70">{i+1}</td>
                <td className="p-3">{r.username}</td>
                <td className="p-3 text-slate-300">{r.text}</td>
                <td className="p-3">{r.wins ?? 0}</td>
                <td className="p-3">{r.total_votes ?? 0}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td className="p-4 text-center text-slate-400" colSpan={5}>No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
