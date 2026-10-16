import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Alert, AlertList, Incident } from '../../types/incident'

type Summary = {
 cameras: number; incidents: number; unresolved: number; inProgress: number; activeOperators: number; activeAdmins: number; unacknowledged: number
 recentIncidents: Incident[]; recentAlerts: Alert[]; featured: Incident | null
}

const panel = 'rounded-[26px] border border-white/[0.08] bg-[#0c1517] shadow-[0_20px_60px_rgba(0,0,0,0.16)]'
const link = 'text-sm font-semibold text-accent transition hover:text-teal-200'
const responseColor = (status: Incident['status']) => status === 'resolved' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : status === 'in_progress' ? 'border-sky-400/25 bg-sky-400/10 text-sky-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'

export function Dashboard({ onNavigate, onViewIncident }: { onNavigate: (path: string) => void; onViewIncident: (id: number) => void }) {
 const [summary, setSummary] = useState<Summary | null>(null)
 const [error, setError] = useState('')
 const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
 const [evidenceURL, setEvidenceURL] = useState('')
 const [evidenceError, setEvidenceError] = useState(false)

 useEffect(() => {
  const abort = new AbortController()
  let running = false
  async function refresh() {
   if (document.hidden || running) return
   running = true
   try {
    const paths = ['cameras', 'incidents?page_size=5', 'incidents?page_size=1&status=unresolved', 'incidents?page_size=1&status=in_progress', 'alerts?page_size=5', 'incidents?page_size=1&class=fire', 'users']
    const responses = await Promise.all(paths.map(path => fetch(`${API}${path}`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })))
    if (responses.some(response => !response.ok)) throw new Error('Some dashboard data is unavailable')
    const [cameras, incidents, unresolved, inProgress, alerts, fires, users] = await Promise.all(responses.map(response => response.json())) as [
     { cameras: unknown[] }, { incidents: Incident[]; total: number }, { total: number }, { total: number }, AlertList, { incidents: Incident[] }, { active: { role: string }[] }
    ]
    if (abort.signal.aborted) return
    const featured = fires.incidents.find(row => row.has_snapshot) ?? incidents.incidents.find(row => row.has_snapshot) ?? null
    const activeOperators = users.active?.filter(user => user.role.toLowerCase() === 'operator').length ?? 0
    const activeAdmins = users.active?.filter(user => user.role.toLowerCase() === 'admin').length ?? 0
    setSummary({ cameras: cameras.cameras?.length ?? 0, incidents: incidents.total, unresolved: unresolved.total, inProgress: inProgress.total, activeOperators, activeAdmins, unacknowledged: alerts.unacknowledged, recentIncidents: incidents.incidents, recentAlerts: alerts.alerts, featured })
    setLastRefresh(new Date()); setError('')
   } catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Dashboard unavailable') }
   finally { running = false }
  }
  void refresh()
  const timer = window.setInterval(() => void refresh(), 5000)
  return () => { abort.abort(); window.clearInterval(timer) }
 }, [])

 const featured = summary?.featured
 useEffect(() => {
  const abort = new AbortController()
  let objectURL = ''
  setEvidenceURL(''); setEvidenceError(false)
  if (featured?.has_snapshot) {
   fetch(`${API}incidents/${featured.id}/snapshot`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })
    .then(async response => {
     if (!response.ok) throw new Error('Evidence unavailable')
     const blob = await response.blob()
     if (!abort.signal.aborted) { objectURL = URL.createObjectURL(blob); setEvidenceURL(objectURL) }
    }).catch(() => { if (!abort.signal.aborted) setEvidenceError(true) })
  }
  return () => { abort.abort(); if (objectURL) URL.revokeObjectURL(objectURL) }
 }, [featured?.id, featured?.has_snapshot])

 const metrics = [
  { label: 'Cameras', value: summary?.cameras, hint: 'View live feeds', symbol: '▣', color: 'text-teal-300', tint: 'from-teal-400/10', path: '/FiremeX/admin/livefeed' },
  { label: 'Total incidents', value: summary?.incidents, hint: 'Detection history', symbol: '◇', color: 'text-orange-300', tint: 'from-orange-400/10', path: '/FiremeX/admin/incidents' },
  { label: 'Open responses', value: summary ? summary.unresolved + summary.inProgress : undefined, hint: summary ? `${summary.unresolved} unresolved · ${summary.inProgress} in progress` : 'Awaiting data', symbol: '◌', color: 'text-sky-300', tint: 'from-sky-400/10', path: '/FiremeX/admin/incidents' },
  { label: 'Active operators + admins', value: summary ? summary.activeOperators + summary.activeAdmins : undefined, hint: summary ? `${summary.activeOperators} operator${summary.activeOperators === 1 ? '' : 's'} · ${summary.activeAdmins} admin${summary.activeAdmins === 1 ? '' : 's'}` : 'Awaiting data', symbol: '♙', color: 'text-emerald-300', tint: 'from-emerald-400/10', path: '/FiremeX/admin/users' },
 ]

 return <div class="mx-auto max-w-[1500px] space-y-7 p-5 pb-12 sm:p-7 lg:p-9">
  <header class="flex flex-wrap items-end justify-between gap-5"><div><p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">FiremeX / Overview</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Safety at a glance</h1><p class="mt-2 text-sm text-slate-400">Live signals, recent detections, and the response queue for your organization.</p></div><div class="flex items-center gap-3"><span class="rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-200"><span class="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-teal-300" />Live overview</span><button type="button" onClick={() => onNavigate('/FiremeX/admin/alerts')} class="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-teal-400/40 hover:bg-teal-400/10">Notifications{summary?.unacknowledged ? ` · ${summary.unacknowledged}` : ''} <span aria-hidden="true">↗</span></button></div></header>
  {error && <p role="alert" class="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{error}{lastRefresh ? ' — showing the last available data.' : ''}</p>}
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <button type="button" key={metric.label} onClick={() => onNavigate(metric.path)} class={`group relative min-h-[162px] overflow-hidden p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-teal-400/25 ${panel}`}><span class={`pointer-events-none absolute inset-0 bg-gradient-to-br ${metric.tint} via-transparent to-transparent`} /><span class="relative flex items-start justify-between"><span class="text-sm font-medium text-slate-300">{metric.label}</span><span aria-hidden="true" class={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-xl ${metric.color}`}>{metric.symbol}</span></span><strong class="relative mt-4 block text-4xl font-bold tracking-tight text-white">{metric.value ?? '—'}</strong><span class="relative mt-2 flex items-center justify-between text-xs text-slate-400"><span>{metric.hint}</span><span class="text-slate-500 transition group-hover:translate-x-1 group-hover:text-accent" aria-hidden="true">→</span></span></button>)}</div>
  <div class="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
   <section class={`${panel} overflow-hidden`}><div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5 sm:px-6"><div><p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Detection activity</p><h2 class="mt-1 text-xl font-bold text-white">Recent incidents</h2></div><button type="button" class={link} onClick={() => onNavigate('/FiremeX/admin/incidents')}>View all ↗</button></div>{summary?.recentIncidents.length ? <ul class="divide-y divide-white/[0.06]">{summary.recentIncidents.map(row => <li key={row.id}><button type="button" onClick={() => onViewIncident(row.id)} class="group flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.035] sm:px-6"><span class={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${row.class === 'fire' ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{row.class === 'fire' ? '✦' : '◈'}</span><span class="min-w-[165px] flex-1"><span class="block text-sm font-semibold text-white">{row.class === 'fire' ? 'Fire detected' : 'Smoke detected'} <span class="ml-1 font-mono text-xs font-normal text-slate-500">{row.reference}</span></span><span class="mt-1 block truncate text-xs text-slate-400">{row.camera_name}{row.zone ? ` · ${row.zone}` : ''} · {new Date(row.observed_at ?? row.created_at).toLocaleString()}</span></span><span class="flex items-center gap-3"><span class={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${responseColor(row.status)}`}>{row.status.replaceAll('_', ' ')}</span><span class="text-xs font-semibold text-slate-400">{(row.confidence * 100).toFixed(1)}%</span><span aria-hidden="true" class="text-slate-500 transition group-hover:translate-x-1 group-hover:text-accent">→</span></span></button></li>)}</ul> : <p class="px-6 py-14 text-center text-sm text-slate-400">No detections yet. New incidents will appear here.</p>}</section>
   <section class={`${panel} flex min-h-[420px] flex-col overflow-hidden`}><div class="flex items-start justify-between gap-3 p-5 sm:px-6"><div><p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300">Visual evidence</p><h2 class="mt-1 text-xl font-bold text-white">{featured?.class === 'fire' ? 'Latest fire evidence' : 'Latest evidence'}</h2></div>{featured && <span class={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${featured.class === 'fire' ? 'border-red-400/25 bg-red-400/10 text-red-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'}`}>{featured.class}</span>}</div><div class="relative mx-5 min-h-[260px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(20,184,166,0.14),transparent_65%)] sm:mx-6">{evidenceURL && featured ? <img src={evidenceURL} alt={`Saved ${featured.class} evidence from ${featured.camera_name}`} class="absolute inset-0 h-full w-full object-cover" /> : <div class="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 px-8 text-center"><span class="text-4xl text-teal-500/60" aria-hidden="true">◎</span><p class="text-sm text-slate-400">{featured ? evidenceError ? 'This evidence image is unavailable.' : 'Loading saved evidence…' : 'No saved evidence is available yet.'}</p></div>}{evidenceURL && <div class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />}</div><div class="flex flex-wrap items-center justify-between gap-3 p-5 sm:px-6"><div><p class="font-mono text-sm font-semibold text-white">{featured?.reference ?? 'Waiting for evidence'}</p><p class="mt-1 text-xs text-slate-400">{featured ? `${featured.camera_name}${featured.zone ? ` · ${featured.zone}` : ''} · ${new Date(featured.observed_at ?? featured.created_at).toLocaleString()}` : 'Images from detected incidents appear here.'}</p></div>{featured && <button type="button" class={link} onClick={() => onViewIncident(featured.id)}>Inspect evidence ↗</button>}</div></section>
  </div>
  <section class={`${panel} overflow-hidden`}><div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5 sm:px-6"><div><p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">Response queue</p><h2 class="mt-1 text-xl font-bold text-white">Recent notifications</h2></div><button type="button" class={link} onClick={() => onNavigate('/FiremeX/admin/alerts')}>View all ↗</button></div>{summary?.recentAlerts.length ? <div class="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3">{summary.recentAlerts.map(row => <button type="button" key={row.id} onClick={() => onViewIncident(row.incident_id)} class="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition hover:border-teal-400/25 hover:bg-teal-400/[0.05]"><span class="flex items-center justify-between gap-2"><span class={`text-xs font-semibold ${row.class === 'fire' ? 'text-red-300' : 'text-amber-300'}`}>{row.class === 'fire' ? 'Fire detected' : 'Smoke detected'}</span><span class={`h-2 w-2 rounded-full ${row.acknowledged_at ? 'bg-teal-400' : 'bg-amber-400'}`} /></span><strong class="mt-3 block font-mono text-sm text-white">{row.incident_reference}</strong><span class="mt-1 block truncate text-xs text-slate-400">{row.camera_name} · {new Date(row.created_at).toLocaleString()}</span><span class="mt-4 flex items-center justify-between text-xs text-slate-400"><span>{row.acknowledged_at ? 'Acknowledged' : 'Needs acknowledgement'}</span><span class="text-accent transition group-hover:translate-x-1" aria-hidden="true">→</span></span></button>)}</div> : <p class="px-6 py-10 text-sm text-slate-400">No notifications yet.</p>}</section>
  <p class="text-right text-xs text-slate-500">{lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading current data…'}</p>
 </div>
}
