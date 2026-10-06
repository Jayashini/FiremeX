import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import { CameraFrame } from '../../components/common/CameraFrame'
import type { DetectorStatus } from '../../types/incident'

type Camera = { ID: number; display_name: string; zone: string; entity_id: string; ai_enabled: boolean }
type Props = { onNavigate: (path: string) => void; readOnly?: boolean }
export function Livefeed({ onNavigate, readOnly = false }: Props) {
 const [cameras, setCameras] = useState<Camera[]>([])
 const [statuses, setStatuses] = useState<DetectorStatus[]>([])
 const [error, setError] = useState('')
 const [warning, setWarning] = useState('')
 const [loaded, setLoaded] = useState(false)
 const [busy, setBusy] = useState<number | null>(null)
 const [refresh, setRefresh] = useState(0)
 useEffect(() => {
  let stopped = false, running = false, timer = 0
  let abort: AbortController | null = null
  async function load() {
   if (stopped || running || document.hidden) return
   running = true; abort = new AbortController()
   const timeout = window.setTimeout(() => abort?.abort(), 15000)
   try {
    const options = { headers: authHeaders(), credentials: 'include' as const, signal: abort.signal }
    const [cr, sr] = await Promise.all([fetch(`${API}cameras`, options), fetch(`${API}detection/status`, options)])
    if (!cr.ok || !sr.ok) throw new Error('Camera or detector status unavailable')
    const [cd, sd] = await Promise.all([cr.json(), sr.json()])
    if (!stopped) { setCameras(cd.cameras ?? []); setStatuses(sd.cameras ?? []); setWarning(sd.storage_warning || sd.discovery_warning || ''); setError('') }
   } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Status unavailable') }
   finally { window.clearTimeout(timeout); running = false; if (!stopped) { setLoaded(true); if (!document.hidden) timer = window.setTimeout(load, 2000) } }
  }
  function visibility() { window.clearTimeout(timer); if (!document.hidden) void load() }
  document.addEventListener('visibilitychange', visibility); void load()
  return () => { stopped = true; window.clearTimeout(timer); abort?.abort(); document.removeEventListener('visibilitychange', visibility) }
 }, [refresh])
 async function mutate(camera: Camera, remove = false) {
  if (remove && !window.confirm(`Remove ${camera.display_name}?`)) return
  setBusy(camera.ID)
  try {
   const response = await fetch(`${API}cameras/${camera.ID}${remove ? '' : '/detection'}`, { method: remove ? 'DELETE' : 'PATCH', headers: authHeaders(), credentials: 'include', body: remove ? undefined : JSON.stringify({ ai_enabled: !camera.ai_enabled }) })
   if (!response.ok) throw new Error(`Camera update failed (HTTP ${response.status})`)
   setRefresh(n => n + 1)
  } catch (err) { setError(err instanceof Error ? err.message : 'Camera update failed') }
  finally { setBusy(null) }
 }
 return <div class="p-6 space-y-6">
  <header class="flex justify-between gap-4"><div><p class="text-accent text-xs uppercase tracking-widest">Camera monitoring</p><h1 class="text-3xl font-bold mt-2">Live Feed</h1><p class="text-slate-400 mt-2">AI runs in the backend, including while this page is closed.</p></div>{!readOnly && <button class="text-accent" onClick={() => onNavigate('/FiremeX/admin/livefeed/add-device')}>+ Add camera</button>}</header>
  {error && <p role="alert" class="text-amber-300">{error}. Displayed status may be stale.</p>}
  {warning && <p role="alert" class="text-amber-300">{warning}</p>}
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">{cameras.map(camera => {
   const status = statuses.find(s => s.camera_id === camera.ID)
   const state = error ? 'status unavailable' : status?.state ?? 'starting'
   return <article key={camera.ID} class="border border-brand-border bg-brand-surface rounded-2xl overflow-hidden">
    <div class="relative aspect-video bg-black"><CameraFrame entityId={camera.entity_id} alt={camera.display_name} className="w-full h-full object-contain" /><span class="absolute top-3 left-3 bg-black/80 px-3 py-1 rounded-lg">{camera.display_name}</span></div>
    <div class="p-5 space-y-3"><div class="flex justify-between gap-3"><h2 class="font-semibold">{camera.display_name} · {camera.zone || 'No zone'}</h2><span class={state === 'monitoring' ? 'text-accent' : 'text-amber-300'}>{state}</span></div>
     <p class="text-xs text-slate-400">{camera.entity_id} · AI {camera.ai_enabled ? 'enabled' : 'disabled'}</p>
     {status?.failure && <p class="text-amber-300 text-sm">{status.failure}</p>}
     <p class="text-xs text-slate-400">Last inference: {status?.last_inference_completion ? new Date(status.last_inference_completion).toLocaleTimeString() : 'Not yet completed'} · Processing: {status?.duration_ms ?? 0} ms · Lost results: {status?.lost_results ?? 0}</p>
     <p class="text-xs text-slate-500">Monitoring describes processing health. A sample without detections does not establish that the scene is safe.</p>
     {!readOnly && <div class="flex gap-5 text-sm"><button disabled={busy === camera.ID} class="text-accent" onClick={() => mutate(camera)}>{camera.ai_enabled ? 'Disable AI' : 'Enable AI'}</button><button disabled={busy === camera.ID} class="text-red-400" onClick={() => mutate(camera, true)}>Remove camera</button></div>}
    </div>
   </article>
  })}</section>
  {loaded && cameras.length === 0 && <p class="text-center py-16 text-slate-400">No cameras enrolled. {readOnly ? 'Ask your administrator to add a camera.' : 'Add a Home Assistant camera to begin.'}</p>}
 </div>
}
