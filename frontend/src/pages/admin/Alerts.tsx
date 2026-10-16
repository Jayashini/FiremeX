import { useCallback, useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Alert, AlertList } from '../../types/incident'

export function Alerts({ onViewIncident }: { onViewIncident: (id: number) => void }) {
 const [rows, setRows] = useState<Alert[]>([])
 const [page, setPage] = useState(1)
 const [filter, setFilter] = useState('')
 const [total, setTotal] = useState(0)
 const [filtered, setFiltered] = useState(0)
 const [unacknowledged, setUnacknowledged] = useState(0)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
 const [busy, setBusy] = useState<number | null>(null)
 const refresh = useCallback(async (signal?: AbortSignal) => {
  try {
   const params = new URLSearchParams({ page: String(page), page_size: '25' })
   if (filter) params.set('acknowledged', filter)
   const res = await fetch(`${API}alerts?${params}`, { headers: authHeaders(), credentials: 'include', signal })
   if (!res.ok) throw new Error(`Could not load notifications (HTTP ${res.status})`)
   const data = await res.json() as AlertList
   if (signal?.aborted) return
   setRows(data.alerts); setTotal(data.total); setFiltered(data.filtered_total)
   setUnacknowledged(data.unacknowledged); setLastRefresh(new Date()); setError('')
  } catch (err) {
   if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Could not load notifications')
  } finally { if (!signal?.aborted) setLoading(false) }
 }, [page, filter])
 useEffect(() => {
  const controller = new AbortController()
  setLoading(true)
  void refresh(controller.signal)
  const timer = window.setInterval(() => { if (!document.hidden) void refresh(controller.signal) }, 5000)
  return () => { controller.abort(); window.clearInterval(timer) }
 }, [refresh])
 async function acknowledge(id: number) {
  setBusy(id)
  try {
   const res = await fetch(`${API}alerts/${id}/acknowledge`, { method: 'PATCH', headers: authHeaders(), credentials: 'include' })
   if (!res.ok) throw new Error(`Could not acknowledge notification (HTTP ${res.status})`)
   await refresh()
  } catch (err) { setError(err instanceof Error ? err.message : 'Could not acknowledge notification') }
  finally { setBusy(null) }
 }
 return <div class="p-6 space-y-6">
  <header><p class="text-accent text-xs uppercase tracking-widest">Detected hazards</p><h1 class="text-3xl font-bold mt-2">Notifications</h1><p class="text-slate-400 mt-2">Each notification is linked to a detected incident. Acknowledging it does not resolve the incident.</p></header>
  <div class="flex flex-wrap gap-3 text-sm"><span class="rounded-xl border border-brand-border bg-brand-surface px-4 py-3">{total} notifications</span><span class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300">{unacknowledged} unacknowledged</span></div>
  <label class="text-sm text-slate-300">Show <select class="ml-2 rounded-xl border border-brand-border bg-brand-surface px-3 py-2" value={filter} onChange={e => { setPage(1); setFilter(e.currentTarget.value) }}><option value="">All</option><option value="false">Unacknowledged</option><option value="true">Acknowledged</option></select></label>
  {error && <p role="alert" class="text-amber-300">{error}{lastRefresh ? ' — showing last successful data.' : ''}</p>}
  <p class="text-xs text-slate-500">{loading ? 'Refreshing… ' : ''}{lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Waiting for first refresh'}</p>
  <div class="overflow-x-auto rounded-2xl border border-brand-border"><table class="w-full text-left text-sm"><thead class="bg-brand-surface text-slate-400"><tr>{['Detected', 'Incident', 'Camera / zone', 'Confidence', 'Acknowledgement', 'Actions'].map(h => <th key={h} class="p-4">{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} class="border-t border-brand-border"><td class="p-4">{new Date(row.created_at).toLocaleString()}</td><td class="p-4"><span class={row.class === 'fire' ? 'text-red-400' : 'text-amber-300'}>{row.class === 'fire' ? 'Fire detected' : 'Smoke detected'}</span><div class="font-mono text-xs text-slate-400">{row.incident_reference}</div></td><td class="p-4">{row.camera_name}<div class="text-xs text-slate-400">{row.zone || '—'}</div></td><td class="p-4">{(row.confidence * 100).toFixed(1)}%</td><td class="p-4">{row.acknowledged_at ? `Acknowledged ${new Date(row.acknowledged_at).toLocaleString()}` : 'Awaiting acknowledgement'}</td><td class="p-4"><div class="flex gap-3 whitespace-nowrap">{!row.acknowledged_at && <button type="button" disabled={busy === row.id} class="text-accent underline disabled:opacity-50" onClick={() => void acknowledge(row.id)}>{busy === row.id ? 'Saving…' : 'Acknowledge'}</button>}<button type="button" class="text-accent underline" onClick={() => onViewIncident(row.incident_id)}>View incident</button></div></td></tr>)}</tbody></table>{!loading && rows.length === 0 && <p class="p-12 text-center text-slate-400">No notifications match this view.</p>}</div>
  <div class="flex items-center justify-between"><p class="text-sm text-slate-400">{filtered} matching · Page {page} of {Math.max(1, Math.ceil(filtered / 25))}</p><div class="flex gap-3"><button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} class="rounded-xl border border-brand-border px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page * 25 >= filtered} onClick={() => setPage(p => p + 1)} class="rounded-xl border border-brand-border px-3 py-2 disabled:opacity-40">Next</button></div></div>
 </div>
}
