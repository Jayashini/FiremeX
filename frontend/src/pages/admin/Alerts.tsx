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
   if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Could not acknowledge notification (HTTP ${res.status})`)
   }
   const alert = await res.json() as Alert
   onViewIncident(alert.incident_id)
  } catch (err) { setError(err instanceof Error ? err.message : 'Could not acknowledge notification') }
  finally { setBusy(null) }
 }
 return <div class="mx-auto max-w-[1500px] space-y-6 p-5 pb-12 sm:p-7 lg:p-9">
  <header class="flex flex-wrap items-end justify-between gap-4"><div><p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Response queue</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Notifications</h1><p class="mt-2 max-w-2xl text-sm text-slate-400">Acknowledge a detection to manage its response. Your team can view the evidence and response history.</p></div><div class="flex gap-2"><div class="rounded-2xl border border-white/10 bg-[#0c1517] px-5 py-3"><span class="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</span><strong class="mt-0.5 block text-2xl text-white">{total}</strong></div><div class="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-5 py-3"><span class="block text-[11px] font-semibold uppercase tracking-wider text-amber-300">Unacknowledged</span><strong class="mt-0.5 block text-2xl text-white">{unacknowledged}</strong></div></div></header>
  <div class="flex flex-wrap items-end justify-between gap-3 rounded-[22px] border border-white/[0.08] bg-[#0c1517] p-4 sm:p-5"><label class="text-xs font-medium text-slate-400">Show notifications<select class="mt-2 block min-h-11 min-w-[210px] rounded-xl border border-white/10 bg-[#101b1d] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-teal-400/50" value={filter} onChange={e => { setPage(1); setFilter(e.currentTarget.value) }}><option value="">All notifications</option><option value="false">Needs acknowledgement</option><option value="true">Acknowledged</option></select></label><p class="text-xs text-slate-500">{loading ? 'Refreshing… · ' : ''}{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Waiting for first refresh'}</p></div>
  {error && <p role="alert" class="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{error}{lastRefresh ? ' — showing the last available data.' : ''}</p>}
  <section aria-label="Notification table" class="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0c1517] shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
   <div class="overflow-x-auto">
    <table class="w-full min-w-[1050px] border-collapse text-left">
     <thead class="border-b border-white/[0.08] bg-white/[0.035] text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"><tr><th scope="col" class="px-5 py-4">Notification / detected</th><th scope="col" class="px-4 py-4">Detection</th><th scope="col" class="px-4 py-4">Camera / zone</th><th scope="col" class="px-4 py-4">Confidence</th><th scope="col" class="px-4 py-4">Acknowledgement</th><th scope="col" class="px-5 py-4 text-right">Action</th></tr></thead>
     <tbody class="divide-y divide-white/[0.06]">{rows.map(row => <tr key={row.id} class="transition-colors hover:bg-teal-400/[0.045]">
      <td class="px-5 py-4 align-middle"><span class="block font-mono text-xs font-semibold tracking-wide text-teal-300">{row.incident_reference}</span><time class="mt-1.5 block text-xs text-slate-400" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></td>
      <td class="px-4 py-4 align-middle"><span class={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${row.class === 'fire' ? 'border-red-400/25 bg-red-400/10 text-red-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'}`}><span class={`h-1.5 w-1.5 rounded-full ${row.class === 'fire' ? 'bg-red-400' : 'bg-amber-400'}`} />{row.class === 'fire' ? 'Fire' : 'Smoke'}</span></td>
      <td class="px-4 py-4 align-middle"><span class="block max-w-[190px] truncate text-sm font-medium text-slate-200" title={row.camera_name}>{row.camera_name}</span><span class="mt-1 block max-w-[190px] truncate text-xs text-slate-500" title={row.zone || undefined}>{row.zone || 'Zone not set'}</span></td>
      <td class="px-4 py-4 align-middle text-sm font-semibold tabular-nums text-slate-200">{(row.confidence * 100).toFixed(1)}%</td>
      <td class="px-4 py-4 align-middle">{row.acknowledged_at ? <><span class="block text-xs font-semibold text-teal-200">Acknowledged by {row.acknowledged_by_name || `User #${row.acknowledged_by_id}`}</span><span class="mt-1 block text-xs text-slate-500"><span class="capitalize">{row.acknowledged_by_role || 'Role unavailable'}</span> · {new Date(row.acknowledged_at).toLocaleString()}</span></> : <span class="inline-flex whitespace-nowrap rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">Not acknowledged</span>}</td>
      <td class="px-5 py-4 text-right align-middle"><div class="flex justify-end gap-2">{!row.acknowledged_at && <button type="button" disabled={busy === row.id} onClick={() => void acknowledge(row.id)} class="whitespace-nowrap rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-[#06100f] transition hover:bg-teal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 disabled:opacity-50">{busy === row.id ? 'Saving…' : 'Acknowledge'}</button>}<button type="button" onClick={() => onViewIncident(row.incident_id)} class="whitespace-nowrap rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-teal-400/40 hover:text-teal-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400">View incident ↗</button></div></td>
     </tr>)}</tbody>
    </table>
   </div>
  </section>
  {!loading && rows.length === 0 && <div class="rounded-[24px] border border-dashed border-white/10 bg-[#0c1517] px-6 py-20 text-center"><span class="text-4xl text-teal-500/50" aria-hidden="true">◎</span><p class="mt-3 font-semibold text-white">No notifications match this view</p><p class="mt-1 text-sm text-slate-400">New detections will appear here as they arrive.</p></div>}
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5"><p class="text-sm text-slate-400">{filtered} matching · Page {page} of {Math.max(1, Math.ceil(filtered / 25))}</p><div class="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)} class="rounded-xl border border-white/10 bg-[#101b1d] px-4 py-2.5 text-sm disabled:opacity-40">Previous</button><button type="button" disabled={page * 25 >= filtered} onClick={() => setPage(p => p + 1)} class="rounded-xl border border-white/10 bg-[#101b1d] px-4 py-2.5 text-sm disabled:opacity-40">Next</button></div></div>
 </div>
}
