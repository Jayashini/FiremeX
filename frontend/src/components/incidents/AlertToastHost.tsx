import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import type { Alert, AlertList } from '../../types/incident'

export function AlertToastHost({ onViewIncident }: { onViewIncident: (id: number) => void }) {
 const [toasts, setToasts] = useState<Alert[]>([])
 const watermark = useRef<number | null>(null)
 const polling = useRef(false)
 useEffect(() => {
  let stopped = false
  async function poll() {
   if (stopped || polling.current || document.hidden) return
   polling.current = true
   try {
    if (watermark.current === null) {
     const initial = await fetch(`${API}alerts?page_size=1`, { headers: authHeaders(), credentials: 'include' })
     if (!initial.ok) return
     const data = await initial.json() as AlertList
     if (!stopped) watermark.current = data.latest_id
     return
    }
    // Ascending cursor pages ensure bursts larger than one page are not lost.
    for (let page = 0; page < 10 && !stopped; page++) {
     const res = await fetch(`${API}alerts?after_id=${watermark.current}&page_size=100`, { headers: authHeaders(), credentials: 'include' })
     if (!res.ok) return
     const data = await res.json() as AlertList
     if (stopped || data.alerts.length === 0) return
     watermark.current = data.alerts[data.alerts.length - 1].id
     setToasts(old => [...old, ...data.alerts.filter(alert => !old.some(item => item.id === alert.id))])
     if (data.alerts.length < 100) return
    }
   } catch { /* Retry on the next poll; keep the cursor unchanged. */ }
   finally { polling.current = false }
  }
  void poll()
  const timer = window.setInterval(() => void poll(), 3000)
  const visibility = () => { if (!document.hidden) void poll() }
  document.addEventListener('visibilitychange', visibility)
  return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
 }, [])
 return <aside aria-label="New detection notifications" aria-live="polite" class="fixed right-3 top-3 z-[70] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-3">
  {toasts.map(alert => <div key={alert.id} role="status" class="rounded-2xl border border-amber-500/50 bg-brand-surface p-4 shadow-xl">
   <div class="flex items-start justify-between gap-3"><strong class={alert.class === 'fire' ? 'text-red-400' : 'text-amber-300'}>{alert.class === 'fire' ? 'Fire detected' : 'Smoke detected'}</strong><button type="button" aria-label={`Dismiss ${alert.incident_reference}`} class="text-slate-400 hover:text-white" onClick={() => setToasts(old => old.filter(item => item.id !== alert.id))}>×</button></div>
   <p class="mt-2 text-sm">{alert.camera_name}{alert.zone ? ` · ${alert.zone}` : ''}</p>
   <p class="mt-1 text-xs text-slate-400">{(alert.confidence * 100).toFixed(1)}% confidence · {new Date(alert.created_at).toLocaleString()}</p>
   <button type="button" class="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-brand-bg" onClick={() => { onViewIncident(alert.incident_id); setToasts(old => old.filter(item => item.id !== alert.id)) }}>View</button>
  </div>)}
 </aside>
}
