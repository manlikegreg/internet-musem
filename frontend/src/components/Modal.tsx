import React from 'react'

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[90vw] max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-xl">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-300 hover:text-white">✕</button>
        {children}
      </div>
    </div>
  )
}
