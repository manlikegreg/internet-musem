import { useEffect, useRef, useState } from 'react'

export function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/ambient.mp3')
      audioRef.current.loop = true
      audioRef.current.volume = 0.3
    }
    if (on) {
      audioRef.current?.play().catch(() => {})
    } else {
      audioRef.current?.pause()
    }
  }, [on])

  return (
    <button onClick={() => setOn(v => !v)} className="px-3 py-1 rounded border border-slate-700 text-sm hover:bg-slate-800">
      {on ? '🔊 Ambient On' : '🔈 Ambient Off'}
    </button>
  )
}
