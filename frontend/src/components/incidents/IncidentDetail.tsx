import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Incident } from '../../types/incident'

export function IncidentDetail({ incident, onClose }: { incident: Incident; onClose: () => void }) {
 const [url, setURL] = useState('')
 const [error, setError] = useState('')
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
  <section role="dialog" aria-modal="true" aria-label={`Evidence for ${incident.reference}`} class="bg-brand-surface border border-brand-border rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
   <div class="flex justify-between gap-4"><h2 class="text-xl font-bold">{incident.reference} · {incident.class} · {(incident.confidence * 100).toFixed(1)}%</h2><button autoFocus onClick={onClose} class="text-accent">Close</button></div>
   <p class="text-slate-400 mt-2">{incident.camera_name} · {incident.zone} · {new Date(incident.observed_at ?? incident.created_at).toLocaleString()}</p>
   <p class="text-sm text-slate-400 my-3">Machine report · {incident.review_status} · {incident.status}. Observation time is backend image receipt time.</p>
   {url ? <img src={url} alt={`Saved ${incident.class} evidence from ${incident.camera_name}`} class="w-full rounded-xl" /> : <p role="status" class="py-12 text-center">{error || (incident.has_snapshot ? 'Loading evidence…' : `Evidence ${incident.evidence_status}`)}</p>}
   {incident.evidence_status === 'unannotated' && <p class="text-amber-400">Original image; annotation was unavailable.</p>}
   <p class="text-xs text-slate-400 mt-4 break-all">Model: {incident.model_version || 'Not recorded'} · Sample: {incident.sample_id || 'Not recorded'} · Threshold: {incident.threshold_used ?? 'Not recorded'}</p>
   <p class="text-xs text-slate-400 mt-2">Evidence expiry: {incident.evidence_expires_at ? new Date(incident.evidence_expires_at).toLocaleString() : 'Not recorded'}. Model scores are not probabilities of danger.</p>
   <ul class="mt-3 text-sm">{incident.detections.map((d, i) => <li key={i}>{d.label} {(d.confidence * 100).toFixed(1)}% · box [{Object.values(d.box).map(v => Math.round(v)).join(', ')}]</li>)}</ul>
  </section>
 </div>
}
