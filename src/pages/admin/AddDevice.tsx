import { useState } from 'preact/hooks'

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

export function AddDevice({ onNavigate }: Props) {
	const [newCamName, setNewCamName] = useState('')
	const [newCamIp, setNewCamIp] = useState('')
	const [newCamZone, setNewCamZone] = useState('Main Entrance')
	const [newCamResolution, setNewCamResolution] = useState('1080p (Full HD)')
	const [newCamFps, setNewCamFps] = useState('30 FPS')
	const [newCamAi, setNewCamAi] = useState(false)

	const handleSubmitCamera = (e: any) => {
		e.preventDefault()
		if (!newCamName) return

		// Load current cameras to generate next ID and append
		const saved = localStorage.getItem('firemex_cameras')
		const currentCameras = saved ? JSON.parse(saved) : initialCameras

		// Generate dynamic next ID
		const maxIdNum = currentCameras.reduce((max: number, cam: any) => {
			const num = parseInt(cam.id.replace('CAM-', ''), 10)
			return num > max ? num : max
		}, 0)
		const nextId = `CAM-${String(maxIdNum + 1).padStart(2, '0')}`

		const newCam = {
			id: nextId,
			name: `${nextId} ${newCamName}`,
			zone: newCamZone,
			status: 'Normal',
			ip: newCamIp || '192.168.1.101',
			fps: newCamFps.toLowerCase(),
			resolution: newCamResolution.split(' ')[0].toLowerCase(), // get 1080p
			time: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace(/\//g, '-') + ' ' + new Date().toLocaleTimeString('en-US', { hour12: false })
		}

		const updated = [...currentCameras, newCam]
		localStorage.setItem('firemex_cameras', JSON.stringify(updated))
		onNavigate('/admin/livefeed')
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
				<div>
					<h1 class="text-2xl font-bold text-slate-100 tracking-tight">Devices Configuration</h1>
					<p class="text-sm text-[#8B949E] mt-1">Manage active network streams & devices</p>
				</div>
			</header>

			<div class="flex items-center justify-center w-full px-6 py-4">
				<form onSubmit={handleSubmitCamera} class="w-full max-w-5xl bg-[#0B1315]/80 border border-[#8B949E]/10 rounded-3xl p-8 shadow-xl">
					{/* Header */}
					<div class="flex items-start justify-between mb-8">
						<div>
							<h1 class="text-[20px] font-semi-bold text-slate-300">Add New Device</h1>
							<p class="text-sm text-[#8B949E] mt-1 mb-5">Configure a new camera stream for the secure network.</p>
						</div>
						<div class="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
							<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</div>
					</div>

					{/* Grid Fields */}
					<div class="grid w-full grid-cols-1 md:grid-cols-3 gap-6 mb-6">
						{/* Camera Name */}
						<div class="flex flex-col gap-3">
							<label class="text-xs font-mono text-slate-400">Camera Name</label>
							<input
								type="text"
								required
								placeholder="e.g. Perimeter North-West"
								value={newCamName}
								onChange={(e: any) => setNewCamName(e.target.value)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
							/>
						</div>

						{/* IP Address */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">IP Address / URL</label>
							<div class="relative w-full">
								<input
									type="text"
									required
									placeholder="192.168.1.105"
									value={newCamIp}
									onChange={(e: any) => setNewCamIp(e.target.value)}
									class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm outline-none transition-colors font-mono"
								/>
								<svg class="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
								</svg>
							</div>
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

						{/* Resolution */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">Resolution</label>
							<select
								value={newCamResolution}
								onChange={(e: any) => setNewCamResolution(e.target.value)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors appearance-none cursor-pointer"
							>
								<option value="1080p (Full HD)">1080p (Full HD)</option>
								<option value="720p (HD)">720p (HD)</option>
								<option value="4K (Ultra HD)">4K (Ultra HD)</option>
							</select>
						</div>

						{/* Frame Rate */}
						<div class="flex flex-col gap-2">
							<label class="text-xs font-mono text-slate-400">Frame Rate</label>
							<select
								value={newCamFps}
								onChange={(e: any) => setNewCamFps(e.target.value)}
								class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors appearance-none cursor-pointer"
							>
								<option value="30 FPS">30 FPS</option>
								<option value="25 FPS">25 FPS</option>
								<option value="20 FPS">20 FPS</option>
								<option value="15 FPS">15 FPS</option>
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
							<span class="text-xs font-mono text-slate-400 select-none">Enable AI Tracking</span>
						</div>
					</div>

					{/* Test Connection Preview Block */}
					<div class="border border-[#8B949E]/10 rounded-2xl p-5 mb-8 bg-[#050B0D]/50 flex flex-col items-center justify-center gap-4">
						<div class="w-full aspect-video rounded-xl bg-[#050B0D] border border-[#8B949E]/10 flex flex-col items-center justify-center gap-3 text-slate-500">
							<svg class="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
							</svg>
							<span class="text-xs font-mono tracking-wider">NO ACTIVE STREAM SELECTED</span>
						</div>
						<button
							type="button"
							onClick={() => alert('Testing stream connection... Successful.')}
							class="flex items-center gap-2 border border-accent/40 bg-accent/5 hover:bg-accent/10 text-accent font-mono text-xs px-4 py-2.5 rounded-xl transition-all"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9 9 0 0112.16 0M1.93 7.93a13 13 0 0118.14 0" />
							</svg>
							Test Connection
						</button>
					</div>

					{/* Action Buttons */}
					<div class="flex items-center justify-between">
						<button
							type="button"
							onClick={() => onNavigate('/admin/livefeed')}
							class="text-sm font-mono text-slate-400 hover:text-slate-200 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="flex items-center gap-2 bg-accent/100 hover:bg-accent/90 text-brand-bg font-mono font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md shadow-accent/20"
						>
							<span>Add Camera</span>
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
