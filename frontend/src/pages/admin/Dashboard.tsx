import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Alert, AlertList, Incident } from '../../types/incident'

type Summary = {
 cameras: number
 incidents: number
 unresolved: number
 inProgress: number
 alerts: number
 unacknowledged: number
 recentIncidents: Incident[]
 recentAlerts: Alert[]
}

export function Dashboard({ onNavigate, onViewIncident }: { onNavigate: (path: string) => void; onViewIncident: (id: number) => void }) {
 const [summary, setSummary] = useState<Summary | null>(null)
 const [error, setError] = useState('')
 const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
 useEffect(() => {
  const abort = new AbortController()
  async function refresh() {
   if (document.hidden) return
   try {
    const paths = ['cameras', 'incidents?page_size=5', 'incidents?page_size=1&status=unresolved', 'incidents?page_size=1&status=in_progress', 'alerts?page_size=5']
    const responses = await Promise.all(paths.map(path => fetch(`${API}${path}`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })))
    if (responses.some(response => !response.ok)) throw new Error('Some dashboard data is unavailable')
    const [cameras, incidents, unresolved, inProgress, alerts] = await Promise.all(responses.map(response => response.json())) as [
     { cameras: unknown[] }, { incidents: Incident[]; total: number }, { total: number }, { total: number }, AlertList
    ]
    if (abort.signal.aborted) return
    setSummary({ cameras: cameras.cameras?.length ?? 0, incidents: incidents.total, unresolved: unresolved.total, inProgress: inProgress.total, alerts: alerts.total, unacknowledged: alerts.unacknowledged, recentIncidents: incidents.incidents, recentAlerts: alerts.alerts })
    setLastRefresh(new Date()); setError('')
   } catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Dashboard unavailable') }
  }
  void refresh()
  const timer = window.setInterval(() => void refresh(), 5000)
  return () => { abort.abort(); window.clearInterval(timer) }
 }, [])
 return <div class="p-6 space-y-6">
  <header class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-accent text-xs uppercase tracking-widest">Organization overview</p><h1 class="text-3xl font-bold mt-2">Dashboard</h1><p class="text-slate-400 mt-2">Detected incidents and their in-app notifications.</p></div><button type="button" class="rounded-xl border border-brand-border px-4 py-2 text-accent" onClick={() => onNavigate('/FiremeX/admin/alerts')}>Notifications{summary?.unacknowledged ? ` (${summary.unacknowledged})` : ''}</button></header>
  {error && <p role="alert" class="text-amber-300">{error}{lastRefresh ? ' — showing last successful data.' : ''}</p>}
  <p class="text-xs text-slate-500">{lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString()}` : 'Loading current data…'}</p>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
   <button type="button" class="rounded-2xl border border-brand-border bg-brand-surface p-5 text-left" onClick={() => onNavigate('/FiremeX/admin/livefeed')}><span class="text-slate-400">Cameras</span><strong class="mt-2 block text-3xl">{summary?.cameras ?? '—'}</strong></button>
   <button type="button" class="rounded-2xl border border-brand-border bg-brand-surface p-5 text-left" onClick={() => onNavigate('/FiremeX/admin/incidents')}><span class="text-slate-400">Incidents</span><strong class="mt-2 block text-3xl">{summary?.incidents ?? '—'}</strong></button>
   <button type="button" class="rounded-2xl border border-brand-border bg-brand-surface p-5 text-left" onClick={() => onNavigate('/FiremeX/admin/incidents')}><span class="text-slate-400">Open responses</span><strong class="mt-2 block text-3xl">{summary ? summary.unresolved + summary.inProgress : '—'}</strong><span class="text-slate-500">{summary ? `${summary.unresolved} unresolved · ${summary.inProgress} in progress` : ''}</span></button>
   <button type="button" class="rounded-2xl border border-brand-border bg-brand-surface p-5 text-left" onClick={() => onNavigate('/FiremeX/admin/alerts')}><span class="text-slate-400">Notifications</span><strong class="mt-2 block text-3xl">{summary?.alerts ?? '—'}</strong><span class="text-slate-500">{summary ? `${summary.unacknowledged} unacknowledged` : ''}</span></button>
  </div>
  <section class="rounded-2xl border border-brand-border bg-brand-surface p-5"><div class="flex items-center justify-between"><h2 class="text-xl font-semibold">Recent incidents</h2><button type="button" class="text-accent underline" onClick={() => onNavigate('/FiremeX/admin/incidents')}>View all</button></div>{summary?.recentIncidents.length ? <ul class="mt-4 divide-y divide-brand-border">{summary.recentIncidents.map(row => <li key={row.id} class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><span class={row.class === 'fire' ? 'text-red-400' : 'text-amber-300'}>{row.class === 'fire' ? 'Fire' : 'Smoke'}</span> · {row.camera_name}{row.zone ? ` · ${row.zone}` : ''}<div class="text-xs text-slate-400">{row.reference} · {new Date(row.created_at).toLocaleString()} · {row.status.replaceAll('_', ' ')}</div></div><button type="button" class="text-accent underline" onClick={() => onViewIncident(row.id)}>Open incident</button></li>)}</ul> : <p class="mt-4 text-slate-400">No detected incidents yet.</p>}</section>
  <section class="rounded-2xl border border-brand-border bg-brand-surface p-5"><div class="flex items-center justify-between"><h2 class="text-xl font-semibold">Recent notifications</h2><button type="button" class="text-accent underline" onClick={() => onNavigate('/FiremeX/admin/alerts')}>View all</button></div>{summary?.recentAlerts.length ? <ul class="mt-4 divide-y divide-brand-border">{summary.recentAlerts.map(row => <li key={row.id} class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><span class={row.class === 'fire' ? 'text-red-400' : 'text-amber-300'}>{row.class === 'fire' ? 'Fire detected' : 'Smoke detected'}</span> · {row.camera_name}<div class="text-xs text-slate-400">{row.incident_reference} · {new Date(row.created_at).toLocaleString()} · {row.acknowledged_at ? 'Acknowledged' : 'Unacknowledged'}</div></div><button type="button" class="text-accent underline" onClick={() => onViewIncident(row.incident_id)}>View incident</button></li>)}</ul> : <p class="mt-4 text-slate-400">No notifications yet.</p>}</section>
 </div>
}
