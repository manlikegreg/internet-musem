import { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'

const tables = [
  'graveyard','confessions_booth','void_stream_messages','prompt_battles','oracle_questions','capsules','apologies','compliments','dream_archive','mood_mirror_readings'
] as const

type Table = typeof tables[number]

type Stats = Record<Table | string, number>

function AmbientSoundManager() {
  const [file, setFile] = useState<File | null>(null)
  const [currentSound, setCurrentSound] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchCurrentSound()
  }, [])

  const fetchCurrentSound = async () => {
    try {
      const { data } = await api.get('/admin/config/ambient')
      if (data?.url) {
        setCurrentSound(data.url)
      }
    } catch (error) {
      console.error('Failed to fetch ambient sound:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      // Check if file is audio
      if (!selectedFile.type.startsWith('audio/')) {
        setMessage('Please select an audio file')
        return
      }
      setFile(selectedFile)
      setMessage('')
    }
  }

  const uploadSound = async () => {
    if (!file) {
      setMessage('Please select a file first')
      return
    }

    setUploading(true)
    setMessage('')

    const formData = new FormData()
    formData.append('sound', file)

    try {
      await api.post('/admin/config/ambient', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      setMessage('Ambient sound uploaded successfully')
      setFile(null)
      await fetchCurrentSound()
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Failed to upload sound')
    } finally {
      setUploading(false)
    }
  }

  const playSound = () => {
    if (audioRef.current && currentSound) {
      audioRef.current.src = currentSound
      audioRef.current.load()
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err)
        setMessage('Error playing audio. Please try again.')
      })
    }
  }

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Ambient Sound</h2>
        <button onClick={fetchCurrentSound} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Refresh</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-slate-300 block mb-2">Upload new ambient sound</label>
          <input 
            type="file" 
            accept="audio/*" 
            onChange={handleFileChange}
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" 
          />
          <button 
            onClick={uploadSound} 
            disabled={!file || uploading} 
            className="mt-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Sound'}
          </button>
        </div>
        
        <div>
          <div className="text-sm text-slate-300 mb-2">Current ambient sound</div>
          {currentSound ? (
            <div className="flex flex-col gap-2">
              <audio ref={audioRef} src={currentSound} controls className="w-full" />
              <button 
                onClick={playSound}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
              >
                Play Sound
              </button>
            </div>
          ) : (
            <div className="text-slate-400">No ambient sound configured</div>
          )}
        </div>
      </div>
      
      {message && (
        <div className="mt-3 text-sm text-slate-300">{message}</div>
      )}
    </div>
  )
}

function GroqKeyConfig() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh() {
    try {
      const { data } = await api.get('/admin/config/groq')
      setConfigured(!!data?.configured)
    } catch {
      setConfigured(false)
    }
  }

  async function save() {
    if (!apiKey.trim()) { setMsg('Enter an API key'); return }
    setSaving(true)
    setMsg('')
    try {
      await api.post('/admin/config/groq', { key: apiKey.trim() })
      setApiKey('')
      setMsg('Saved Groq API key')
      await refresh()
    } catch (e: any) {
      setMsg(e?.response?.data?.error || 'Failed to save key')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Groq API Key</h2>
        <div className={`text-xs ${configured ? 'text-emerald-400' : 'text-slate-400'}`}>{configured ? 'Configured' : 'Not configured'}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300">Enter new key (will overwrite existing)</label>
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk_..."
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" />
        </div>
        <div>
          <button onClick={save} disabled={saving || !apiKey.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded">Save Key</button>
        </div>
        {msg && <div className="md:col-span-3 text-xs text-slate-300">{msg}</div>}
      </div>
    </div>
  )
}

function DataExplorer() {
  const [room, setRoom] = useState<'void'|'confessions'|'graveyard'|'battles'|'prompts'|'prompt_battles'|'oracle'|'oracle_questions'|'oracle_replies'|'timecapsule'|'apologies'|'compliments'|'dreams'|'mood_mirror'>('void')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/data', { params: { table: room } })
      setRows(data)
    } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [room])

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Data Explorer</h2>
        <div className="flex items-center gap-2">
          <select value={room} onChange={e=>setRoom(e.target.value as any)} className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm">
            <option value="void">The Void</option>
            <option value="confessions">Confession Booth</option>
            <option value="graveyard">Graveyard</option>
            <option value="battles">Battles</option>
            <option value="prompts">Prompts</option>
            <option value="prompt_battles">Prompt Battles</option>
            <option value="oracle">Oracle (legacy)</option>
            <option value="oracle_questions">Oracle Questions</option>
            <option value="oracle_replies">Oracle Replies</option>
            <option value="timecapsule">Time Capsule</option>
            <option value="apologies">Apologies</option>
            <option value="compliments">Compliments</option>
            <option value="dreams">Dream Archive</option>
            <option value="mood_mirror">Mood Mirror</option>
          </select>
          <button onClick={load} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Refresh</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">User/From</th>
              <th className="text-left p-2">Primary</th>
              <th className="text-left p-2">Audio</th>
              <th className="text-left p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any) => {
              const primary = r.text || r.message || r.content || r.title || r.question || r.reading || r.generated || r.epitaph || ''
              const user = r.username || r.from_name || '-'
              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-2 font-mono text-xs opacity-80">{String(r.id).slice(0,8)}…</td>
                  <td className="p-2 max-w-[12rem] truncate" title={user}>{user}</td>
                  <td className="p-2 max-w-[28rem] truncate" title={typeof primary==='string'?primary:JSON.stringify(primary)}>{typeof primary==='string'?primary:JSON.stringify(primary)}</td>
                  <td className="p-2">{r.audio_url ? <audio src={r.audio_url} controls preload="none" className="w-56" /> : <span className="opacity-50">—</span>}</td>
                  <td className="p-2 text-xs opacity-80">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && !loading && (
              <tr><td className="p-4 text-center text-slate-400" colSpan={5}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EchoSettings() {
  const [vDelay, setVDelay] = useState('0.22')
  const [vFb, setVFb] = useState('0.35')
  const [vDecay, setVDecay] = useState('1.0')
  const [cDelay, setCDelay] = useState('0.38')
  const [cFb, setCFb] = useState('0.55')
  const [cDecay, setCDecay] = useState('2.3')
  const [msg, setMsg] = useState('')

  async function load() {
    try {
      const r = await fetch('/api/config/echo')
      const cfg = await r.json()
      if (cfg?.void) { setVDelay(String(cfg.void.delay)); setVFb(String(cfg.void.feedback)); setVDecay(String(cfg.void.decay)) }
      if (cfg?.confession) { setCDelay(String(cfg.confession.delay)); setCFb(String(cfg.confession.feedback)); setCDecay(String(cfg.confession.decay)) }
    } catch {}
  }
  useEffect(()=>{ load() }, [])

  async function save() {
    setMsg('')
    try {
      await api.post('/admin/config/echo', {
        void: { delay: Number(vDelay), feedback: Number(vFb), decay: Number(vDecay) },
        confession: { delay: Number(cDelay), feedback: Number(cFb), decay: Number(cDecay) }
      })
      setMsg('Saved echo settings')
    } catch (e:any) {
      setMsg(e?.response?.data?.error || 'Failed to save')
    }
  }

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Echo Settings</h2>
        <button onClick={load} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Reload</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-slate-300 mb-2">The Void</div>
          <div className="grid grid-cols-3 gap-2">
            <input value={vDelay} onChange={e=>setVDelay(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Delay" />
            <input value={vFb} onChange={e=>setVFb(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Feedback" />
            <input value={vDecay} onChange={e=>setVDecay(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Decay" />
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-300 mb-2">Confession Booth</div>
          <div className="grid grid-cols-3 gap-2">
            <input value={cDelay} onChange={e=>setCDelay(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Delay" />
            <input value={cFb} onChange={e=>setCFb(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Feedback" />
            <input value={cDecay} onChange={e=>setCDecay(e.target.value)} className="bg-black/40 border border-white/10 rounded px-2 py-1" placeholder="Decay" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700">Save Echo</button>
        {msg && <div className="text-xs text-slate-300">{msg}</div>}
      </div>
    </div>
  )
}

function GroqManager() {
  const [models, setModels] = useState<string[]>([])
  const [selected, setSelected] = useState('mixtral-8x7b')
  const [testPrompt, setTestPrompt] = useState('Say hello from the Museum in one short sentence.')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadModels() {
    try {
      const { data } = await api.get('/admin/groq/models')
      setModels(data.models || [])
      if (data.models && data.models.length) setSelected(data.models[0])
    } catch {}
  }

  async function testConnection() {
    setLoading(true)
    try {
      const { data } = await api.post('/admin/groq/test', { model: selected, prompt: testPrompt })
      setResult(data?.sample || (data?.ok ? 'OK' : 'Failed'))
    } catch (e: any) {
      setResult(e?.response?.data?.error || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Groq API Manager</h2>
        <button onClick={loadModels} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Load Models</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-sm text-slate-300">Model</label>
          <select value={selected} onChange={e=>setSelected(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2">
            {[selected, ...models.filter(m=>m!==selected)].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm text-slate-300">Test prompt</label>
          <input value={testPrompt} onChange={e=>setTestPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" />
        </div>
        <div className="md:col-span-3">
          <button onClick={testConnection} disabled={loading} className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700">Test Connection</button>
          {result && <div className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">{result}</div>}
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const [stats, setStats] = useState<Stats>({})
  const [loading, setLoading] = useState(false)
  const [table, setTable] = useState<Table>('graveyard')
  const [range, setRange] = useState<'all'|'3h'|'3d'|'2w'|'1y'|'2y'|'3y'|'5y'|'10y'|'custom'>('3d')
  const [customInterval, setCustomInterval] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [message, setMessage] = useState<string>('')
  const [authorized, setAuthorized] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function fetchStats() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/stats')
      setStats(data)
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  async function purge() {
    setLoading(true)
    try {
      const payload: any = { table, range }
      if (range === 'custom' && customInterval) payload.customInterval = customInterval
      if (since) payload.since = new Date(since).toISOString()
      if (until) payload.until = new Date(until).toISOString()
      const { data } = await api.post('/admin/purge', payload)
      setMessage(`Deleted ${data.deleted} rows from ${table}`)
      await fetchStats()
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Failed to purge')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = localStorage.getItem('adminToken')
    if (t) api.defaults.headers.common['Authorization'] = `Bearer ${t}`
    api.get('/admin/stats').then(() => {
      setAuthorized(true); setAuthChecked(true)
    }).catch(() => {
      setAuthorized(false); setAuthChecked(true)
    })
  }, [])

  async function login() {
    setLoading(true)
    try {
      await api.post('/admin/login', { password })
      localStorage.setItem('adminToken', password)
      api.defaults.headers.common['Authorization'] = `Bearer ${password}`
      setAuthorized(true)
      setMessage('')
    } catch (e: any) {
      setMessage(e?.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('adminToken')
    delete (api.defaults.headers.common as any)['Authorization']
    setAuthorized(false)
    setStats({})
    setMessage('Logged out')
  }

  async function updateAdminPassword() {
    setSaving(true)
    try {
      const v = newPassword.trim()
      if (v.length < 4) throw new Error('Password too short')
      await api.post('/admin/config/admin', { token: v })
      localStorage.setItem('adminToken', v)
      api.defaults.headers.common['Authorization'] = `Bearer ${v}`
      setAuthorized(true)
      setMessage('Admin password updated')
      setNewPassword('')
    } catch (e: any) {
      setMessage(e?.response?.data?.error || e.message || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { if (authorized) fetchStats() }, [authorized])

  return authorized ? (
    <div className="min-h-screen text-white p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">🛠️ Admin Dashboard</h1>
            <p className="text-slate-300">Manage rooms, data retention, and Groq access.</p>
          </div>
          <button onClick={logout} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Logout</button>
        </div>

        {message && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-sm text-slate-300">{message}</div>
          </div>
        )}

        <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Admin Access</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-slate-300">New admin password</label>
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" placeholder="Enter new password" />
            </div>
            <div>
              <button onClick={updateAdminPassword} disabled={saving || !newPassword} className="w-full bg-green-600 hover:bg-green-700 py-2 rounded">Save Password</button>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2">Changes take effect immediately for new sessions.</div>
        </div>
+        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
           {tables.map(t => (
             <div key={t} className="bg-white/5 border border-white/10 rounded-xl p-3">
               <div className="text-xs uppercase text-slate-400">{t.replace(/_/g,' ')}</div>
               <div className="text-2xl font-semibold">{stats[t] ?? 0}</div>
             </div>
           ))}
         </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-slate-300">Table</label>
              <select value={table} onChange={e=>setTable(e.target.value as Table)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2">
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300">Range</label>
              <select value={range} onChange={e=>setRange(e.target.value as any)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2">
                <option value="all">All time</option>
                <option value="3h">Last 3 hours</option>
                <option value="3d">Last 3 days</option>
                <option value="2w">Last 2 weeks</option>
                <option value="1y">Last year</option>
                <option value="2y">Last 2 years</option>
                <option value="3y">Last 3 years</option>
                <option value="5y">Last 5 years</option>
                <option value="10y">Last 10 years</option>
                <option value="custom">Custom interval / window</option>
              </select>
            </div>
            {range === 'custom' && (
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-300">Custom interval (e.g., 18 months, 90d, 5y)</label>
                  <input value={customInterval} onChange={e=>setCustomInterval(e.target.value)} placeholder="e.g., 18 months" className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Since (optional)</label>
                  <input type="datetime-local" value={since} onChange={e=>setSince(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-300">Until (optional)</label>
                  <input type="datetime-local" value={until} onChange={e=>setUntil(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2" />
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <button disabled={loading} onClick={purge} className="w-full bg-red-600 hover:bg-red-700 py-2 rounded">Delete data</button>
            </div>
          </div>
        </div>

        {/* Groq API Key Config */}
        <GroqKeyConfig />

        {/* Groq API Manager */}
        <GroqManager />

        {/* Ambient Sound Manager */}
        <AmbientSoundManager />

        {/* Data Explorer */}
        <DataExplorer />

        {/* Echo Settings */}
        <EchoSettings />
      </div>
    </div>
  ) : (
    <div className="min-h-screen text-white p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-semibold mb-4">Admin Access</h1>
        <p className="text-slate-300 mb-4">Enter the admin password to continue.</p>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 mb-3" placeholder="Admin password" />
        <button onClick={login} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 py-2 rounded">Enter</button>
        {message && <div className="mt-3 text-sm text-red-300">{message}</div>}
      </div>
    </div>
  )
}
