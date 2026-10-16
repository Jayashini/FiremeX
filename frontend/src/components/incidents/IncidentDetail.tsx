import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Incident } from '../../types/incident'

export function IncidentDetail({ incident, onClose, onUpdated }: { incident: Incident; onClose: () => void; onUpdated: (updated: Incident) => void }) {
 const [url, setURL] = useState('')
 const [error, setError] = useState('')
 const [actionError, setActionError] = useState('')
 const [success, setSuccess] = useState('')
 const [busy, setBusy] = useState(false)
 const [note, setNote] = useState('')
 const [blocker, setBlocker] = useState('')
 async function update(status: Incident['status'], blockerReason = '') {
  if (status === 'resolved' && !note.trim()) { setActionError('Enter a resolution note.'); return }
  if (blockerReason === 'required' && !blocker.trim()) { setActionError('Enter a blocker reason.'); return }
  setBusy(true); setActionError(''); setSuccess('')
  try {
   const res = await fetch(`${API}incidents/${incident.id}/status`, { method: 'PATCH', headers: authHeaders(), credentials: 'include', body: JSON.stringify({ status, note: status === 'resolved' ? note.trim() : '', blocker_reason: blockerReason === 'required' ? blocker.trim() : '' }) })
   if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `Update failed (HTTP ${res.status})`) }
   onUpdated(await res.json() as Incident)
   setSuccess(status === 'resolved' ? 'Incident resolved.' : blockerReason ? 'Blocker recorded.' : status === 'in_progress' ? 'Response started.' : 'Incident reopened.')
   setNote(''); setBlocker('')
  } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not update incident') }
  finally { setBusy(false) }
 }
 useEffect(() => {
  const abort = new AbortController()
  let objectURL = ''
  setURL(''); setError('')
  if (incident.has_snapshot) {
   fetch(`${API}incidents/${incident.id}/snapshot`, { headers: authHeaders(), credentials: 'include', signal: abort.signal })
    .then(async res => {
     if (!res.ok) throw new Error(res.status === 410 ? 'Evidence expired' : 'Evidence unavailable or access denied')
     const blob = await res.blob()
     if (abort.signal.aborted) return
     objectURL = URL.createObjectURL(blob); setURL(objectURL)
    }).catch(err => { if (!abort.signal.aborted) setError(err.message) })
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => { abort.abort(); if (objectURL) URL.revokeObjectURL(objectURL); document.removeEventListener('keydown', key) }
 }, [incident.id, incident.has_snapshot])
 return <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5" onClick={onClose}>
  <section role="dialog" aria-modal="true" aria-label={`Incident ${incident.reference}`} class="bg-brand-surface border border-brand-border rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
   <div class="flex justify-between gap-4"><h2 class="text-xl font-bold">{incident.reference} · {incident.class} · {(incident.confidence * 100).toFixed(1)}%</h2><button autoFocus onClick={onClose} class="text-accent">Close</button></div>
   <p class="text-slate-400 mt-2">{incident.camera_name} · {incident.zone} · {new Date(incident.observed_at ?? incident.created_at).toLocaleString()}</p>
   <p class="text-sm text-slate-400 my-3">Machine report · {incident.review_status}. Observation time is backend image receipt time.</p>
   <p class={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${incident.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-300' : incident.status === 'in_progress' ? 'bg-blue-500/15 text-blue-300' : 'bg-amber-500/15 text-amber-300'}`}>Response: {incident.status.replaceAll('_', ' ')}</p>
   {incident.blocker_reason && <p class="mt-3 text-amber-300">Blocker: {incident.blocker_reason}</p>}
   {incident.resolve_note && <p class="mt-3 text-emerald-300">Resolution: {incident.resolve_note}</p>}
   {url ? <img src={url} alt={`Saved ${incident.class} evidence from ${incident.camera_name}`} class="w-full rounded-xl" /> : <p role="status" class="py-12 text-center">{error || (incident.has_snapshot ? 'Loading evidence…' : `Evidence ${incident.evidence_status}`)}</p>}
   {incident.evidence_status === 'unannotated' && <p class="text-amber-400">Original image; annotation was unavailable.</p>}
   <p class="text-xs text-slate-400 mt-4 break-all">Model: {incident.model_version || 'Not recorded'} · Sample: {incident.sample_id || 'Not recorded'} · Threshold: {incident.threshold_used ?? 'Not recorded'}</p>
   <p class="text-xs text-slate-400 mt-2">Evidence expiry: {incident.evidence_expires_at ? new Date(incident.evidence_expires_at).toLocaleString() : 'Not recorded'}. Model scores are not probabilities of danger.</p>
   <ul class="mt-3 text-sm">{incident.detections.map((d, i) => <li key={i}>{d.label} {(d.confidence * 100).toFixed(1)}% · box [{Object.values(d.box).map(v => Math.round(v)).join(', ')}]</li>)}</ul>
   <footer class="sticky bottom-0 mt-6 border-t border-brand-border bg-brand-surface pt-4 space-y-3">
    {incident.status === 'in_progress' && <label class="block text-sm">Resolution note <textarea class="mt-1 block w-full rounded-xl border border-brand-border bg-brand-bg p-3" rows={2} maxLength={2000} value={note} onInput={e => setNote(e.currentTarget.value)} placeholder="What did you find and do?" /></label>}
    {incident.status !== 'resolved' && <label class="block text-sm">Blocker reason <textarea class="mt-1 block w-full rounded-xl border border-brand-border bg-brand-bg p-3" rows={2} maxLength={2000} value={blocker} onInput={e => setBlocker(e.currentTarget.value)} placeholder="Required only when reporting a blocker" /></label>}
    {actionError && <p role="alert" class="text-amber-300">{actionError}</p>}{success && <p role="status" class="text-emerald-300">{success}</p>}
    <div class="flex flex-wrap gap-3">{incident.status === 'unresolved' && <button type="button" disabled={busy} onClick={() => void update('in_progress')} class="rounded-xl bg-accent px-4 py-2 text-brand-bg disabled:opacity-50">Start response</button>}{incident.status === 'in_progress' && <button type="button" disabled={busy} onClick={() => void update('resolved')} class="rounded-xl bg-accent px-4 py-2 text-brand-bg disabled:opacity-50">Resolve incident</button>}{incident.status !== 'resolved' && <button type="button" disabled={busy} onClick={() => void update('unresolved', 'required')} class="rounded-xl border border-amber-500/50 px-4 py-2 text-amber-300 disabled:opacity-50">Report blocker</button>}{incident.status === 'resolved' && <button type="button" disabled={busy} onClick={() => void update('unresolved')} class="rounded-xl border border-brand-border px-4 py-2 disabled:opacity-50">Reopen incident</button>}</div>
   </footer>
  </section>
 </div>
}
