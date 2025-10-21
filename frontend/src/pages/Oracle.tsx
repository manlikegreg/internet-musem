import { useEffect, useState } from 'react'
import { api, baseURL } from '../api/client'
import { RoomHeader } from '../components/RoomHeader'
import { Modal } from '../components/Modal'

interface OracleLegacy {
  id: number
  question: string
  response: string
  source: string
}

interface Reply { id: string; question_id: string; username: string; reply: string; created_at: string }
interface QA { id: string; username: string; question: string; answer?: string | null; created_at: string; replies?: Reply[] }

export default function Oracle() {
  const [question, setQuestion] = useState('What wisdom do you hold for me today?')
  const [qa, setQa] = useState<QA | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')

  async function ask(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post<QA>('/oracle/question', { text: question })
      setQa(data)
    } finally {
      setLoading(false)
    }
  }

  async function openReplies() {
    if (!qa?.id) return
    try {
      const r = await fetch(`${baseURL}/oracle/questions/${qa.id}`)
      const full = await r.json()
      setReplies(Array.isArray(full.replies) ? full.replies : [])
      setModalOpen(true)
    } catch {}
  }

  async function sendReply() {
    if (!qa?.id || !replyText.trim()) return
    const text = replyText.trim()
    setReplyText('')
    try {
      const r = await api.post<Reply>('/oracle/reply', { questionId: qa.id, text })
      setReplies(prev => [...prev, r.data])
    } catch {}
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <RoomHeader emoji="🔮" title="Internet Oracle" subtitle="Ask a question. Receive cryptic, poetic guidance." color="#34d399" />
      <form onSubmit={ask} className="flex gap-2 mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <input value={question} onChange={e=>setQuestion(e.target.value)} className="flex-1 bg-slate-950/60 border border-slate-700 p-2 rounded-xl" />
        <button disabled={loading} className="bg-slate-200 text-slate-900 rounded-xl px-4">Consult</button>
      </form>
      {qa && (
        <div className="border border-slate-800 rounded-2xl p-4 bg-slate-900/60">
          <div className="text-sm text-slate-400">You asked:</div>
          <div className="mt-1 text-slate-200 italic">“{qa.question}”</div>
          {qa.answer && (
            <div className="mt-3 text-purple-300">🧿 Oracle: {qa.answer}</div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={openReplies} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Reply</button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)}>
        <div>
          <div className="text-lg font-semibold">Replies</div>
          <div className="text-sm text-slate-300">Question: “{qa?.question}”</div>
          {qa?.answer && <div className="mt-1 text-purple-300">🧿 Oracle: {qa.answer}</div>}
          <div className="mt-3 max-h-[50vh] overflow-y-auto space-y-2">
            {replies.map(r => (
              <div key={r.id} className="text-sm text-slate-300 border-l border-purple-500/30 pl-3">
                {r.username}: {r.reply}
              </div>
            ))}
            {replies.length === 0 && <div className="text-sm text-slate-400">No replies yet. Be the first.</div>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={replyText} onChange={e=>setReplyText(e.target.value)} maxLength={100}
              placeholder="Write a reply…" className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-2 text-sm" />
            <button onClick={sendReply} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-sm">Send</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
