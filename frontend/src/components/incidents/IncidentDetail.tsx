import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Alert, Incident } from '../../types/incident'

type ResponseAction = 'resolve' | 'blocker' | null

export function IncidentDetail({ incident, onClose, onUpdated }: {
 incident: Incident
 onClose: () => void
 onUpdated: (updated: Incident) => void
}) {
 const [url, setURL] = useState('')
 const [evidenceError, setEvidenceError] = useState('')
 const [actionError, setActionError] = useState('')
 const [success, setSuccess] = useState('')
 const [busy, setBusy] = useState(false)
 const [action, setAction] = useState<ResponseAction>(null)
 const [note, setNote] = useState('')
 const [blocker, setBlocker] = useState('')
 const [current, setCurrent] = useState(incident)
 const [loadingDetails, setLoadingDetails] = useState(true)
 const [detailsError, setDetailsError] = useState('')
 const requestVersion = useRef(0)
 const mutating = useRef(false)

 async function fetchDetails(signal?: AbortSignal): Promise<Incident> {
  const res = await fetch(`${API}incidents/${incident.id}`, { headers: authHeaders(), credentials: 'include', signal })
  if (!res.ok) throw new Error(`Could not load response details (HTTP ${res.status})`)
  return await res.json() as Incident
 }

 async function retryDetails() {
  setLoadingDetails(true); setDetailsError('')
  const version = ++requestVersion.current
  try {
   const details = await fetchDetails()
   if (version === requestVersion.current) setCurrent(details)
  }
  catch (err) { setDetailsError(err instanceof Error ? err.message : 'Could not load response details') }
  finally { setLoadingDetails(false) }
 }

 useEffect(() => {
  const abort = new AbortController()
  const version = ++requestVersion.current
  setLoadingDetails(true); setDetailsError('')
  fetchDetails(abort.signal)
   .then(details => { if (!abort.signal.aborted && version === requestVersion.current) setCurrent(details) })
   .catch(err => { if (!abort.signal.aborted) setDetailsError(err instanceof Error ? err.message : 'Could not load response details') })
   .finally(() => { if (!abort.signal.aborted) setLoadingDetails(false) })
  return () => abort.abort()
 }, [incident.id])

 useEffect(() => {
  if (busy || loadingDetails) return
  let stopped = false
  const timer = window.setInterval(() => {
   if (document.hidden || mutating.current) return
   const version = requestVersion.current
   void fetchDetails().then(details => {
    if (!stopped && !mutating.current && version === requestVersion.current) { setCurrent(details); setDetailsError('') }
   }).catch(() => {})
  }, 5000)
  return () => { stopped = true; window.clearInterval(timer) }
 }, [incident.id, busy, loadingDetails])

 async function acknowledge() {
  if (!current.alert_id || current.acknowledged_at) return
  mutating.current = true; ++requestVersion.current
  setBusy(true); setActionError(''); setSuccess('')
  let saved = false
  try {
   const res = await fetch(`${API}alerts/${current.alert_id}/acknowledge`, { method: 'PATCH', headers: authHeaders(), credentials: 'include' })
   if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Acknowledgement failed (HTTP ${res.status})`)
   }
   const alert = await res.json() as Alert
   saved = true
   setCurrent(old => ({ ...old, acknowledged_at: alert.acknowledged_at, acknowledged_by_id: alert.acknowledged_by_id, acknowledged_by_name: alert.acknowledged_by_name, acknowledged_by_role: alert.acknowledged_by_role, can_respond: false }))
   const updated = await fetchDetails()
   setCurrent(updated); onUpdated(updated)
   setSuccess(updated.can_respond ? 'Notification acknowledged. You can now manage this incident.' : `Notification was already acknowledged by ${updated.acknowledged_by_name || 'another user'}.`)
  } catch (err) {
   if (saved) setDetailsError('Acknowledgement saved, but response details could not be refreshed. Retry to see who can respond.')
   else setActionError(err instanceof Error ? err.message : 'Could not acknowledge notification')
  } finally { mutating.current = false; setBusy(false) }
 }

 async function update(status: Incident['status'], blockerReason = '') {
  if (status === 'resolved' && !note.trim()) { setActionError('Enter a resolution note before marking this incident resolved.'); return }
  if (blockerReason === 'required' && !blocker.trim()) { setActionError('Enter a reason for keeping this incident unresolved.'); return }
  mutating.current = true; ++requestVersion.current
  setBusy(true); setActionError(''); setSuccess('')
  try {
   const res = await fetch(`${API}incidents/${incident.id}/status`, {
    method: 'PATCH', headers: authHeaders(), credentials: 'include',
    body: JSON.stringify({ status, note: status === 'resolved' ? note.trim() : '', blocker_reason: blockerReason === 'required' ? blocker.trim() : '' }),
   })
   if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Update failed (HTTP ${res.status})`)
   }
   const updated = await res.json() as Incident
   setCurrent(updated); onUpdated(updated)
   setSuccess(status === 'resolved' ? 'Incident marked resolved.' : blockerReason ? 'Incident remains unresolved; blocker saved.' : status === 'in_progress' ? 'Response started.' : 'Incident reopened.')
   setNote(''); setBlocker(''); setAction(null)
  } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not update incident') }
  finally { mutating.current = false; setBusy(false) }
 }

 useEffect(() => {
  const abort = new AbortController()
  let objectURL = ''
  setURL(''); setEvidenceError('')
  if (incident.has_snapshot) {
   fetch(`${API}incidents/${incident.id}/snapshot`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })
    .then(async res => {
     if (!res.ok) throw new Error(res.status === 410 ? 'Evidence expired' : 'Evidence unavailable or access denied')
     const blob = await res.blob()
     if (abort.signal.aborted) return
     objectURL = URL.createObjectURL(blob); setURL(objectURL)
    }).catch(err => { if (!abort.signal.aborted) setEvidenceError(err.message) })
  }
  return () => { abort.abort(); if (objectURL) URL.revokeObjectURL(objectURL) }
 }, [incident.id, incident.has_snapshot])
 useEffect(() => {
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
 }, [busy, onClose])

 const button = 'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-teal-400/40 hover:text-teal-200 disabled:opacity-50'
 const row = current
 const statusColor = row.status === 'resolved' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : row.status === 'in_progress' ? 'border-sky-400/25 bg-sky-400/10 text-sky-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
 return <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-5" onClick={() => { if (!busy) onClose() }}>
  <section role="dialog" aria-modal="true" aria-label={`Incident ${incident.reference}`} class="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#091113] shadow-[0_40px_120px_rgba(0,0,0,0.65)] sm:max-h-[94vh]" onClick={e => e.stopPropagation()}>
   <header class="relative shrink-0 overflow-hidden border-b border-white/[0.08] bg-[radial-gradient(circle_at_85%_0%,rgba(20,184,166,0.16),transparent_45%)] p-5 sm:px-7 sm:py-6"><div class="relative flex items-start justify-between gap-4"><div><div class="flex flex-wrap items-center gap-2"><span class="rounded-full border border-teal-400/25 bg-teal-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-teal-300">{row.reference}</span><span class={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusColor}`}>{row.status.replaceAll('_', ' ')}</span></div><h2 class="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{row.class === 'fire' ? 'Fire' : 'Smoke'} detection <span class="text-slate-500">· {(row.confidence * 100).toFixed(1)}%</span></h2><p class="mt-1.5 text-sm text-slate-400">{row.camera_name}{row.zone ? ` · ${row.zone}` : ''} · {new Date(row.observed_at ?? row.created_at).toLocaleString()}</p></div><button type="button" autoFocus disabled={busy} onClick={onClose} aria-label="Close incident details" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-lg text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50">×</button></div><div class="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><span class="text-teal-300">01 · Detection</span><span class={row.acknowledged_at ? 'text-teal-300' : ''}>02 · Acknowledgement</span><span class={row.status === 'resolved' ? 'text-emerald-300' : row.status === 'in_progress' ? 'text-sky-300' : ''}>03 · Response</span></div></header>
   <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7"><div class="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(285px,0.75fr)]"><div class="space-y-5"><section class="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0c1719]"><div class="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3 sm:px-5"><div><p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">Captured evidence</p><p class="mt-0.5 text-xs text-slate-400">Saved frame from {row.camera_name}</p></div><span class="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-slate-300">{row.evidence_status.replaceAll('_', ' ')}</span></div>{url ? <img src={url} alt={`Saved ${row.class} evidence from ${row.camera_name}`} class="max-h-[510px] w-full bg-black object-contain" /> : <p role="status" class="flex min-h-[300px] items-center justify-center px-5 text-center text-sm text-slate-400">{evidenceError || (row.has_snapshot ? 'Loading evidence…' : `Evidence ${row.evidence_status}`)}</p>}{row.evidence_status === 'unannotated' && <p class="border-t border-white/[0.07] px-5 py-3 text-xs text-amber-300">Original image; annotation was unavailable.</p>}</section><section class="rounded-[22px] border border-white/[0.08] bg-[#0c1719] p-5"><h3 class="text-sm font-semibold text-white">Detection details</h3><p class="mt-1 text-xs text-slate-400">Model scores are not probabilities of danger.</p><div class="mt-4 flex flex-wrap gap-2">{row.detections.map((d, i) => <span key={i} class={`rounded-lg border px-3 py-2 text-xs ${d.label === 'fire' ? 'border-red-400/20 bg-red-400/10 text-red-200' : 'border-amber-400/20 bg-amber-400/10 text-amber-200'}`}>{d.label} · {(d.confidence * 100).toFixed(1)}% · box [{Object.values(d.box).map(v => Math.round(v)).join(', ')}]</span>)}</div><div class="mt-4 grid gap-3 border-t border-white/[0.07] pt-4 text-xs sm:grid-cols-2"><div><span class="block text-slate-500">Model version</span><span class="mt-1 block break-all text-slate-300">{row.model_version || 'Not recorded'}</span></div><div><span class="block text-slate-500">Threshold / review</span><span class="mt-1 block text-slate-300">{row.threshold_used ?? 'Not recorded'} · {row.review_status}</span></div><div><span class="block text-slate-500">Sample ID</span><span class="mt-1 block break-all text-slate-300">{row.sample_id || 'Not recorded'}</span></div><div><span class="block text-slate-500">Evidence expires</span><span class="mt-1 block text-slate-300">{row.evidence_expires_at ? new Date(row.evidence_expires_at).toLocaleString() : 'Not recorded'}</span></div></div></section></div>
    <aside class="space-y-5"><section class="rounded-[22px] border border-white/[0.08] bg-[#0c1719] p-5"><p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400">Acknowledged by</p>{loadingDetails ? <p class="mt-4 text-sm text-slate-400">Loading…</p> : detailsError ? <div class="mt-4"><p role="alert" class="text-sm text-amber-300">{detailsError}</p><button type="button" disabled={busy} onClick={() => void retryDetails()} class="mt-2 text-sm font-semibold text-accent disabled:opacity-50">Retry details</button></div> : row.acknowledged_at ? <><p class="mt-4 text-lg font-semibold text-white">{row.acknowledged_by_name || `User #${row.acknowledged_by_id}`}</p><p class="mt-1 text-sm capitalize text-slate-400">{row.acknowledged_by_role || 'Role unavailable'}</p><p class="mt-4 border-t border-white/[0.07] pt-4 text-xs text-slate-500">Acknowledged {new Date(row.acknowledged_at).toLocaleString()}</p></> : <><p class="mt-4 text-lg font-semibold text-white">Awaiting acknowledgement</p><p class="mt-1 text-sm leading-relaxed text-slate-400">The first person to acknowledge this notification can manage its response.</p></>}</section>{row.blocker_reason && <section class="rounded-[22px] border border-amber-400/20 bg-amber-400/[0.07] p-5"><p class="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Reason unresolved</p><p class="mt-2 text-sm text-slate-200">{row.blocker_reason}</p></section>}{row.resolve_note && <section class="rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.07] p-5"><p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Resolution</p><p class="mt-2 text-sm text-slate-200">{row.resolve_note}</p></section>}{!loadingDetails && !detailsError && <details class="rounded-[22px] border border-white/[0.08] bg-[#0c1719] p-5"><summary class="cursor-pointer text-sm font-semibold text-white">Response history <span class="ml-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-xs text-slate-400">{row.response_actions?.length ?? 0}</span></summary>{row.response_actions?.length ? <ol class="mt-4 space-y-4 border-l border-teal-400/25 pl-4">{row.response_actions.map(entry => <li key={entry.id} class="relative text-sm before:absolute before:-left-[21px] before:top-1 before:h-2.5 before:w-2.5 before:rounded-full before:bg-teal-400"><p class="font-semibold capitalize text-white">{entry.status.replaceAll('_', ' ')}</p><p class="mt-1 text-xs text-slate-400">{entry.actor_name} · <span class="capitalize">{entry.actor_role}</span> · {new Date(entry.created_at).toLocaleString()}</p>{entry.note && <p class="mt-2 text-xs text-emerald-200">Resolution: {entry.note}</p>}{entry.blocker_reason && <p class="mt-2 text-xs text-amber-200">Reason unresolved: {entry.blocker_reason}</p>}</li>)}</ol> : <p class="mt-4 text-sm text-slate-400">No response actions recorded yet.</p>}</details>}</aside></div></div>
   <footer class="max-h-[40vh] shrink-0 space-y-3 overflow-y-auto border-t border-white/[0.08] bg-[#0c1719] p-4 sm:px-7 sm:py-5"><div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm font-semibold text-white">Incident response</p><span class="text-xs text-slate-500">{row.acknowledged_at ? `Acknowledged by ${row.acknowledged_by_name || `User #${row.acknowledged_by_id}`}` : 'Acknowledgement required'}</span></div>{!loadingDetails && !detailsError && !row.acknowledged_at && <button type="button" disabled={busy || !row.alert_id} onClick={() => void acknowledge()} class="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-[#06100f] transition hover:bg-teal-400 disabled:opacity-50">{busy ? 'Acknowledging…' : 'Acknowledge notification'}</button>}{!loadingDetails && !detailsError && !row.can_respond && <p class="text-xs text-slate-400">{row.acknowledged_at ? `Only ${row.acknowledged_by_name || 'the acknowledging user'} can change this incident's response.` : 'Acknowledge its notification first to take responsibility for this incident.'}</p>}{row.can_respond && !loadingDetails && !detailsError && <div class="flex flex-wrap gap-2">{row.status === 'unresolved' && <button type="button" disabled={busy} onClick={() => void update('in_progress')} class={button}>Start response</button>}{row.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => { setAction('resolve'); setActionError(''); setSuccess('') }} class={`${button} ${action === 'resolve' ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : ''}`}>Mark resolved</button>}{row.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => { setAction('blocker'); setActionError(''); setSuccess('') }} class={`${button} ${action === 'blocker' ? 'border-amber-400/60 bg-amber-400/10 text-amber-200' : ''}`}>Keep unresolved</button>}{row.status === 'resolved' && <button type="button" disabled={busy} onClick={() => void update('unresolved')} class={button}>Reopen incident</button>}</div>}{row.can_respond && !loadingDetails && !detailsError && action === 'resolve' && row.status !== 'resolved' && <div class="space-y-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4"><label class="block text-sm font-semibold text-slate-200" for="resolution-note">Resolution note</label><textarea id="resolution-note" class="w-full rounded-xl border border-white/10 bg-[#091113] p-3 text-sm outline-none focus:border-emerald-400/50" rows={2} maxLength={2000} value={note} onInput={e => setNote(e.currentTarget.value)} placeholder="What did you find and do?" /><button type="button" disabled={busy} onClick={() => void update('resolved')} class="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-[#06100f] disabled:opacity-50">Save as resolved</button></div>}{row.can_respond && !loadingDetails && !detailsError && action === 'blocker' && row.status !== 'resolved' && <div class="space-y-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4"><label class="block text-sm font-semibold text-slate-200" for="blocker-reason">Why is it still unresolved?</label><textarea id="blocker-reason" class="w-full rounded-xl border border-white/10 bg-[#091113] p-3 text-sm outline-none focus:border-amber-400/50" rows={2} maxLength={2000} value={blocker} onInput={e => setBlocker(e.currentTarget.value)} placeholder="Describe what is preventing resolution" /><button type="button" disabled={busy} onClick={() => void update('unresolved', 'required')} class="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#06100f] disabled:opacity-50">Save as unresolved</button></div>}{actionError && <p role="alert" class="text-sm text-amber-300">{actionError}</p>}{success && <p role="status" class="text-sm text-emerald-300">{success}</p>}</footer>
  </section>
 </div>
}
