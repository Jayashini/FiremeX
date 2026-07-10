import { useEffect, useState } from 'preact/hooks'

type Props = {
	onNavigate: (path: string) => void
}

const initialCameras = [
	{
		id: 'CAM-01',
		name: 'CAM-01 Main Entrance',
		zone: 'Warehouse A',
		status: 'Normal',
		ip: '192.168.1.101',
		fps: '25 fps',
		resolution: '1080p',
		time: '06-26 14:42:08'
	},
	{
		id: 'CAM-02',
		name: 'CAM-02 Entrance',
		zone: 'Warehouse A',
		status: 'Critical',
		ip: '192.168.1.102',
		fps: '25 fps',
		resolution: '1080p',
		time: '06-26 14:42:08'
	},
	{
		id: 'CAM-03',
		name: 'CAM-03 Entrance',
		zone: 'Warehouse C',
		status: 'Normal',
		ip: '192.168.1.103',
		fps: '20 fps',
		resolution: '1080p',
		time: '06-26 14:42:08'
	},
	{
		id: 'CAM-04',
		name: 'CAM-02 Server Room North',
		zone: 'Secure IT',
		status: 'Normal',
		ip: '192.168.1.104',
		fps: '30 fps',
		resolution: '1080p',
		time: '06-26 14:42:08'
	}
]

export function Livefeed({ onNavigate }: Props) {
	const [cameras, setCameras] = useState(() => {
		const saved = localStorage.getItem('firemex_cameras')
		return saved ? JSON.parse(saved) : initialCameras
	})
	const [layout, setLayout] = useState<'2x2' | '1x2'>('2x2')
	const [timeStr, setTimeStr] = useState('')

	// Store default list in local storage if not already present
	useEffect(() => {
		if (!localStorage.getItem('firemex_cameras')) {
			localStorage.setItem('firemex_cameras', JSON.stringify(initialCameras))
		}
	}, [])

	// Real-time ticking clock for premium effect
	useEffect(() => {
		const updateTime = () => {
			const now = new Date()
			const hours = String(now.getHours()).padStart(2, '0')
			const mins = String(now.getMinutes()).padStart(2, '0')
			const secs = String(now.getSeconds()).padStart(2, '0')
			setTimeStr(`${hours} : ${mins} : ${secs}`)
		}
		updateTime()
		const interval = setInterval(updateTime, 1000)
		return () => clearInterval(interval)
	}, [])

	const handleDeleteCamera = (id: string) => {
		const updated = cameras.filter((cam: any) => cam.id !== id)
		setCameras(updated)
		localStorage.setItem('firemex_cameras', JSON.stringify(updated))
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
				<div>
					<h1 class="text-2xl font-bold text-slate-100">Live Feed</h1>
					<p class="text-sm text-[#8B949E] mt-1">{cameras.length} cameras streaming | 1 critical detection</p>
				</div>
				<div class="flex items-center gap-3 self-end sm:self-auto">
					{/* Live Ticker */}
					<div class="flex items-center gap-2 bg-[#050B0D] border border-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 font-mono text-sm tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.05)]">
						<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
						<span class="font-semibold">LIVE</span>
						<span class="text-slate-400">|</span>
						<span>{timeStr || '00 : 00 : 00'}</span>
					</div>

					{/* Notification Bell */}
					<button
						type="button"
						class="relative flex items-center justify-center w-10 h-10 bg-brand-surface border border-brand-border hover:border-accent/40 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
						onClick={() => onNavigate('/admin/alerts')}
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
						</svg>
						<span class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
							3
						</span>
					</button>
				</div>
			</header>

			{/* Secondary Controls Header */}
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 m-6">
				<div class="flex items-center gap-2">
					<span class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Camera Grid</span>
					<span class="text-xs text-slate-600">|</span>
					<span class="text-xs text-slate-500">All zones</span>
				</div>

				<div class="flex items-center gap-4">
					{/* Layout Switcher */}
					<div class="flex items-center gap-2 bg-brand-surface border border-brand-border rounded-xl p-1 text-xs">
						<span class="text-slate-500 px-2 select-none">Layout</span>
						<button
							type="button"
							class={`px-3 py-1.5 rounded-lg font-semibold transition-all ${layout === '2x2'
								? 'bg-slate-200 text-brand-bg shadow'
								: 'text-slate-400 hover:text-slate-200'
								}`}
							onClick={() => setLayout('2x2')}
						>
							2 × 2
						</button>
						<button
							type="button"
							class={`px-3 py-1.5 rounded-lg font-semibold transition-all ${layout === '1x2'
								? 'bg-slate-200 text-brand-bg shadow'
								: 'text-slate-400 hover:text-slate-200'
								}`}
							onClick={() => setLayout('1x2')}
						>
							1 × 2
						</button>
					</div>

					{/* Add Camera Button */}
					<button
						type="button"
						class="flex items-center gap-2 bg-accent/10 border border-accent hover:border-accent/40 text-accent font-bold text-xs px-4 py-3 rounded-md transition-all shadow-md shadow-accent/20"
						onClick={() => onNavigate('/admin/livefeed/add-device')}
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						<span>Add Camera</span>
					</button>
				</div>
			</div>

			{/* Camera Grid Layout */}
			<section
				class={`grid gap-6 transition-all duration-300 m-6 mt-0 ${layout === '2x2'
					? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
					: 'grid-cols-1 md:grid-cols-2'
					}`}
			>
				{cameras.map((camera: any) => {
					const isCritical = camera.status === 'Critical'
					return (
						<article
							key={camera.id}
							class={`flex flex-col gap-4 bg-[#0B1315]/40 border rounded-3xl p-5 transition-all ${isCritical
								? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse-ring'
								: 'border-[#8B949E]/10 hover:border-[#8B949E]/20'
								}`}
						>
							{/* Video Frame Preview */}
							<div class="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#050B0D] border border-[#8B949E]/10 flex items-center justify-center group">
								{/* Placeholder grid lines to simulate inactive stream */}
								<div class="absolute inset-0 bg-[linear-gradient(rgba(14,23,26,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(14,23,26,0.5)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

								{/* Dynamic Glow for Critical alert */}
								{isCritical && (
									<div class="absolute inset-0 bg-radial from-red-600/15 to-transparent pointer-events-none" />
								)}

								{/* Static Video Camera Icon in Center */}
								<svg class={`w-12 h-12 text-slate-800 transition-transform group-hover:scale-110 duration-300 ${isCritical ? 'text-red-900/40' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>

								{/* Critical overlay badge */}
								{isCritical && (
									<div class="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center bg-red-600 border border-red-500 px-3 py-1.5 rounded-xl text-white text-[10px] font-bold tracking-wider shadow-lg uppercase animate-pulse">
										🔥 FIRE DETECTED — 98.4%
									</div>
								)}

								{/* Top-left pill */}
								<div class="absolute top-4 left-4 flex items-center gap-2 bg-[#050B0D]/80 border border-[#8B949E]/10 px-3 py-1.5 rounded-lg text-xs backdrop-blur-sm select-none font-semibold">
									<span class="text-accent font-bold font-mono">{camera.id}</span>
									<span class="text-slate-300 font-medium">{camera.name.includes(camera.id) ? camera.name.replace(camera.id, '').trim() : camera.name}</span>
								</div>

								{/* Top-right pill */}
								{isCritical ? (
									<span class="absolute top-4 right-4 flex items-center gap-1.5 border border-red-500 bg-red-500/5 px-3 py-1 rounded-lg text-xs font-bold text-red-500 backdrop-blur-sm select-none">
										<svg class="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
										Critical
									</span>
								) : (
									<span class="absolute top-4 right-4 flex items-center gap-1.5 border border-emerald-500 bg-emerald-500/5 px-3 py-1 rounded-lg text-xs font-bold text-emerald-500 backdrop-blur-sm select-none">
										<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
										Normal
									</span>
								)}

								{/* Bottom-left overlay info */}
								<div class="absolute bottom-4 left-4 flex items-center gap-2 text-xs font-mono text-slate-400 select-none">
									<span class="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
									<span>{camera.time}</span>
								</div>

								{/* Bottom-right overlay info */}
								<div class="absolute bottom-4 right-4 text-xs font-mono text-slate-500 select-none">
									{camera.resolution} · {camera.fps.replace(' fps', 'fps')}
								</div>
							</div>

							{/* Description & Controls */}
							<div class="flex items-start justify-between mt-4">
								<div class="flex flex-col gap-0.5">
									<span class="text-sm font-semi-bold text-slate-300 group-hover:text-slate-50">{camera.name}</span>
									<span class="text-xs font-mono text-slate-200">Zone: {camera.zone}</span>
								</div>
								<div class="flex items-center gap-3 text-slate-400">
									<button
										type="button"
										class="hover:text-slate-200 transition-colors p-1"
										onClick={() => alert(`Edit config for ${camera.id}`)}
									>
										<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
											<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
										</svg>
									</button>
									<button
										type="button"
										class="hover:text-red-400 transition-colors p-1"
										onClick={() => handleDeleteCamera(camera.id)}
									>
										<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
											<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									</button>
								</div>
							</div>

							<hr class="border-[#8B949E]/10 my-1" />

							{/* Footer Status Meta */}
							<div class="grid grid-cols-2 gap-4 text-xs mt-1 ml-15">
								<div>
									<span class="text-slate-500 font-mono block mb-1">IP Address</span>
									<span class="font-mono text-sm text-slate-200">{camera.ip}</span>
								</div>
								<div>
									<span class="text-slate-500 font-mono block mb-1">Status</span>
									<span class={`flex items-center gap-1.5 font-semibold text-sm ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
										{isCritical ? (
											<>
												<svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
												Critical
											</>
										) : (
											<>
												<svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
													<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
												Online
											</>
										)}
									</span>
								</div>
							</div>
						</article>
					)
				})}

				{/* Add New Camera Dotted Card */}
				<button
					type="button"
					class="flex flex-col items-center justify-center gap-3 bg-accent/5 hover:bg-accent/10 border border-dashed border-accent/30 hover:border-accent/50 rounded-3xl p-8 min-h-[310px] text-center transition-all duration-300"
					onClick={() => onNavigate('/admin/livefeed/add-device')}
				>
					<div class="p-4 bg-[#050B0D] border border-accent/20 rounded-2xl text-accent shadow-md">
						<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<h3 class="text-slate-200 font-bold text-base">Add New Camera</h3>
						<p class="text-slate-500 text-xs mt-1">Configure a new device stream</p>
					</div>
				</button>
			</section>
		</div>
	)
}
