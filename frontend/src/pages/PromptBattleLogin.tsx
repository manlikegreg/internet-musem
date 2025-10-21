import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'

export default function PromptBattleLogin() {
  const [username, setUsername] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const m = document.cookie.match(/im_user=([^;]+)/)
    if (m) {
      try {
        const v = decodeURIComponent(m[1]); const o = JSON.parse(atob(v));
        if (o?.username) setUsername(o.username)
      } catch {}
    }
  }, [])

  async function proceed(anon?: boolean) {
    setPending(true)
    try {
      let name = username.trim()
      if (anon || !name) name = `Anonymous User #${Math.floor(Math.random()*9999)}`
      const { data } = await api.post('/users/login', { username: name })
      const payload = btoa(JSON.stringify({ username: data.username, token: data.token }))
      document.cookie = `im_user=${encodeURIComponent(payload)}; path=/; max-age=${60*60*24*365}`
      window.location.href = '/prompt-battle'
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to login')
    } finally { setPending(false) }
  }

  return (
    <div className="p-6 max-w-xl mx-auto text-white">
      <RoomHeader emoji="👤" title="Enter the Arena" subtitle="Login or continue as anonymous" color="#60a5fa" />
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <label className="text-sm text-slate-300">Username</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mb-3" placeholder="Your name" />
        <div className="flex gap-2">
          <button disabled={pending} onClick={()=>proceed(false)} className="flex-1 bg-purple-600 hover:bg-purple-700 py-2 rounded">Login</button>
          <button disabled={pending} onClick={()=>proceed(true)} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded">Continue as Anonymous</button>
        </div>
        {message && <div className="mt-2 text-xs text-slate-300">{message}</div>}
      </div>
    </div>
  )
}
