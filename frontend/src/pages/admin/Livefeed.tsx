import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { authHeaders } from '../../session'
import { CameraFrame } from '../../components/common/CameraFrame'
import type { DetectorStatus } from '../../types/incident'
import { browserWebcamFor, forgetBrowserWebcam, rememberBrowserWebcam } from '../../browserWebcams'

type Camera = { ID: number; display_name: string; zone: string; entity_id: string; source_type?: 'home_assistant' | 'browser'; ai_enabled: boolean }
type Props = { onNavigate: (path: string) => void; readOnly?: boolean }

function isBrowserWebcam(camera: Camera) {
 return camera.source_type === 'browser' || browserWebcamFor(String(camera.ID)) !== null
}

function BrowserWebcamFrame({ camera, className }: { camera: Camera; className: string }) {
 const video = useRef<HTMLVideoElement>(null)
 const stream = useRef<MediaStream | null>(null)
 const [failed, setFailed] = useState(false)
 const [requesting, setRequesting] = useState(true)
 const [uploadError, setUploadError] = useState('')
 const deviceId = browserWebcamFor(String(camera.ID)) ?? ''

 useEffect(() => {
  let stopped = false
  let uploadTimer = 0
  let uploading = false
  function scheduleUpload(delay = 0) {
   window.clearTimeout(uploadTimer)
   if (!stopped && camera.ai_enabled) uploadTimer = window.setTimeout(() => void uploadFrame(), delay)
  }
  async function uploadFrame() {
   const element = video.current
   if (stopped || uploading || !camera.ai_enabled) return
   if (!element || element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !element.videoWidth || document.hidden) {
    scheduleUpload(2000)
    return
   }
   uploading = true
   try {
    const maxWidth = 960
    const scale = Math.min(1, maxWidth / element.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(element.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(element.videoHeight * scale))
    canvas.getContext('2d')?.drawImage(element, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) throw new Error('Could not prepare the webcam frame')
    const response = await fetch(`${API}cameras/${camera.ID}/browser-frame`, {
     method: 'POST',
     headers: { ...authHeaders(), 'Content-Type': 'image/jpeg' },
     credentials: 'include',
     body: blob
    })
    if (!response.ok) {
     const data = await response.json().catch(() => ({}))
     throw new Error(data.error || `AI frame upload failed (HTTP ${response.status})`)
    }
    if (!stopped) setUploadError('')
   } catch (error) {
    if (!stopped) setUploadError(error instanceof Error ? error.message : 'AI frame upload failed')
   } finally {
    uploading = false
    scheduleUpload(2000)
   }
  }
  async function start() {
   setRequesting(true)
   setFailed(false)
   if (camera.source_type === 'browser' && !deviceId) {
    setRequesting(false); setFailed(true); return
   }
   if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    setRequesting(false); setFailed(true); return
   }
   try {
    const active = await navigator.mediaDevices.getUserMedia({
     audio: false,
     video: deviceId ? { deviceId: { exact: deviceId } } : true
    })
    if (stopped) { active.getTracks().forEach(track => track.stop()); return }
    stream.current = active
    const track = active.getVideoTracks()[0]
    if (track) {
     const resolvedDeviceId = track.getSettings().deviceId
     if (resolvedDeviceId) rememberBrowserWebcam(String(camera.ID), resolvedDeviceId)
     track.onended = () => { if (!stopped) setFailed(true) }
    }
    if (video.current) { video.current.srcObject = active; await video.current.play() }
    if (!stopped) setRequesting(false)
    scheduleUpload()
   } catch {
    if (!stopped) { setRequesting(false); setFailed(true) }
   }
  }
  void start()
  return () => {
   stopped = true
   window.clearTimeout(uploadTimer)
   stream.current?.getTracks().forEach(track => track.stop())
   stream.current = null
   if (video.current) video.current.srcObject = null
  }
 }, [camera.ID, camera.ai_enabled, deviceId])

 if (failed && camera.source_type === 'browser') return <span role="alert" class="absolute inset-0 flex items-center justify-center text-center px-6 text-sm text-amber-300">This browser cannot access the saved webcam. Allow camera permission or add the webcam again on this computer.</span>
 if (failed) return <><CameraFrame entityId={camera.entity_id} alt={camera.display_name} className={className} /><span class="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded-lg text-xs text-amber-300">Browser webcam unavailable · showing Home Assistant feed</span></>
 return <><video ref={video} autoPlay playsInline muted class={className} />{requesting && <span role="status" class="absolute inset-0 flex items-center justify-center text-sm text-slate-400 bg-black">Starting live webcam…</span>}{uploadError && <span role="alert" class="absolute bottom-3 left-3 right-3 bg-black/85 px-3 py-2 rounded-lg text-xs text-amber-300">{uploadError}</span>}</>
}

export function Livefeed({ onNavigate, readOnly = false }: Props) {
 const [cameras, setCameras] = useState<Camera[]>([])
 const [statuses, setStatuses] = useState<DetectorStatus[]>([])
 const [detectorAvailable, setDetectorAvailable] = useState(true)
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
    const [cameraResult, statusResult] = await Promise.allSettled([
     fetch(`${API}cameras`, options),
     fetch(`${API}detection/status`, options)
    ])

    if (stopped) return

    if (cameraResult.status === 'fulfilled' && cameraResult.value.ok) {
     try {
      const data = await cameraResult.value.json()
      if (!stopped) { setCameras(data.cameras ?? []); setError('') }
     } catch {
      setError('Camera list returned an invalid response')
     }
    } else {
     setError('Camera list unavailable')
    }

    if (statusResult.status === 'fulfilled' && statusResult.value.ok) {
     try {
      const data = await statusResult.value.json()
      if (!stopped) {
       setStatuses(data.cameras ?? [])
       setDetectorAvailable(true)
       setWarning(data.storage_warning || data.discovery_warning || '')
      }
     } catch {
      setStatuses([])
      setDetectorAvailable(false)
      setWarning('AI detector status returned an invalid response. Camera feeds can still be viewed.')
     }
    } else {
     setStatuses([])
     setDetectorAvailable(false)
     setWarning('AI detector status is temporarily unavailable. Camera feeds can still be viewed.')
    }
   } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Camera list unavailable') }
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
   if (remove) forgetBrowserWebcam(String(camera.ID))
   setRefresh(n => n + 1)
  } catch (err) { setError(err instanceof Error ? err.message : 'Camera update failed') }
  finally { setBusy(null) }
 }
 return <div class="p-6 space-y-6">
  <header class="flex justify-between gap-4"><div><p class="text-accent text-xs uppercase tracking-widest">Camera monitoring</p><h1 class="text-3xl font-bold mt-2">Live Feed</h1><p class="text-slate-400 mt-2">Home Assistant camera AI runs continuously. Browser webcam AI runs while this page is open.</p></div>{!readOnly && <button class="text-accent" onClick={() => onNavigate('/FiremeX/admin/livefeed/add-device')}>+ Add camera</button>}</header>
  {error && <p role="alert" class="text-amber-300">{error}. Displayed status may be stale.</p>}
  {warning && <p role="alert" class="text-amber-300">{warning}</p>}
  <section class="grid grid-cols-1 xl:grid-cols-2 gap-6">{cameras.map(camera => {
   const status = statuses.find(s => s.camera_id === camera.ID)
   const state = detectorAvailable ? status?.state ?? (camera.source_type === 'browser' && camera.ai_enabled ? 'waiting for browser' : 'starting') : 'status unavailable'
   return <article key={camera.ID} class="border border-brand-border bg-brand-surface rounded-2xl overflow-hidden">
    <div class="relative aspect-video bg-black">{isBrowserWebcam(camera) ? <BrowserWebcamFrame camera={camera} className="w-full h-full object-contain" /> : <CameraFrame entityId={camera.entity_id} alt={camera.display_name} className="w-full h-full object-contain" />}<span class="absolute top-3 left-3 bg-black/80 px-3 py-1 rounded-lg">{camera.display_name}</span></div>
    <div class="p-5 space-y-3"><div class="flex justify-between gap-3"><h2 class="font-semibold">{camera.display_name} · {camera.zone || 'No zone'}</h2><span class={state === 'monitoring' || state === 'browser local' ? 'text-accent' : 'text-amber-300'}>{state}</span></div>
     <p class="text-xs text-slate-400">{camera.source_type === 'browser' ? `Webcam on this computer · AI ${camera.ai_enabled ? 'enabled while this page is open' : 'disabled'}` : `${camera.entity_id} · AI ${camera.ai_enabled ? 'enabled' : 'disabled'}`}</p>
     {status?.failure && <p class="text-amber-300 text-sm">{status.failure}</p>}
     {(camera.source_type !== 'browser' || camera.ai_enabled) && <><p class="text-xs text-slate-400">Last inference: {status?.last_inference_completion ? new Date(status.last_inference_completion).toLocaleTimeString() : 'Not yet completed'} · Processing: {status?.duration_ms ?? 0} ms · Lost results: {status?.lost_results ?? 0}</p><p class="text-xs text-slate-500">Monitoring describes processing health. A sample without detections does not establish that the scene is safe.</p></>}
     {!readOnly && <div class="flex gap-5 text-sm"><button disabled={busy === camera.ID} class="text-accent" onClick={() => mutate(camera)}>{camera.ai_enabled ? 'Disable AI' : 'Enable AI'}</button><button disabled={busy === camera.ID} class="text-red-400" onClick={() => mutate(camera, true)}>Remove camera</button></div>}
    </div>
   </article>
  })}</section>
  {loaded && cameras.length === 0 && <p class="text-center py-16 text-slate-400">No cameras enrolled. {readOnly ? 'Ask your administrator to add a camera.' : 'Add a camera to begin.'}</p>}
 </div>
}
