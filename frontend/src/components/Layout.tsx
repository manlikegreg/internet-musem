import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MusicToggle } from './MusicToggle'
import { LobbyButton } from './LobbyButton'
import { api } from '../api/client'

export function Layout({ children }: { children: React.ReactNode }) {
  const [links, setLinks] = useState<{ kofi: string, whatsapp?: string, telegram?: string, tiktok?: string }>({ kofi: 'https://ko-fi.com/its_simon_only' })

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/admin/config/links')
        setLinks({
          kofi: data?.kofi || 'https://ko-fi.com/its_simon_only',
          whatsapp: data?.whatsapp || '',
          telegram: data?.telegram || '',
          tiktok: data?.tiktok || ''
        })
      } catch {
        setLinks({ kofi: 'https://ko-fi.com/its_simon_only' })
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-slate-800">
        <Link to="/" className="font-semibold tracking-wide px-3 py-1 rounded border border-slate-700 bg-slate-900/60 hover:bg-slate-800 transition">🏛️ Internet Museum</Link>
        <div className="flex items-center gap-4">
          <nav className="hidden lg:flex gap-3 text-sm text-slate-300">
            <Link to="/graveyard">Graveyard</Link>
            <Link to="/prompt-battle">Prompt Battle</Link>
            <Link to="/prompt-battle/room">Battle Rooms</Link>
            <Link to="/leaderboard">Leaderboard</Link>
            <Link to="/replays">Replays</Link>
            <Link to="/confession">Confession</Link>
            <Link to="/void">Void</Link>
            <Link to="/oracle">Oracle</Link>
            <Link to="/timecapsule">Time Capsule</Link>
            <Link to="/apology">Apology</Link>
            <Link to="/compliments">Compliments</Link>
            <Link to="/mood-mirror">Mood Mirror</Link>
          </nav>
          <Link to="/" className="hidden sm:inline-flex px-3 py-1 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-sm">Visit Home</Link>
          <MusicToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="p-4 border-t border-slate-800 text-sm text-slate-400 flex items-center justify-between">
        <span>© {new Date().getFullYear()} Internet Museum</span>
        <div className="flex items-center gap-3">
          <a className="px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-pink-400/50 transition" href={links.kofi || 'https://ko-fi.com/its_simon_only'} target="_blank" rel="noreferrer">
            ☕ Support the Museum
          </a>
          {(links.whatsapp || links.telegram || links.tiktok) && (
            <div className="flex items-center gap-2">
              {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1 rounded-full bg-green-600 hover:bg-green-500 text-white border border-green-400/50">WhatsApp</a>}
              {links.telegram && <a href={links.telegram} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1 rounded-full bg-sky-600 hover:bg-sky-500 text-white border border-sky-400/50">Telegram</a>}
              {links.tiktok && <a href={links.tiktok} target="_blank" rel="noreferrer" className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-white border border-white/10">TikTok</a>}
            </div>
          )}
        </div>
      </footer>
      <LobbyButton />
    </div>
  )
}
