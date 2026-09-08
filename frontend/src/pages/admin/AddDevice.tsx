import { useEffect, useState } from 'preact/hooks'
import { API } from '../../api'

type Props = {
	onNavigate: (path: string) => void
}

type AvailableCamera = {
	entity_id: string
	friendly_name: string
	state: string
}

export function AddDevice({ onNavigate }: Props) {
	const [newCamName, setNewCamName] = useState('')
	const [selectedEntityId, setSelectedEntityId] = useState('')
	const [availableCameras, setAvailableCameras] = useState<AvailableCamera[]>([])
	const [isLoadingHA, setIsLoadingHA] = useState(true)
	const [haError, setHaError] = useState('')
	const [newCamZone, setNewCamZone] = useState('Main Entrance')
	const [newCamAi, setNewCamAi] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMsg, setErrorMsg] = useState('')

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

	const handleSubmitCamera = async (e: any) => {
		e.preventDefault()
		if (!selectedEntityId && availableCameras.length > 0) return

		setIsSubmitting(true)
		setErrorMsg('')

		try {
			const token = localStorage.getItem('firemex_token')
			const res = await fetch(`${API}cameras`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					entity_id: selectedEntityId || 'camera.demo_camera',
					display_name: newCamName || 'New Camera Stream',
					zone: newCamZone,
					ai_enabled: newCamAi
				})
			})

			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Failed to add camera')
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
							<p class="text-sm text-[#8B949E] mt-1 mb-5">Select a Home Assistant camera entity to add to FiremeX.</p>
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
					<div class="grid w-full grid-cols-1 md:grid-cols-3 gap-6 mb-6">
						{/* Home Assistant Camera Entity Dropdown */}
						<div class="flex flex-col gap-2">
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
						</div>

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

						{/* Enable AI Tracking (toggle switch) */}
						<div class="flex items-center gap-4 mt-6">
							<button
								type="button"
								onClick={() => setNewCamAi(!newCamAi)}
								class={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${newCamAi ? 'bg-accent' : 'bg-slate-700'}`}
							>
								<span class={`absolute left-1 top-1 bg-brand-surface w-4 h-4 rounded-full transition-transform duration-200 ${newCamAi ? 'translate-x-6' : 'translate-x-0'}`} />
							</button>
							<span class="text-xs font-mono text-slate-400 select-none">Enable FiremeX AI Tracking</span>
						</div>
					</div>

					{/* Test Connection Preview Block */}
					<div class="border border-[#8B949E]/10 rounded-2xl p-5 mb-8 bg-[#050B0D]/50 flex flex-col items-center justify-center gap-4">
						<div class="w-full aspect-video rounded-xl bg-[#050B0D] border border-[#8B949E]/10 flex flex-col items-center justify-center gap-3 text-slate-500 overflow-hidden relative">
							{selectedEntityId ? (
								<img
									src={`${API}cameras/stream/${selectedEntityId}`}
									alt="HA Camera Preview"
									class="w-full h-full object-cover"
									onError={(e: any) => {
										e.target.onerror = null
										e.target.style.display = 'none'
									}}
								/>
							) : (
								<>
									<svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
									</svg>
									<span class="text-xs font-mono tracking-wider">NO ACTIVE STREAM SELECTED</span>
								</>
							)}
						</div>
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
							disabled={isSubmitting}
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
