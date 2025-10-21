import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export function MusicToggle() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ambientUrl, setAmbientUrl] = useState<string | null>(null)
  const [on, setOn] = useState(false)

  const resolveUrl = (url: string | null) => {
    if (!url) return null
    try {
      // If backend returns relative path like "/uploads/...", prefix with API origin
      if (url.startsWith('/')) {
        const base = (api.defaults.baseURL || '').replace(/\/api$/, '')
        if (base) return base + url
      }
      return url
    } catch {
      return url
    }
  }

  // Fetch current ambient sound URL from Admin-configured setting
  const loadAmbient = async () => {
    try {
      const { data } = await api.get('/admin/config/ambient')
      setAmbientUrl(data?.url || null)
    } catch (e) {
      setAmbientUrl(null)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => { if (mounted) await loadAmbient() })()
    // Re-fetch when page becomes visible (helps after refresh)
    const onVis = () => { if (document.visibilityState === 'visible') loadAmbient() }
    document.addEventListener('visibilitychange', onVis)
    return () => { mounted = false; document.removeEventListener('visibilitychange', onVis) }
  }, [])

  useEffect(() => {
    // Initialize Web Audio Context
    if (!audioContextRef.current && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        audioContextRef.current = new AudioContext()
        gainNodeRef.current = audioContextRef.current.createGain()
        gainNodeRef.current.gain.value = 0.15
        gainNodeRef.current.connect(audioContextRef.current.destination)
      }
    }

    if (on) {
      // Try playing Admin-selected ambient audio first
      const src = resolveUrl(ambientUrl)
      if (src) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio(src)
            audioRef.current.loop = true
            audioRef.current.volume = 0.35
          } else if (audioRef.current.src !== src) {
            audioRef.current.pause()
            audioRef.current.src = src
            audioRef.current.load()
          }
          audioRef.current.play().catch(() => {
            // If playback fails, fallback to generator below
          })
          return // Prefer Admin audio over generator
        } catch {
          // Fall through to generator
        }
      }

      // Fallback: Create ambient soundscape with multiple oscillators
      if (audioContextRef.current && gainNodeRef.current) {
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume()
        }
        const frequencies = [220, 330, 440, 660]
        const oscillators: OscillatorNode[] = []

        frequencies.forEach((freq, index) => {
          const osc = audioContextRef.current!.createOscillator()
          const gain = audioContextRef.current!.createGain()

          osc.type = index % 2 === 0 ? 'sine' : 'triangle'
          osc.frequency.value = freq

          gain.gain.value = 0.1 + (index * 0.05)

          const lfo = audioContextRef.current!.createOscillator()
          const lfoGain = audioContextRef.current!.createGain()
          lfo.frequency.value = 0.1 + (index * 0.05)
          lfoGain.gain.value = 2 + (index * 0.5)

          lfo.connect(lfoGain)
          lfoGain.connect(osc.frequency)

          osc.connect(gain)
          gain.connect(gainNodeRef.current!)

          osc.start()
          lfo.start()

          oscillators.push(osc)
        })

        oscillatorsRef.current = oscillators
      }
    } else {
      // Turn off: stop audio element and oscillators
      if (audioRef.current) {
        try { audioRef.current.pause() } catch {}
      }
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop() } catch {}
      })
      oscillatorsRef.current = []
    }

    // Cleanup function for effect re-runs
    return () => {
      oscillatorsRef.current.forEach(osc => { try { osc.stop() } catch {} })
      oscillatorsRef.current = []
    }
  }, [on, ambientUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause() } catch {}
      }
      oscillatorsRef.current.forEach(osc => { try { osc.stop() } catch {} })
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // When toggling ON, ensure latest ambient URL is fetched
  const handleToggle = async () => {
    setOn(v => !v)
    // If turning ON, try to refresh ambient URL first
    setTimeout(() => { if (!ambientUrl) loadAmbient() }, 0)
    // Resume context on user gesture to satisfy autoplay policies
    try { if (audioContextRef.current && audioContextRef.current.state === 'suspended') audioContextRef.current.resume() } catch {}
  }

  return (
    <button onClick={handleToggle} className="px-3 py-1 rounded border border-slate-700 text-sm hover:bg-slate-800">
      {on ? '🔊 Ambient On' : '🔈 Ambient Off'}
    </button>
  )
}
