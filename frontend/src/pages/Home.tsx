import { RoomCard } from '../components/RoomCard'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { baseURL } from '../api/client'
import { ensureUserCookie } from '../lib/identity'

export default function Home() {
  const rooms = [
    { to: '/graveyard', title: 'Internet Graveyard', emoji: '🪦', color: '#94a3b8', subtitle: 'Bury your dead ideas, failed dreams, and expired memes. — Nostalgic + funny' },
    { to: '/prompt-battle', title: 'AI Prompt Battle', emoji: '🤖', color: '#60a5fa', subtitle: 'Pit your creativity against the machine — who prompts better? — Creative + competitive' },
    { to: '/confession', title: 'Confession Booth', emoji: '😇', color: '#c084fc', subtitle: 'Drop your secrets anonymously into the void of empathy. — Anon + humorous' },
    { to: '/void', title: 'The Void', emoji: '🕳️', color: '#64748b', subtitle: 'Scream into the digital abyss — and let it vanish forever. — Mysterious + emotional' },
    { to: '/oracle', title: 'Internet Oracle', emoji: '🔮', color: '#34d399', subtitle: 'Ask absurd questions, receive divine nonsense from AI. — Spiritual + absurd' },
    { to: '/timecapsule', title: 'Time Capsule', emoji: '📦', color: '#f59e0b', subtitle: 'Leave a message for the future — or your future self. — Nostalgic + personal' },
    { to: '/apology', title: 'Apology Generator', emoji: '😵‍💫', color: '#f472b6', subtitle: 'Generate over-the-top public apologies for fun or regret. — Satirical + social' },
    { to: '/compliments', title: 'Compliment Machine', emoji: '🌈', color: '#22d3ee', subtitle: 'Receive or send random wholesome internet compliments. — Wholesome + uplifting' },
    { to: '/dreams', title: 'Dream Archive', emoji: '🧿', color: '#93c5fd', subtitle: 'Write down your strange dreams and read others’ surreal stories. — Dreamy + poetic' },
    { to: '/mood-mirror', title: 'Mood Mirror', emoji: '🪞', color: '#a78bfa', subtitle: 'Reflect and get an AI reading of your current digital aura. — Playful + introspective' },
  ]

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(r => (`${r.title} ${r.subtitle || ''}`).toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    const uid = ensureUserCookie()
    fetch(`${baseURL}/visit/hit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: uid, room: 'Home' }) }).catch(()=>{})
  }, [])

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-3xl font-semibold">🏛️ Internet Museum of Feelings</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="text-slate-300 mt-1">Explore the digital afterlife of emotions.</motion.p>
      </div>
      <div className="max-w-3xl mx-auto mb-6">
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Search rooms (e.g., oracle, graveyard, compliments)"
          className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {filtered.map(r => (
          <RoomCard key={r.to} to={r.to} title={r.title} emoji={r.emoji} color={r.color} subtitle={r.subtitle} />
        ))}
      </div>
      <div className="text-center text-sm text-slate-400 mt-8">
        <p>Built by bytecoder for the emotionally online 💾</p>
      </div>
    </div>
  )
}
