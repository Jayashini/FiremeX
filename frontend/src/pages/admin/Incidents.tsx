import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Incident } from '../../types/incident'
import { IncidentDetail } from '../../components/incidents/IncidentDetail'

export function Incidents({ openIncidentId, onIncidentClosed }: { openIncidentId?: number | null; onIncidentClosed?: () => void }) {
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
 function openIncident(row: Incident) { setSelected(row) }
 useEffect(() => {
  if (!openIncidentId) return
  const abort = new AbortController()
  fetch(`${API}incidents/${openIncidentId}`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })
   .then(async res => { if (!res.ok) throw new Error(`Could not open incident (HTTP ${res.status})`); setSelected(await res.json() as Incident) })
   .catch(err => { if (!abort.signal.aborted) setError(err.message) })
  return () => abort.abort()
 }, [openIncidentId])
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
 const input = 'min-h-11 rounded-xl border border-white/10 bg-[#101b1d] px-4 py-2.5 text-sm text-slate-200 outline-none transition focus:border-teal-400/50 focus:ring-2 focus:ring-teal-400/10'
 const responseColor = (value: Incident['status']) => value === 'resolved' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : value === 'in_progress' ? 'border-sky-400/25 bg-sky-400/10 text-sky-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
 return <div class="mx-auto max-w-[1500px] space-y-6 p-5 pb-12 sm:p-7 lg:p-9">
  <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Detection history</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Incidents</h1><p class="mt-2 max-w-2xl text-sm text-slate-400">Review each detection, inspect its saved evidence, and follow the response from acknowledgement to resolution.</p></div><div class="rounded-2xl border border-teal-400/20 bg-teal-400/[0.07] px-5 py-3"><span class="block text-[11px] font-semibold uppercase tracking-wider text-teal-300">In this view</span><strong class="mt-0.5 block text-2xl text-white">{total}</strong></div></header>
  {newCount > 0 && <div role="status" class="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-200"><span>New detections received</span><button type="button" class="font-semibold underline" onClick={() => setNewCount(0)}>Dismiss</button></div>}
  <section aria-label="Incident filters" class="flex flex-wrap items-end gap-3 rounded-[22px] border border-white/[0.08] bg-[#0c1517] p-4 sm:p-5"><label class="min-w-[220px] flex-1 text-xs font-medium text-slate-400">Search camera or zone<input class={`${input} mt-2 block w-full`} aria-label="Search camera or zone" placeholder="Search camera or zone…" value={search} onInput={e => { setPage(1); setSearch(e.currentTarget.value) }} maxLength={200} /></label><label class="text-xs font-medium text-slate-400">Hazard<select class={`${input} mt-2 block min-w-[150px]`} aria-label="Hazard class" value={hazard} onChange={e => { setPage(1); setHazard(e.currentTarget.value) }}><option value="">All classes</option><option value="fire">Fire</option><option value="smoke">Smoke</option></select></label><label class="text-xs font-medium text-slate-400">Response<select class={`${input} mt-2 block min-w-[175px]`} aria-label="Response status" value={status} onChange={e => { setPage(1); setStatus(e.currentTarget.value) }}><option value="">All response states</option><option value="unresolved">Unresolved</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></label></section>
  {error && <p role="alert" class="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{error}. {lastRefresh ? 'Showing the last available data.' : 'No data loaded.'}</p>}
  <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p>Showing {rows.length} of {total} incident{total === 1 ? '' : 's'}</p><p>{loading ? 'Refreshing… · ' : ''}{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Waiting for first refresh'}</p></div>
  <section aria-label="Incident table" class="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0c1517] shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
   <div class="overflow-x-auto">
    <table class="w-full min-w-[920px] border-collapse text-left">
     <thead class="border-b border-white/[0.08] bg-white/[0.035] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"><tr><th scope="col" class="px-5 py-4">Incident / observed</th><th scope="col" class="px-4 py-4">Detection</th><th scope="col" class="px-4 py-4">Camera / zone</th><th scope="col" class="px-4 py-4">Confidence</th><th scope="col" class="px-4 py-4">Response</th><th scope="col" class="px-5 py-4 text-right">Evidence</th></tr></thead>
     <tbody class="divide-y divide-white/[0.06]">{rows.map(row => <tr key={row.id} class="transition-colors hover:bg-teal-400/[0.045]">
      <td class="px-5 py-4 align-middle"><span class="block font-mono text-xs font-semibold tracking-wide text-teal-300">{row.reference}</span><time class="mt-1.5 block text-xs text-slate-400" dateTime={row.observed_at ?? row.created_at}>{new Date(row.observed_at ?? row.created_at).toLocaleString()}</time></td>
      <td class="px-4 py-4 align-middle"><span class={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${row.class === 'fire' ? 'border-red-400/25 bg-red-400/10 text-red-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}><span class={`h-1.5 w-1.5 rounded-full ${row.class === 'fire' ? 'bg-red-400' : 'bg-amber-400'}`} />{row.class === 'fire' ? 'Fire' : 'Smoke'}</span></td>
      <td class="px-4 py-4 align-middle"><span class="block max-w-[220px] truncate text-sm font-medium text-slate-200" title={row.camera_name}>{row.camera_name}</span><span class="mt-1 block max-w-[220px] truncate text-xs text-slate-500" title={row.zone || undefined}>{row.zone || 'Zone not set'}</span></td>
      <td class="px-4 py-4 align-middle"><span class="text-sm font-semibold tabular-nums text-slate-200">{(row.confidence * 100).toFixed(1)}%</span><div class="mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/[0.08]"><div class={`h-full rounded-full ${row.class === 'fire' ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, Math.max(0, row.confidence * 100))}%` }} /></div></td>
      <td class="px-4 py-4 align-middle"><span class={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${responseColor(row.status)}`}>{row.status.replaceAll('_', ' ')}</span></td>
      <td class="px-5 py-4 text-right align-middle"><button type="button" onClick={() => openIncident(row)} class="whitespace-nowrap rounded-xl border border-teal-400/25 bg-teal-400/[0.07] px-3.5 py-2 text-xs font-semibold text-teal-200 transition hover:border-teal-300/50 hover:bg-teal-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400">View evidence ↗</button></td>
     </tr>)}</tbody>
    </table>
   </div>
  </section>
  {!loading && !error && rows.length === 0 && <div class="rounded-[24px] border border-dashed border-white/10 bg-[#0c1517] px-6 py-20 text-center"><span class="text-4xl text-teal-500/50" aria-hidden="true">◎</span><p class="mt-3 font-semibold text-white">No incidents match this view</p><p class="mt-1 text-sm text-slate-400">Try a different filter or wait for a new detection.</p></div>}
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5"><p class="text-sm text-slate-400">Page {page} of {Math.max(1, Math.ceil(total / 25))}</p><div class="flex gap-2"><button type="button" class={`${input} disabled:opacity-40`} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><button type="button" class={`${input} disabled:opacity-40`} disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
  {selected && <IncidentDetail key={selected.id} incident={selected} onClose={() => { setSelected(null); onIncidentClosed?.() }} onUpdated={updated => { setSelected(updated); setRows(old => old.map(row => row.id === updated.id ? updated : row)) }} />}
 </div>
}
