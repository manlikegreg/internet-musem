import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export function MusicToggle() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [ambientUrl, setAmbientUrl] = useState<string | null>(null)
  const [on, setOn] = useState(false)

  // Fetch current ambient sound URL from Admin-configured setting
  useEffect(() => {
    let mounted = true
    const loadAmbient = async () => {
      try {
        const { data } = await api.get('/admin/config/ambient')
        if (mounted) setAmbientUrl(data?.url || null)
      } catch (e) {
        if (mounted) setAmbientUrl(null)
      }
    }
    loadAmbient()
    return () => { mounted = false }
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
      if (ambientUrl) {
        try {
          if (!audioRef.current) {
            audioRef.current = new Audio(ambientUrl)
            audioRef.current.loop = true
            audioRef.current.volume = 0.35
          } else if (audioRef.current.src !== ambientUrl) {
            audioRef.current.pause()
            audioRef.current.src = ambientUrl
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

  return (
    <button onClick={() => setOn(v => !v)} className="px-3 py-1 rounded border border-slate-700 text-sm hover:bg-slate-800">
      {on ? '🔊 Ambient On' : '🔈 Ambient Off'}
    </button>
  )
}
