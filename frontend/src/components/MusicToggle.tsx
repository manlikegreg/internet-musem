import { useEffect, useRef, useState } from 'react'

export function MusicToggle() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const gainNodeRef = useRef<GainNode | null>(null)
  const [on, setOn] = useState(false)

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

    if (on && audioContextRef.current && gainNodeRef.current) {
      // Resume context if suspended (required by browsers)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume()
      }

      // Create ambient soundscape with multiple oscillators
      const frequencies = [220, 330, 440, 660] // Harmonic frequencies
      const oscillators: OscillatorNode[] = []

      frequencies.forEach((freq, index) => {
        const osc = audioContextRef.current!.createOscillator()
        const gain = audioContextRef.current!.createGain()
        
        osc.type = index % 2 === 0 ? 'sine' : 'triangle'
        osc.frequency.value = freq
        
        // Create subtle volume variations
        gain.gain.value = 0.1 + (index * 0.05)
        
        // Add slight frequency modulation for organic feel
        const lfo = audioContextRef.current!.createOscillator()
        const lfoGain = audioContextRef.current!.createGain()
        lfo.frequency.value = 0.1 + (index * 0.05) // Very slow modulation
        lfoGain.gain.value = 2 + (index * 0.5) // Subtle frequency variation
        
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        
        osc.connect(gain)
        gain.connect(gainNodeRef.current!)
        
        osc.start()
        lfo.start()
        
        oscillators.push(osc)
      })

      oscillatorsRef.current = oscillators
    } else {
      // Stop all oscillators
      oscillatorsRef.current.forEach(osc => {
        try {
          osc.stop()
        } catch (e) {
          // Oscillator might already be stopped
        }
      })
      oscillatorsRef.current = []
    }

    // Cleanup function
    return () => {
      oscillatorsRef.current.forEach(osc => {
        try {
          osc.stop()
        } catch (e) {
          // Oscillator might already be stopped
        }
      })
      oscillatorsRef.current = []
    }
  }, [on])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      oscillatorsRef.current.forEach(osc => {
        try {
          osc.stop()
        } catch (e) {
          // Oscillator might already be stopped
        }
      })
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
