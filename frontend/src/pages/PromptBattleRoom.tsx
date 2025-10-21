import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'
import { readCookieUser } from '../utils/auth'

interface RoomUser { username: string; ready: boolean }
interface RoomState { id: string; name: string; users: RoomUser[]; readyCount: number; total: number; countdown: { seconds: number } | null }

export default function PromptBattleRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useMemo(() => readCookieUser(), [])
  const username = user?.username || ''

  const [rooms, setRooms] = useState<RoomState[]>([])
  const [name, setName] = useState('Battle Room')
  const [room, setRoom] = useState<RoomState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!username) {
      navigate('/prompt-battle/login', { replace: true })
      return
    }
    let es: EventSource | null = null
    ;(async () => {
      try {
        if (id) {
          setLoading(true)
          try {
            const { data } = await api.get(`/battle/rooms/${id}`)
            setRoom(data)
            await api.post(`/battle/rooms/${id}/join`, { username })
          } finally { setLoading(false) }
        } else {
          const { data } = await api.get('/battle/rooms')
          setRooms(data)
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load')
      }
      try {
        es = new EventSource(`${baseURL}/battle/stream`)
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg?.type === 'rooms' && !id) setRooms(msg.data || [])
            if (msg?.type === 'room' && id && msg?.data?.id === id) setRoom(msg.data)
            if (msg?.type === 'room_start' && id && msg?.data?.id === id) navigate('/prompt-battle')
          } catch {}
        }
      } catch {}
    })()
    return () => { try { es?.close() } catch {} }
  }, [id, username])

  async function createRoom() {
    if (!username) return navigate('/prompt-battle/login')
    const { data } = await api.post('/battle/rooms', { name, username })
    navigate(`/prompt-battle/room/${data.id}`)
  }

  async function toggleReady(u: RoomUser) {
    if (!room) return
    await api.post(`/battle/rooms/${room.id}/ready`, { username, ready: !u.ready })
  }

  async function leaveRoom() {
    if (!room) return
    await api.post(`/battle/rooms/${room.id}/leave`, { username })
    navigate('/prompt-battle/room')
  }

  if (!id) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-white">
        <RoomHeader emoji="🧑‍🤝‍🧑" title="Battle Rooms" subtitle="Create or join a room to fight together" color="#34d399" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-4">
            <label className="text-sm text-slate-300">Room name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mb-3" />
            <button onClick={createRoom} className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded">Create Room</button>
            <div className="text-xs text-slate-400 mt-2">You will be added as the first participant.</div>
          </div>
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-slate-300 text-sm">Open Rooms</div>
              <button className="text-xs underline" onClick={async()=>{ const { data } = await api.get('/battle/rooms'); setRooms(data) }}>Refresh</button>
            </div>
            <div className="space-y-3">
              {rooms.map(r => (
                <div key={r.id} className="p-3 rounded bg-white/10 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.readyCount}/{r.total} ready</div>
                  </div>
                  <Link to={`/prompt-battle/room/${r.id}`} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-sm">Join</Link>
                </div>
              ))}
              {rooms.length === 0 && <div className="text-slate-400 text-sm">No rooms yet. Create one!</div>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <RoomHeader emoji="🏟️" title={room?.name || 'Room'} subtitle={room ? `${room.readyCount}/${room.total} ready` : 'Loading...'} color="#34d399" />
      {error && <div className="mb-3 text-sm text-red-300">{error}</div>}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        {loading && <div className="text-slate-400">Loading...</div>}
        {room && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-300">Room ID: <span className="font-mono">{room.id}</span></div>
              {room.countdown ? (
                <div className="px-3 py-1 rounded bg-emerald-600/20 border border-emerald-500/30">Starting in {room.countdown.seconds}s</div>
              ) : (
                <div className="text-xs text-slate-400">Waiting for all players to ready up…</div>
              )}
            </div>
            <div className="space-y-2">
              {room.users.map(u => (
                <div key={u.username} className="flex items-center justify-between p-2 rounded bg-white/10 border border-white/10">
                  <div className="font-medium">{u.username}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${u.ready ? 'text-emerald-400' : 'text-slate-400'}`}>{u.ready ? 'Ready' : 'Not ready'}</span>
                    {u.username === username && (
                      <button onClick={()=>toggleReady(u)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-xs">{u.ready ? 'Unready' : 'Ready'}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Link to="/prompt-battle" className="text-sm underline">Back to battle</Link>
              <button onClick={leaveRoom} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-sm">Leave Room</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}