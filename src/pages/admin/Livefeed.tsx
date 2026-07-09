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
	const [cameras, setCameras] = useState(initialCameras)
	const [layout, setLayout] = useState<'2x2' | '1x2'>('2x2')
	const [timeStr, setTimeStr] = useState('')

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

	const handleAddCamera = () => {
		const newId = `CAM-0${cameras.length + 1}`
		const newCam = {
			id: newId,
			name: `${newId} Perimeter West`,
			zone: 'Block D',
			status: 'Normal',
			ip: `192.168.1.10${cameras.length + 1}`,
			fps: '25 fps',
			resolution: '1080p',
			time: '06-26 14:42:08'
		}
		setCameras([...cameras, newCam])
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-brand-surface border border-brand-border rounded-3xl p-6">
				<div>
					<h1 class="text-2xl font-bold text-slate-100">Live Feed</h1>
					<p class="text-sm text-accent mt-1">{cameras.length} cameras streaming | 1 critical detection</p>
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
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
							class={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
								layout === '2x2'
									? 'bg-slate-200 text-brand-bg shadow'
									: 'text-slate-400 hover:text-slate-200'
							}`}
							onClick={() => setLayout('2x2')}
						>
							2 × 2
						</button>
						<button
							type="button"
							class={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
								layout === '1x2'
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
						class="flex items-center gap-2 bg-accent hover:bg-accent-hover text-brand-bg font-bold text-xs px-4 py-3 rounded-xl transition-all shadow-md shadow-accent/10"
						onClick={handleAddCamera}
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
				class={`grid gap-6 transition-all duration-300 ${
					layout === '2x2'
						? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
						: 'grid-cols-1 md:grid-cols-2'
				}`}
			>
				{cameras.map((camera) => {
					const isCritical = camera.status === 'Critical'
					return (
						<article
							key={camera.id}
							class={`flex flex-col gap-4 bg-brand-surface border rounded-3xl p-5 transition-all ${
								isCritical
									? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse-ring'
									: 'border-brand-border hover:border-slate-800'
							}`}
						>
							{/* Card Title Line */}
							<div class="flex items-center justify-between">
								<span class="text-xs font-semibold text-slate-300 font-mono tracking-wide">{camera.id}</span>
								{isCritical ? (
									<span class="inline-flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
										<span class="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
										Critical
									</span>
								) : (
									<span class="inline-flex items-center gap-1 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
										Normal
									</span>
								)}
							</div>

							{/* Video Frame Preview */}
							<div class="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#050B0D] border border-brand-border flex items-center justify-center group">
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
									<div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-red-600 border border-red-500 px-3 py-1.5 rounded-xl text-white text-[10px] font-bold tracking-wider shadow-lg uppercase animate-pulse">
										🔥 FIRE DETECTED — 98.4%
									</div>
								)}

								{/* Bottom-left overlay info */}
								<div class="absolute bottom-3 left-4 text-[10px] font-mono text-slate-500 bg-[#050B0D]/50 px-2 py-0.5 rounded backdrop-blur-sm select-none">
									{camera.time}
								</div>

								{/* Bottom-right overlay info */}
								<div class="absolute bottom-3 right-4 text-[10px] font-mono text-slate-500 bg-[#050B0D]/50 px-2 py-0.5 rounded backdrop-blur-sm select-none">
									{camera.resolution} | {camera.fps}
								</div>
							</div>

							{/* Description & Controls */}
							<div class="flex items-center justify-between mt-1">
								<div class="flex flex-col">
									<span class="text-sm font-bold text-slate-200 group-hover:text-slate-100">{camera.name}</span>
									<span class="text-xs text-slate-500 mt-1">Zone: {camera.zone}</span>
								</div>
								<button
									type="button"
									class="p-2 bg-[#050B0D] hover:bg-slate-800/50 border border-brand-border hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
									onClick={() => alert(`Edit config for ${camera.id}`)}
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</button>
							</div>

							{/* Footer Status Meta */}
							<div class="flex items-center justify-between pt-4 border-t border-brand-border/40 text-xs text-slate-500 mt-1">
								<div class="flex items-center gap-1.5">
									<span class="text-slate-600">IP Address:</span>
									<span class="font-mono text-slate-400">{camera.ip}</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="text-slate-600">Status:</span>
									<span class={`flex items-center gap-1.5 font-semibold ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
										<span class={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`} />
										{isCritical ? 'Critical' : 'Online'}
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
					onClick={handleAddCamera}
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
