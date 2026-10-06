import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Incident } from '../../types/incident'
import { IncidentDetail } from '../../components/incidents/IncidentDetail'

export function Incidents() {
 const [rows, setRows] = useState<Incident[]>([])
 const [total, setTotal] = useState(0)
 const [page, setPage] = useState(1)
 const [search, setSearch] = useState('')
 const [hazard, setHazard] = useState('')
 const [status, setStatus] = useState('')
 const [error, setError] = useState('')
 const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
 const [loading, setLoading] = useState(true)
 const [newCount, setNewCount] = useState(0)
 const [selected, setSelected] = useState<Incident | null>(null)
 const highest = useRef<number | null>(null)
 useEffect(() => {
  let stopped = false, running = false, timer = 0
  let abort: AbortController | null = null
  let timeout = 0
  setLoading(true)
  async function refresh() {
   if (stopped || running || document.hidden) return
   running = true; abort = new AbortController()
   timeout = window.setTimeout(() => abort?.abort(), 15000)
   try {
    const params = new URLSearchParams({ page: String(page), page_size: '25', search, class: hazard, status })
    const res = await fetch(`${API}incidents?${params}`, { headers: authHeaders(), signal: abort.signal, credentials: 'include' })
    if (!res.ok) throw new Error(`Unable to load incidents (HTTP ${res.status})`)
    const data = await res.json() as { incidents: Incident[]; total: number; latest_id: number }
    if (stopped) return
    // Organization-wide watermark does not mistake filter/page changes for new reports.
    if (highest.current !== null && data.latest_id > highest.current) setNewCount(n => n + 1)
    highest.current = Math.max(highest.current ?? 0, data.latest_id)
    setRows(data.incidents); setTotal(data.total); setLastRefresh(new Date()); setError('')
    setSelected(old => old ? data.incidents.find(row => row.id === old.id) ?? old : null)
   } catch (err) {
    if (!stopped) setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'Incident request timed out')
   } finally {
    running = false; window.clearTimeout(timeout)
    if (!stopped) { setLoading(false); if (!document.hidden) timer = window.setTimeout(refresh, 2000) }
   }
  }
  function visibility() { window.clearTimeout(timer); if (!document.hidden) void refresh() }
  document.addEventListener('visibilitychange', visibility)
  void refresh()
  return () => { stopped = true; window.clearTimeout(timer); window.clearTimeout(timeout); abort?.abort(); document.removeEventListener('visibilitychange', visibility) }
 }, [page, search, hazard, status])
 const input = 'bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-sm'
 return <div class="p-6 space-y-6">
  <header><p class="text-accent text-xs uppercase tracking-widest">Detection history</p><h1 class="text-3xl font-bold mt-2">Incidents</h1><p class="text-slate-400 mt-2">Persisted machine reports. New reports are unconfirmed and unresolved.</p></header>
  {newCount > 0 && <div role="status" class="border border-amber-500/50 bg-amber-500/10 text-amber-300 rounded-xl p-4 flex justify-between"><span>New detections received</span><button onClick={() => setNewCount(0)}>Dismiss</button></div>}
  <div class="flex gap-3 flex-wrap">
   <input class={input} aria-label="Search camera or zone" placeholder="Search camera or zone…" value={search} onInput={e => { setPage(1); setSearch(e.currentTarget.value) }} maxLength={200} />
   <select class={input} aria-label="Hazard class" value={hazard} onChange={e => { setPage(1); setHazard(e.currentTarget.value) }}><option value="">All classes</option><option value="fire">Fire</option><option value="smoke">Smoke</option></select>
   <select class={input} aria-label="Response status" value={status} onChange={e => { setPage(1); setStatus(e.currentTarget.value) }}><option value="">All response states</option><option value="unresolved">Unresolved</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select>
  </div>
  {error && <p role="alert" class="text-amber-300">{error}. {lastRefresh ? 'Showing stale data from the last successful refresh.' : 'No data loaded.'}</p>}
  <p class="text-xs text-slate-500">{loading ? 'Refreshing… ' : ''}{lastRefresh ? `Last successful refresh: ${lastRefresh.toLocaleTimeString()}` : 'Waiting for first refresh'}</p>
  <div class="overflow-x-auto rounded-2xl border border-brand-border">
   <table class="w-full text-left text-sm"><thead class="bg-brand-surface text-slate-400"><tr>{['Reference / observed','Camera / zone','Class','Confidence','Review','Response','Evidence'].map(h => <th key={h} class="p-4 font-medium">{h}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} class="border-t border-brand-border"><td class="p-4 font-mono">{row.reference}<div class="text-xs text-slate-400 mt-1">{new Date(row.observed_at ?? row.created_at).toLocaleString()}</div></td><td class="p-4">{row.camera_name}<div class="text-xs text-slate-400">{row.zone || '—'}</div></td><td class={`p-4 capitalize ${row.class === 'fire' ? 'text-red-400' : 'text-amber-300'}`}>{row.class}</td><td class="p-4">{(row.confidence * 100).toFixed(1)}%</td><td class="p-4">{row.review_status}</td><td class="p-4">{row.status.replaceAll('_', ' ')}</td><td class="p-4"><button class="text-accent underline" onClick={() => setSelected(row)}>{row.has_snapshot ? 'View evidence' : `Details · ${row.evidence_status}`}</button></td></tr>)}</tbody>
   </table>
   {!loading && !error && rows.length === 0 && <p class="py-16 text-center text-slate-400">No incidents match this view.</p>}
  </div>
  <div class="flex items-center justify-between"><p class="text-sm text-slate-400">{total} records · Page {page} of {Math.max(1, Math.ceil(total / 25))}</p><div class="flex gap-4"><button class={input} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><button class={input} disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
  {selected && <IncidentDetail incident={selected} onClose={() => setSelected(null)} />}
 </div>
}
