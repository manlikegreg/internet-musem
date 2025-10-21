import React from 'react'

type Props = {
  emoji: string
  title: string
  subtitle: string
  color: string // hex color used for accent/gradient
}

export function RoomHeader({ emoji, title, subtitle, color }: Props) {
  const gradient = `radial-gradient(80% 120% at 0% 0%, ${hexToRgba(color, 0.25)} 0%, transparent 60%)`
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 mb-6">
      <div className="relative z-10 flex items-start gap-3">
        <div className="text-3xl select-none">{emoji}</div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          <p className="text-slate-300 text-sm mt-1">{subtitle}</p>
        </div>
      </div>
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: gradient }} />
      <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full blur-3xl" style={{ background: hexToRgba(color, 0.15) }} />
    </div>
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
