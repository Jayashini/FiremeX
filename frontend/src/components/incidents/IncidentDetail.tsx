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

 const button = 'rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold disabled:opacity-50'
 const row = current
 return <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5" onClick={() => { if (!busy) onClose() }}>
  <section role="dialog" aria-modal="true" aria-label={`Incident ${incident.reference}`} class="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-brand-border bg-brand-surface" onClick={e => e.stopPropagation()}>
   <header class="flex shrink-0 items-start justify-between gap-4 border-b border-brand-border p-5">
    <div><h2 class="text-xl font-bold">{row.reference} · {row.class === 'fire' ? 'Fire' : 'Smoke'} · {(row.confidence * 100).toFixed(1)}%</h2><p class="mt-1 text-sm text-slate-400">{row.camera_name}{row.zone ? ` · ${row.zone}` : ''} · {new Date(row.observed_at ?? row.created_at).toLocaleString()}</p></div>
    <button type="button" autoFocus disabled={busy} onClick={onClose} class="text-accent disabled:opacity-50">Close</button>
   </header>

   <div class="min-h-0 flex-1 overflow-y-auto p-5">
    <p class={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${row.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-300' : row.status === 'in_progress' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>Response: {row.status.replaceAll('_', ' ')}</p>
    {row.blocker_reason && <p class="mt-3 text-amber-300">Reason unresolved: {row.blocker_reason}</p>}
    {row.resolve_note && <p class="mt-3 text-emerald-300">Resolution: {row.resolve_note}</p>}
    <section class="mt-4 rounded-xl border border-brand-border bg-brand-bg p-4 text-sm"><h3 class="font-semibold">Response ownership</h3>{loadingDetails ? <p class="mt-2 text-slate-400">Loading…</p> : detailsError ? <div class="mt-2"><p role="alert" class="text-amber-300">{detailsError}</p><button type="button" disabled={busy} onClick={() => void retryDetails()} class="mt-2 text-accent underline disabled:opacity-50">Retry details</button></div> : row.acknowledged_at ? <p class="mt-2">Acknowledged by <strong>{row.acknowledged_by_name || `User #${row.acknowledged_by_id}`}</strong> <span class="capitalize text-slate-400">({row.acknowledged_by_role || 'role unavailable'})</span> · {new Date(row.acknowledged_at).toLocaleString()}</p> : <p class="mt-2 text-slate-400">Awaiting acknowledgement. The first user to acknowledge this notification owns the response.</p>}</section>
    {!loadingDetails && !detailsError && <details class="mt-4 rounded-xl border border-brand-border bg-brand-bg p-4 text-sm"><summary class="cursor-pointer font-semibold">Response history ({row.response_actions?.length ?? 0})</summary>{row.response_actions?.length ? <ol class="mt-3 space-y-3">{row.response_actions.map(entry => <li key={entry.id} class="border-t border-brand-border pt-3"><span class="font-semibold">{entry.status.replaceAll('_', ' ')}</span> · {entry.actor_name} <span class="capitalize text-slate-400">({entry.actor_role})</span> · {new Date(entry.created_at).toLocaleString()}{entry.note && <p class="mt-1 text-slate-300">Resolution: {entry.note}</p>}{entry.blocker_reason && <p class="mt-1 text-amber-300">Reason unresolved: {entry.blocker_reason}</p>}</li>)}</ol> : <p class="mt-2 text-slate-400">No response actions recorded yet.</p>}</details>}
    <p class="my-3 text-sm text-slate-400">Machine report · {row.review_status}. Observation time is backend image receipt time.</p>
    {url ? <img src={url} alt={`Saved ${row.class} evidence from ${row.camera_name}`} class="w-full rounded-xl" /> : <p role="status" class="py-12 text-center">{evidenceError || (row.has_snapshot ? 'Loading evidence…' : `Evidence ${row.evidence_status}`)}</p>}
    {row.evidence_status === 'unannotated' && <p class="text-amber-400">Original image; annotation was unavailable.</p>}
    <p class="mt-4 break-all text-xs text-slate-400">Model: {row.model_version || 'Not recorded'} · Sample: {row.sample_id || 'Not recorded'} · Threshold: {row.threshold_used ?? 'Not recorded'}</p>
    <p class="mt-2 text-xs text-slate-400">Evidence expiry: {row.evidence_expires_at ? new Date(row.evidence_expires_at).toLocaleString() : 'Not recorded'}. Model scores are not probabilities of danger.</p>
    <ul class="mt-3 text-sm">{row.detections.map((d, i) => <li key={i}>{d.label} {(d.confidence * 100).toFixed(1)}% · box [{Object.values(d.box).map(v => Math.round(v)).join(', ')}]</li>)}</ul>
   </div>

   <footer class="max-h-[45vh] shrink-0 space-y-3 overflow-y-auto border-t border-brand-border bg-brand-surface p-5">
    <p class="text-sm font-semibold">Incident response</p>
    {!loadingDetails && !detailsError && !row.acknowledged_at && <button type="button" disabled={busy || !row.alert_id} onClick={() => void acknowledge()} class="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-brand-bg disabled:opacity-50">{busy ? 'Acknowledging…' : 'Acknowledge notification'}</button>}
    {!loadingDetails && !detailsError && !row.can_respond && <p class="text-sm text-slate-400">{row.acknowledged_at ? `Only ${row.acknowledged_by_name || 'the acknowledging user'} can change this incident's response.` : 'Acknowledge its notification first to take responsibility for this incident.'}</p>}
    {row.can_respond && !loadingDetails && !detailsError && <div class="flex flex-wrap gap-2">
     {row.status === 'unresolved' && <button type="button" disabled={busy} onClick={() => void update('in_progress')} class={button}>Start response</button>}
     {row.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => { setAction('resolve'); setActionError(''); setSuccess('') }} class={`${button} ${action === 'resolve' ? 'border-emerald-400 text-emerald-300' : ''}`}>Mark resolved</button>}
     {row.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => { setAction('blocker'); setActionError(''); setSuccess('') }} class={`${button} ${action === 'blocker' ? 'border-amber-400 text-amber-300' : ''}`}>Keep unresolved</button>}
     {row.status === 'resolved' && <button type="button" disabled={busy} onClick={() => void update('unresolved')} class={button}>Reopen incident</button>}
    </div>}
    {row.can_respond && !loadingDetails && !detailsError && action === 'resolve' && row.status !== 'resolved' && <div class="space-y-2"><label class="block text-sm" for="resolution-note">Resolution note</label><textarea id="resolution-note" class="w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm" rows={2} maxLength={2000} value={note} onInput={e => setNote(e.currentTarget.value)} placeholder="What did you find and do?" /><button type="button" disabled={busy} onClick={() => void update('resolved')} class="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-brand-bg disabled:opacity-50">Save as resolved</button></div>}
    {row.can_respond && !loadingDetails && !detailsError && action === 'blocker' && row.status !== 'resolved' && <div class="space-y-2"><label class="block text-sm" for="blocker-reason">Why is it still unresolved?</label><textarea id="blocker-reason" class="w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm" rows={2} maxLength={2000} value={blocker} onInput={e => setBlocker(e.currentTarget.value)} placeholder="Describe what is preventing resolution" /><button type="button" disabled={busy} onClick={() => void update('unresolved', 'required')} class="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-brand-bg disabled:opacity-50">Save as unresolved</button></div>}
    {actionError && <p role="alert" class="text-sm text-amber-300">{actionError}</p>}{success && <p role="status" class="text-sm text-emerald-300">{success}</p>}
   </footer>
  </section>
 </div>
}
