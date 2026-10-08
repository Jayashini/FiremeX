import { useEffect, useRef, useState } from 'preact/hooks'
import { API } from '../../api'
import { rememberBrowserWebcam } from '../../browserWebcams'

type Props = {
	onNavigate: (path: string) => void
}

type AvailableCamera = {
	entity_id: string
	friendly_name: string
	state: string
}

type BrowserCamera = {
	deviceId: string
	label: string
}

type SourceType = 'home_assistant' | 'browser'

function webcamErrorMessage(error: unknown) {
	if (!(error instanceof DOMException)) return 'The webcam could not be started.'

	switch (error.name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return 'Camera permission was denied. Allow camera access for this site and try again.'
		case 'NotFoundError':
			return 'No webcam was found on this device.'
		case 'NotReadableError':
		case 'AbortError':
			return 'The webcam is unavailable or is already being used by another application.'
		case 'OverconstrainedError':
			return 'The selected webcam is no longer available. Choose another camera.'
		default:
			return 'The webcam could not be started.'
	}
}

function WebcamPreview({ onDeviceResolved }: { onDeviceResolved: (deviceId: string) => void }) {
	const videoRef = useRef<HTMLVideoElement>(null)
	const streamRef = useRef<MediaStream | null>(null)
	const [cameras, setCameras] = useState<BrowserCamera[]>([])
	const [selectedDeviceId, setSelectedDeviceId] = useState('')
	const [status, setStatus] = useState<'requesting' | 'ready' | 'error'>('requesting')
	const [error, setError] = useState('')
	const [retry, setRetry] = useState(0)

	const stopStream = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
		if (videoRef.current) videoRef.current.srcObject = null
	}

	useEffect(() => {
		let cancelled = false

		const startStream = async () => {
			stopStream()
			setStatus('requesting')
			setError('')

			if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
				setStatus('error')
				setError('Webcam preview requires a secure page (HTTPS or localhost) and a supported browser.')
				return
			}

			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
				})

				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop())
					return
				}

				streamRef.current = stream
				const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId
				if (activeDeviceId) onDeviceResolved(activeDeviceId)
				if (videoRef.current) {
					videoRef.current.srcObject = stream
					await videoRef.current.play()
				}

				const devices = await navigator.mediaDevices.enumerateDevices()
				const videoInputs = devices
					.filter((device) => device.kind === 'videoinput')
					.map((device, index) => ({
						deviceId: device.deviceId,
						label: device.label || `Webcam ${index + 1}`
					}))

				if (cancelled) return
				setCameras(videoInputs)
				setStatus('ready')
			} catch (err) {
				if (cancelled) return
				stopStream()
				setStatus('error')
				setError(webcamErrorMessage(err))
			}
		}

		void startStream()
		return () => {
			cancelled = true
			stopStream()
		}
	}, [selectedDeviceId, retry])

	useEffect(() => {
		if (!navigator.mediaDevices?.addEventListener) return
		const refreshDevices = async () => {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices()
				const videoInputs = devices
					.filter((device) => device.kind === 'videoinput')
					.map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Webcam ${index + 1}` }))
				setCameras(videoInputs)
				if (selectedDeviceId && !videoInputs.some((device) => device.deviceId === selectedDeviceId)) {
					setSelectedDeviceId('')
				}
			} catch {
				// getUserMedia provides the actionable error state for this preview.
			}
		}

		navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
		return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
	}, [selectedDeviceId])

	return (
		<div class="w-full flex flex-col gap-4">
			{cameras.length > 1 && (
				<div class="flex flex-col gap-2">
					<label class="text-xs font-mono text-slate-400" for="browser-webcam">
						Webcam on this device
					</label>
					<select
						id="browser-webcam"
						value={selectedDeviceId}
						onChange={(event) => setSelectedDeviceId(event.currentTarget.value)}
						class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors cursor-pointer"
					>
						{!selectedDeviceId && <option value="">Default webcam</option>}
						{cameras.map((camera) => (
							<option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>
						))}
					</select>
				</div>
			)}

			<div class="w-full aspect-video rounded-xl bg-[#050B0D] border border-[#8B949E]/10 flex flex-col items-center justify-center gap-3 text-slate-500 overflow-hidden relative">
				<video ref={videoRef} autoPlay playsInline muted class="w-full h-full object-contain" />
				{status !== 'ready' && (
					<div class="absolute inset-0 bg-[#050B0D] flex flex-col items-center justify-center gap-3 text-center px-6">
						<svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span class={`text-xs font-mono ${status === 'error' ? 'text-amber-400' : 'text-slate-400'}`} role={status === 'error' ? 'alert' : 'status'}>
							{status === 'requesting' ? 'Requesting camera access…' : error}
						</span>
						{status === 'error' && (
							<button type="button" class="text-xs font-mono text-accent hover:text-accent/80" onClick={() => setRetry((value) => value + 1)}>
								Try again
							</button>
						)}
					</div>
				)}
			</div>
			<p class="text-[11px] text-slate-500 font-mono text-center">
				This local webcam remains available while FireMeX is open in this browser.
			</p>
		</div>
	)
}

export function AddDevice({ onNavigate }: Props) {
	const [sourceType, setSourceType] = useState<SourceType>('home_assistant')
	const [newCamName, setNewCamName] = useState('')
	const [selectedEntityId, setSelectedEntityId] = useState('')
	const [availableCameras, setAvailableCameras] = useState<AvailableCamera[]>([])
	const [isLoadingHA, setIsLoadingHA] = useState(true)
	const [haError, setHaError] = useState('')
	const [newCamZone, setNewCamZone] = useState('Main Entrance')
	const [newCamAi, setNewCamAi] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMsg, setErrorMsg] = useState('')
	const [browserDeviceId, setBrowserDeviceId] = useState('')
	const showBrowserWebcamPreview = sourceType === 'browser'

	// Fetch available Home Assistant cameras on mount
	useEffect(() => {
		const fetchHACameras = async () => {
			setIsLoadingHA(true)
			setHaError('')
			try {
				const token = localStorage.getItem('firemex_token')
				const res = await fetch(`${API}cameras/available`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				})

				if (!res.ok) {
					const data = await res.json()
					throw new Error(data.error || 'Failed to fetch Home Assistant cameras')
				}

				const data = await res.json()
				const cameras: AvailableCamera[] = data.cameras || []
				setAvailableCameras(cameras)

				if (cameras.length > 0) {
					setSelectedEntityId(cameras[0].entity_id)
					setNewCamName(cameras[0].friendly_name)
				}
			} catch (err: any) {
				setHaError(err.message || 'Could not connect to Home Assistant API')
			} finally {
				setIsLoadingHA(false)
			}
		}

		fetchHACameras()
	}, [])

	// When user selects a different HA camera from dropdown, update display name default
	const handleSelectEntity = (entityId: string) => {
		setSelectedEntityId(entityId)
		const found = availableCameras.find((c) => c.entity_id === entityId)
		if (found && !newCamName) {
			setNewCamName(found.friendly_name)
		}
	}

	const handleSourceType = (nextSource: SourceType) => {
		setSourceType(nextSource)
		setErrorMsg('')
		setBrowserDeviceId('')
		if (nextSource === 'browser') {
			setNewCamName('Computer Webcam')
		} else {
			const selected = availableCameras.find((camera) => camera.entity_id === selectedEntityId)
			setNewCamName(selected?.friendly_name ?? '')
		}
	}

	const handleSubmitCamera = async (e: any) => {
		e.preventDefault()
		if (sourceType === 'home_assistant' && !selectedEntityId) {
			setErrorMsg('Select or enter a Home Assistant camera entity.')
			return
		}
		if (sourceType === 'browser' && !browserDeviceId) {
			setErrorMsg('Allow camera access and wait for the webcam preview before adding it.')
			return
		}

		setIsSubmitting(true)
		setErrorMsg('')

		try {
			const entityId = sourceType === 'browser'
				? `browser.${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`
				: selectedEntityId
			const token = localStorage.getItem('firemex_token')
			const res = await fetch(`${API}cameras`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					entity_id: entityId,
					source_type: sourceType,
					display_name: newCamName || 'New Camera Stream',
					zone: newCamZone,
					ai_enabled: newCamAi
				})
			})

			const responseText = await res.text()
			let data: any = {}
			if (responseText.trim()) {
				try {
					data = JSON.parse(responseText)
				} catch {
					throw new Error(`FireMeX API returned an invalid response (HTTP ${res.status}).`)
				}
			}
			if (!res.ok) {
				throw new Error(data.error || `Could not reach the FireMeX backend (HTTP ${res.status}). Make sure the backend is running.`)
			}
			if (!data.camera?.ID) {
				throw new Error('FireMeX added the camera but returned an incomplete response. Refresh the Live Feed page.')
			}
			if (sourceType === 'browser' && browserDeviceId && data.camera?.ID) {
				rememberBrowserWebcam(String(data.camera.ID), browserDeviceId)
			}

			onNavigate('/FiremeX/admin/livefeed')
		} catch (err: any) {
			setErrorMsg(err.message || 'Error creating camera record')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
				<div>
					<h1 class="text-2xl font-bold text-slate-100 tracking-tight">Devices Configuration</h1>
					<p class="text-sm text-[#8B949E] mt-1">Manage Home Assistant camera streams & devices</p>
				</div>
			</header>

			<div class="flex items-center justify-center w-full px-6 py-4">
				<form onSubmit={handleSubmitCamera} class="w-full max-w-5xl bg-[#0B1315]/80 border border-[#8B949E]/10 rounded-3xl p-8 shadow-xl">
					{/* Header */}
					<div class="flex items-start justify-between mb-8">
						<div>
							<h1 class="text-[20px] font-semi-bold text-slate-300">Add New Device</h1>
							<p class="text-sm text-[#8B949E] mt-1 mb-5">Choose a webcam on this computer or a camera already connected to Home Assistant.</p>
						</div>
						<div class="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
							<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</div>
					</div>

					{errorMsg && (
						<div class="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
							{errorMsg}
						</div>
					)}

					{/* Grid Fields */}
					<div class="grid w-full grid-cols-1 md:grid-cols-4 gap-6 mb-6">
						{/* Camera Source */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400" for="camera-source">Camera Source</label>
							<select
								id="camera-source"
								value={sourceType}
								onChange={(event) => handleSourceType(event.currentTarget.value as SourceType)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors cursor-pointer"
							>
								<option value="home_assistant">Home Assistant / CCTV</option>
								<option value="browser">Webcam on this computer</option>
							</select>
						</div>

						{/* Home Assistant Camera Entity Dropdown */}
						{sourceType === 'home_assistant' && <div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">Home Assistant Camera</label>
							{isLoadingHA ? (
								<div class="w-full bg-[#050B0D] border border-[#8B949E]/20 text-slate-400 rounded-xl px-4 py-3 text-sm animate-pulse">
									Loading HA Entities...
								</div>
							) : availableCameras.length > 0 ? (
								<select
									value={selectedEntityId}
									onChange={(e: any) => handleSelectEntity(e.target.value)}
									class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors cursor-pointer font-mono"
								>
									{availableCameras.map((cam) => (
										<option key={cam.entity_id} value={cam.entity_id}>
											{cam.friendly_name} ({cam.entity_id})
										</option>
									))}
								</select>
							) : (
								<input
									type="text"
									required
									placeholder="camera.demo_camera"
									value={selectedEntityId}
									onChange={(e: any) => setSelectedEntityId(e.target.value)}
									class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors font-mono"
								/>
							)}
							{haError && (
								<span class="text-[11px] text-amber-400 font-mono mt-1">
									⚠️ HA API Warning: {haError} (Falling back to manual entity entry)
								</span>
							)}
						</div>}

						{/* Camera Display Name */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">Display Name</label>
							<input
								type="text"
								required
								placeholder="e.g. Perimeter Main Entrance"
								value={newCamName}
								onChange={(e: any) => setNewCamName(e.target.value)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
							/>
						</div>

						{/* Zone Assignment */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">Zone Assignment</label>
							<select
								value={newCamZone}
								onChange={(e: any) => setNewCamZone(e.target.value)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors appearance-none cursor-pointer"
							>
								<option value="Main Entrance">Main Entrance</option>
								<option value="Warehouse A">Warehouse A</option>
								<option value="Warehouse B">Warehouse B</option>
								<option value="Warehouse C">Warehouse C</option>
								<option value="Secure IT">Secure IT</option>
								<option value="Block D">Block D</option>
							</select>
						</div>

						<div class="flex flex-col gap-2 mt-6">
							<div class="flex items-center gap-4">
							<button
								type="button"
								onClick={() => setNewCamAi(!newCamAi)}
								class={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${newCamAi ? 'bg-accent' : 'bg-slate-700'}`}
							>
								<span class={`absolute left-1 top-1 bg-brand-surface w-4 h-4 rounded-full transition-transform duration-200 ${newCamAi ? 'translate-x-6' : 'translate-x-0'}`} />
							</button>
							<span class="text-xs font-mono text-slate-400 select-none">Enable FiremeX AI Tracking</span>
							</div>
							{sourceType === 'browser' && <span class="text-[11px] font-mono text-slate-500">AI runs while the Live Feed page is open on this computer.</span>}
						</div>
					</div>

					{/* Browser webcams can be previewed locally before the HA entity is enrolled. */}
					<div class="border border-[#8B949E]/10 rounded-2xl p-5 mb-8 bg-[#050B0D]/50 flex flex-col items-center justify-center gap-4">
						{showBrowserWebcamPreview ? <WebcamPreview onDeviceResolved={setBrowserDeviceId} /> : (
							<div class="w-full aspect-video rounded-xl bg-[#050B0D] border border-[#8B949E]/10 flex flex-col items-center justify-center gap-3 text-slate-500 overflow-hidden relative">
								<svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
								</svg>
								<span class="text-xs font-mono tracking-wider text-center px-4">
									{selectedEntityId ? 'Live preview starts after adding this camera.' : 'Select a camera to add.'}
								</span>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div class="flex items-center justify-between">
						<button
							type="button"
							onClick={() => onNavigate('/FiremeX/admin/livefeed')}
							class="text-sm font-mono text-slate-400 hover:text-slate-200 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
								disabled={isSubmitting || (sourceType === 'browser' && !browserDeviceId)}
							class="flex items-center gap-2 bg-accent/100 hover:bg-accent/90 text-brand-bg font-mono font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md shadow-accent/20 disabled:opacity-50"
						>
							<span>{isSubmitting ? 'Adding...' : 'Add Camera'}</span>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
