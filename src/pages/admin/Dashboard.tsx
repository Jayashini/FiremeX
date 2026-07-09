import { useEffect, useState } from 'preact/hooks'

type Props = {
	onNavigate: (path: string) => void
}

const recentIncidents = [
	{ time: '14:42:08', camera: 'Cam 07 - Loading Bay', zone: 'Warehouse A', confidence: '98.4%', status: 'Fire detected', statusColor: 'red' },
	{ time: '14:31:12', camera: 'Cam 03 - East Corridor', zone: 'Block B', confidence: '87.1%', status: 'Smoke detected', statusColor: 'orange' },
	{ time: '13:58:02', camera: 'Cam 11 - Rooftop North', zone: 'Exterior', confidence: '90.6%', status: 'Resolved', statusColor: 'green' },
	{ time: '13:38:44', camera: 'Cam 09 - Parking L2', zone: 'Garage', confidence: '-', status: 'Camera offline', statusColor: 'gray' },
	{ time: '12:47:19', camera: 'Cam 02 - Server Room', zone: 'Block A', confidence: '94.2%', status: 'Resolved', statusColor: 'green' }
]

export function Dashboard({ onNavigate }: Props) {
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

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-6">
				<div>
					<h1 class="text-2xl font-bold text-slate-100">Dashboard</h1>
					<p class="text-sm text-accent mt-1">Real-time situation overview</p>
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

			{/* Stats Grid */}
			<section class="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 p-t-3">
				{/* Stats Card 1 */}
				<div
					class="bg-brand-surface border border-brand-border rounded-3xl p-6 flex justify-between items-start cursor-pointer hover:border-slate-800 transition-colors"
					onClick={() => onNavigate('/admin/livefeed')}
				>
					<div class="flex flex-col gap-1">
						<span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cameras Online</span>
						<span class="text-3xl font-extrabold text-slate-100 mt-2">11<span class="text-lg text-slate-500 font-normal"> / 12</span></span>
						<span class="flex items-center gap-1.5 text-xs text-red-400 mt-4">
							<span class="w-1.5 h-1.5 rounded-full bg-red-400" />
							1 camera offline — Cam 08
						</span>
					</div>
					<div class="p-3 bg-[#050B0D] border border-brand-border rounded-xl text-accent">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v18M15 3v18M3 9h18M3 15h18" />
						</svg>
					</div>
				</div>

				{/* Stats Card 2 */}
				<div
					class="bg-brand-surface border border-brand-border rounded-3xl p-6 flex justify-between items-start cursor-pointer hover:border-slate-800 transition-colors"
					onClick={() => onNavigate('/admin/incidents')}
				>
					<div class="flex flex-col gap-1">
						<span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Risk Level</span>
						<div class="mt-2">
							<span class="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-xl text-amber-500 font-bold text-sm">
								▲ Elevated
							</span>
						</div>
						<span class="text-xs text-slate-400 mt-4 leading-none">
							2 zones affected — since 14:32
						</span>
					</div>
					<div class="p-3 bg-[#050B0D] border border-brand-border rounded-xl text-accent">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
				</div>

				{/* Stats Card 3 */}
				<div
					class="bg-brand-surface border border-brand-border rounded-3xl p-6 flex justify-between items-start cursor-pointer hover:border-slate-800 transition-colors"
					onClick={() => onNavigate('/admin/alerts')}
				>
					<div class="flex flex-col gap-1">
						<span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Alerts</span>
						<span class="text-3xl font-extrabold text-slate-100 mt-2">3</span>
						<span class="flex items-center gap-1.5 text-xs text-red-400 mt-4">
							<span class="w-1.5 h-1.5 rounded-full bg-red-400" />
							2 unacknowledged
						</span>
					</div>
					<div class="p-3 bg-[#050B0D] border border-brand-border rounded-xl text-accent">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
						</svg>
					</div>
				</div>
			</section>

			{/* Recent Incidents Panel */}
			<section class="bg-brand-surface border border-brand-border rounded-3xl p-6 mt-0 m-6">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-bold text-slate-100">Recent Incidents</h2>
						<span class="text-xs text-slate-500">Last 5 events</span>
					</div>
					<button
						type="button"
						class="text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
						onClick={() => onNavigate('/admin/incidents')}
					>
						View all
					</button>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="border-b border-brand-border text-xs text-slate-500 font-semibold uppercase tracking-wider">
								<th class="pb-3 pt-1 px-4 font-semibold">Time</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Camera</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Zone</th>
								<th class="pb-3 pt-1 px-4 font-semibold">AI Conf.</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Status</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-brand-border/40 text-sm">
							{recentIncidents.map((incident, idx) => (
								<tr key={idx} class="hover:bg-slate-800/10 transition-colors">
									<td class="py-3 px-4 font-mono text-slate-400">{incident.time}</td>
									<td class="py-3 px-4 text-slate-200 font-medium">{incident.camera}</td>
									<td class="py-3 px-4 text-slate-400">{incident.zone}</td>
									<td class="py-3 px-4 font-mono text-slate-400">{incident.confidence}</td>
									<td class="py-3 px-4">
										{incident.statusColor === 'red' && (
											<span class="inline-flex items-center gap-1.5 border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 rounded-full text-xs font-semibold text-red-400">
												<span class="w-1 h-1 rounded-full bg-red-400 animate-pulse" />
												{incident.status}
											</span>
										)}
										{incident.statusColor === 'orange' && (
											<span class="inline-flex items-center gap-1.5 border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-500">
												{incident.status}
											</span>
										)}
										{incident.statusColor === 'green' && (
											<span class="inline-flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-400">
												{incident.status}
											</span>
										)}
										{incident.statusColor === 'gray' && (
											<span class="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-800/20 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-400">
												{incident.status}
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Recent Alert Camera Preview Panel */}
			<section class="bg-brand-surface border border-brand-border rounded-3xl p-6 m-6">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
					<div class="flex flex-wrap items-center gap-3">
						<h2 class="text-lg font-bold text-slate-100">Recent Alert Camera Preview</h2>
						<div class="flex items-center gap-2 text-xs bg-[#050B0D] px-3 py-1.5 rounded-xl border border-brand-border">
							<span class="text-slate-500">Camera:</span>
							<span class="font-semibold text-slate-300">Cam 07</span>
							<span class="text-slate-600">|</span>
							<span class="text-slate-500">Zone:</span>
							<span class="font-semibold text-slate-300">Warehouse A</span>
							<span class="text-slate-600">|</span>
							<span class="text-slate-500">Status:</span>
							<span class="font-semibold text-red-400">Fire detected</span>
						</div>
					</div>
					<button
						type="button"
						class="text-sm font-semibold text-accent hover:text-accent-hover self-end sm:self-auto transition-colors"
						onClick={() => onNavigate('/admin/livefeed')}
					>
						View all
					</button>
				</div>

				{/* Video Container Frame */}
				<div class="relative w-full aspect-video rounded-2xl overflow-hidden border border-brand-border bg-slate-900 group">
					{/* CCTV Stream Background */}
					<img
						src="/warehouse_fire.png"
						alt="Warehouse safety event feed"
						class="w-full h-full object-cover select-none"
					/>

					{/* Feed Overlays */}
					{/* Live & Rec Badges */}
					<div class="absolute top-4 left-4 flex gap-2">
						<span class="flex items-center gap-1.5 bg-red-600 px-3 py-1 rounded-lg text-white font-bold text-xs shadow-md tracking-wider">
							<span class="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
							LIVE
						</span>
						<span class="flex items-center gap-1.5 bg-[#050B0D]/75 backdrop-blur-sm border border-slate-700 px-3 py-1 rounded-lg text-slate-300 font-bold text-xs tracking-wider">
							REC
						</span>
					</div>

					{/* Watermark Timestamp */}
					<div class="absolute top-4 right-4 bg-[#050B0D]/70 backdrop-blur-sm px-3.5 py-1 rounded-lg text-slate-300 font-mono text-xs shadow-md">
						2026-10-25 01:34:57 AM
					</div>

					{/* Interactive HTML Bounding Box Overlay for Safety Incident */}
					{/* Based on the generated fire coordinates on the lower middle area */}
					<div
						class="absolute bottom-[20%] left-[38%] w-[22%] h-[45%] border-2 border-red-500 bg-red-500/10 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-[pulse_1.5s_ease-in-out_infinite]"
						style={{ animationDelay: '0.2s' }}
					>
						{/* Floating label tag */}
						<div class="absolute -top-6 -left-0.5 bg-red-600 text-white font-bold font-mono text-[10px] px-2 py-0.5 rounded shadow">
							FIRE - 0.94
						</div>
					</div>

					{/* Ambient Alert Glow Overlay */}
					<div class="absolute inset-0 border border-red-500/20 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(239,68,68,0.15)] animate-pulse" />
				</div>
			</section>
		</div>
	)
}
