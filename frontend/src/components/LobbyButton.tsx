import { Link, useLocation } from 'react-router-dom'

export function LobbyButton() {
  const { pathname } = useLocation()
  if (pathname === '/') return null
  return (
    <Link to="/" className="fixed left-4 bottom-4 z-40 px-4 py-2 rounded-full border border-slate-700 bg-slate-900/80 backdrop-blur text-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:bg-slate-800 transition">
      🏛️ Lobby
    </Link>
  )
}
