import { Link } from 'react-router-dom'
import { MusicToggle } from './MusicToggle'
import { LobbyButton } from './LobbyButton'

export function Layout({ children }: { children: React.ReactNode }) {
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
        <a className="underline" href="https://ko-fi.com/" target="_blank" rel="noreferrer">Support the Museum</a>
      </footer>
      <LobbyButton />
    </div>
  )
}
