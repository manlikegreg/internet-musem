import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export function RoomCard({ to, title, emoji, color, subtitle }: { to: string; title: string; emoji: string; color: string; subtitle?: string }) {
  return (
    <motion.div className="h-full" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
<Link to={to} className="relative block h-full min-h-[200px] rounded-2xl p-6 border border-slate-800 bg-slate-900/60 hover:bg-slate-900 transition-colors shadow-[0_0_30px_rgba(0,0,0,0.2)] overflow-hidden">
        <div className="relative z-10 h-full flex flex-col">
          <div className="text-3xl">
            <span>{emoji}</span>
          </div>
          <div className="mt-3 text-lg font-semibold" style={{ color }}>{title}</div>
          {subtitle && <div className="text-xs text-slate-300 mt-1">{subtitle}</div>}
          <div className="mt-auto pt-4 inline-flex items-center gap-1 text-xs text-slate-400">Enter Room <span>→</span></div>
        </div>
      </Link>
    </motion.div>
  )
}

function hexToRgba(hex: string, alpha: number) {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!res) return `rgba(148,163,184,${alpha})`
  const r = parseInt(res[1], 16)
  const g = parseInt(res[2], 16)
  const b = parseInt(res[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
