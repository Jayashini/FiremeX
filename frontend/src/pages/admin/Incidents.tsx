import { useState } from 'preact/hooks'


type Incident = {
	timestamp: string
	camera: string
	zone: string
	confidence: number
	status: string
	statusColor: 'red' | 'orange' | 'green'
	action: 'Unresolved' | 'In Progress' | 'Resolved'
	resolveNote?: string
	blockerReason?: string
}

const initialIncidents: Incident[] = [
	{
		timestamp: '2026-06-26 14:42:08',
		camera: 'Cam 07 - Loading Bay',
		zone: 'Warehouse A',
		confidence: 98.4,
		status: 'Fire detected',
		statusColor: 'red',
		action: 'Unresolved'
	},
	{
		timestamp: '2026-06-26 14:31:12',
		camera: 'Cam 07 - Loading Bay',
		zone: 'Warehouse A',
		confidence: 78.4,
		status: 'Smoke detected',
		statusColor: 'orange',
		action: 'In Progress'
	},
	{
		timestamp: '2026-06-26 14:02:05',
		camera: 'Cam 07 - Loading Bay',
		zone: 'Warehouse A',
		confidence: 90.4,
		status: 'Fire detected',
		statusColor: 'red',
		action: 'Unresolved'
	},
	{
		timestamp: '2026-06-26 13:50:00',
		camera: 'Cam 07 - Loading Bay',
		zone: 'Warehouse A',
		confidence: 68.4,
		status: 'Smoke detected',
		statusColor: 'orange',
		action: 'Resolved'
	}
]

export function Incidents() {
	const [incidents, setIncidents] = useState<Incident[]>(initialIncidents)
	const [searchQuery, setSearchQuery] = useState('')
	const [cameraFilter, setCameraFilter] = useState('All')
	const [statusFilter, setStatusFilter] = useState('All')
	const [currentPage, setCurrentPage] = useState(1)

	// Modal States
	const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null)
	const [resolveNote, setResolveNote] = useState('')
	const [unableToResolve, setUnableToResolve] = useState(false)
	const [blockerReason, setBlockerReason] = useState('')

	// Filter logic
	const filteredIncidents = incidents.filter((incident) => {
		const matchesSearch =
			incident.camera.toLowerCase().includes(searchQuery.toLowerCase()) ||
			incident.zone.toLowerCase().includes(searchQuery.toLowerCase())

		const matchesCamera = cameraFilter === 'All' || incident.camera.includes(cameraFilter)
		const matchesStatus =
			statusFilter === 'All' ||
			(statusFilter === 'Unresolved' && incident.action === 'Unresolved') ||
			(statusFilter === 'In Progress' && incident.action === 'In Progress') ||
			(statusFilter === 'Resolved' && incident.action === 'Resolved')

		return matchesSearch && matchesCamera && matchesStatus
	})

	const handleActionChange = (incident: Incident, newAction: Incident['action']) => {
		if (newAction === 'Resolved') {
			setResolvingIncident(incident)
			setResolveNote(incident.resolveNote || '')
			setUnableToResolve(!!incident.blockerReason)
			setBlockerReason(incident.blockerReason || '')
		} else {
			const updated = incidents.map(inc => {
				if (inc.timestamp === incident.timestamp && inc.camera === incident.camera) {
					return {
						...inc,
						action: newAction,
						statusColor: newAction === 'Unresolved' ? 'red' : 'orange',
						resolveNote: undefined,
						blockerReason: undefined
					} as Incident
				}
				return inc
			})
			setIncidents(updated)
		}
	}

	const handleConfirmResolve = (e: any) => {
		e.preventDefault()
		if (!resolvingIncident) return

		const updated = incidents.map(inc => {
			if (inc.timestamp === resolvingIncident.timestamp && inc.camera === resolvingIncident.camera) {
				return {
					...inc,
					action: 'Resolved',
					statusColor: 'green',
					resolveNote: resolveNote,
					blockerReason: undefined
				} as Incident
			}
			return inc
		})
		setIncidents(updated)
		setResolvingIncident(null)
	}

	const handleSaveBlocker = (e: any) => {
		e.preventDefault()
		if (!resolvingIncident) return

		const updated = incidents.map(inc => {
			if (inc.timestamp === resolvingIncident.timestamp && inc.camera === resolvingIncident.camera) {
				return {
					...inc,
					action: 'Unresolved',
					statusColor: 'red',
					resolveNote: undefined,
					blockerReason: blockerReason
				} as Incident
			}
			return inc
		})
		setIncidents(updated)
		setResolvingIncident(null)
	}

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
				<div>
					<h1 class="text-2xl font-bold text-slate-100">Incidents</h1>
					<p class="text-sm text-[#8B949E] mt-1">Detection history & review log</p>
				</div>

				{/* Dropdown Filters */}
				<div class="flex flex-wrap items-center gap-3">
					{/* Camera Selector */}
					<div class="relative">
						<select
							value={cameraFilter}
							onChange={(e) => setCameraFilter((e.target as HTMLSelectElement).value)}
							class="appearance-none bg-brand-surface border border-brand-border hover:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
						>
							<option value="All">All cameras</option>
							<option value="Cam 07">Cam 07</option>
							<option value="Cam 03">Cam 03</option>
							<option value="Cam 11">Cam 11</option>
						</select>
						<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 3v18M15 3v18M3 9h18M3 15h18" />
							</svg>
						</span>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
						</span>
					</div>

					{/* Time filter */}
					<div class="relative">
						<select class="appearance-none bg-brand-surface border border-brand-border hover:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer">
							<option>Last 7 days</option>
							<option>Today</option>
							<option>Last 30 days</option>
						</select>
						<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
							</svg>
						</span>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
						</span>
					</div>

					{/* Status Filter */}
					<div class="relative">
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}
							class="appearance-none bg-brand-surface border border-brand-border hover:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
						>
							<option value="All">All statuses</option>
							<option value="Unresolved">Unresolved</option>
							<option value="In Progress">In Progress</option>
							<option value="Resolved">Resolved</option>
						</select>
						<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
							</svg>
						</span>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
						</span>
					</div>
				</div>
			</header>

			{/* Search input bar */}
			<div class="relative w-full max-w-md mt-3 m-4 mx-90">
				<input
					type="text"
					placeholder="Search cameras or zones..."
					value={searchQuery}
					onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
					class="w-full bg-brand-surface border border-brand-border focus:border-accent rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all"
				/>
				<span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
					<svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</span>
			</div>

			{/* Incidents Table Panel */}
			<section class="bg-brand-surface m-6 mt-0 border border-brand-border rounded-3xl p-6 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="border-b border-brand-border text-xs text-slate-500 font-semibold uppercase tracking-wider">
								<th class="pb-3 pt-1 px-4 font-semibold text-accent">Timestamp</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Camera</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Zone</th>
								<th class="pb-3 pt-1 px-4 font-semibold text-accent">AI Conf.</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Status</th>
								<th class="pb-3 pt-1 px-4 font-semibold">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-brand-border/40 text-sm">
							{filteredIncidents.length > 0 ? (
								filteredIncidents.map((incident, idx) => (
									<tr key={idx} class="hover:bg-slate-800/10 transition-colors">
										<td class="py-4 px-4 font-mono text-slate-400">{incident.timestamp}</td>
										<td class="py-4 px-4 text-slate-200 font-semibold">{incident.camera}</td>
										<td class="py-4 px-4 text-slate-400">{incident.zone}</td>
										<td class="py-4 px-4">
											{/* Confidence percentage and custom progress bar */}
											<div class="flex flex-col gap-1.5 w-32">
												<span class="font-mono text-xs text-slate-400 font-semibold">{incident.confidence}%</span>
												<div class="w-full h-1.5 bg-[#050B0D] rounded-full overflow-hidden border border-slate-900">
													<div
														class="h-full bg-accent rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)] transition-all duration-500"
														style={{ width: `${incident.confidence}%` }}
													/>
												</div>
											</div>
										</td>
										<td class="py-4 px-4">
											{incident.statusColor === 'red' ? (
												<span class="text-red-500 font-bold tracking-wide">
													{incident.status}
												</span>
											) : incident.statusColor === 'orange' ? (
												<span class="text-amber-500 font-bold tracking-wide">
													{incident.status}
												</span>
											) : (
												<span class="text-emerald-400 font-bold tracking-wide">
													{incident.status}
												</span>
											)}
											{incident.resolveNote && (
												<span class="block text-[11px] text-slate-400 mt-1 font-sans">
													Note: {incident.resolveNote}
												</span>
											)}
											{incident.blockerReason && (
												<span class="block text-[11px] text-red-400 mt-1 font-sans">
													Blocked: {incident.blockerReason}
												</span>
											)}
										</td>
										<td class="py-4 px-4">
											{/* Actions dropdown box */}
											<div class="relative inline-block text-left">
												<select
													value={incident.action}
													onChange={(e) => handleActionChange(incident, (e.target as HTMLSelectElement).value as Incident['action'])}
													class={`appearance-none font-bold text-xs pl-3.5 pr-8 py-2 rounded-xl focus:outline-none cursor-pointer border transition-all ${incident.action === 'Unresolved'
														? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20'
														: incident.action === 'In Progress'
															? 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20'
															: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
														}`}
												>
													<option value="Unresolved" class="bg-brand-surface text-slate-300">Unresolved</option>
													<option value="In Progress" class="bg-brand-surface text-slate-300">In Progress</option>
													<option value="Resolved" class="bg-brand-surface text-slate-300">Resolved</option>
												</select>
												{/* Down icon custom wrapper */}
												<span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
													<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
												</span>
											</div>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colspan={6} class="py-8 text-center text-slate-500 font-medium">
										No incidents match your current search criteria.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-brand-border/40 text-xs">
					<span class="text-slate-500 font-medium">
						Showing 1-{filteredIncidents.length} of 96 incidents
					</span>

					<div class="flex items-center gap-1.5 self-end sm:self-auto font-semibold">
						{/* Previous */}
						<button
							type="button"
							class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-surface border border-brand-border text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
							disabled
						>
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
						</button>

						{/* Number indicators */}
						<button
							type="button"
							class={`w-8 h-8 rounded-lg font-mono text-center flex items-center justify-center border transition-all ${currentPage === 1
								? 'bg-accent/10 border-accent/20 text-accent font-bold shadow-[0_0_8px_rgba(20,184,166,0.1)]'
								: 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
								}`}
							onClick={() => setCurrentPage(1)}
						>
							1
						</button>
						<button
							type="button"
							class={`w-8 h-8 rounded-lg font-mono text-center flex items-center justify-center border transition-all ${currentPage === 2
								? 'bg-accent/10 border-accent/20 text-accent font-bold'
								: 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
								}`}
							onClick={() => setCurrentPage(2)}
						>
							2
						</button>
						<button
							type="button"
							class={`w-8 h-8 rounded-lg font-mono text-center flex items-center justify-center border transition-all ${currentPage === 3
								? 'bg-accent/10 border-accent/20 text-accent font-bold'
								: 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
								}`}
							onClick={() => setCurrentPage(3)}
						>
							3
						</button>

						<span class="text-slate-600 px-1.5 font-mono select-none">..</span>

						<button
							type="button"
							class="w-8 h-8 rounded-lg font-mono text-center flex items-center justify-center bg-transparent border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20 transition-all"
							onClick={() => setCurrentPage(15)}
						>
							15
						</button>

						{/* Next */}
						<button
							type="button"
							class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-surface border border-brand-border text-slate-400 hover:text-slate-200 transition-colors"
							onClick={() => setCurrentPage(2)}
						>
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
						</button>
					</div>
				</div>
			</section>

			{/* Resolution Modal */}
			{resolvingIncident && (
				<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
					<div class="w-full max-w-lg bg-[#0B1315]/95 border border-[#8B949E]/10 rounded-3xl p-6 shadow-2xl">
						<h2 class="text-xl font-bold text-slate-100 mb-2">Resolve Incident</h2>
						<p class="text-xs text-slate-400 mb-6">Update the resolution status for <span class="font-mono text-accent">{resolvingIncident.camera}</span> ({resolvingIncident.timestamp})</p>

						<div class="flex flex-col gap-4">
							{/* Checkbox: Unable to resolve */}
							<label class="flex items-start gap-3 cursor-pointer group">
								<input
									type="checkbox"
									checked={unableToResolve}
									onChange={(e: any) => setUnableToResolve(e.target.checked)}
									class="mt-1 w-4 h-4 bg-[#050B0D] rounded border-[#8B949E]/20 text-accent focus:ring-accent focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
								/>
								<div class="flex flex-col select-none">
									<span class="text-sm font-semibold text-slate-200 group-hover:text-slate-100">Unable to resolve this incident</span>
									<span class="text-xs text-slate-500 mt-0.5">Check this if there is a reason preventing resolution</span>
								</div>
							</label>

							{unableToResolve ? (
								/* blockerReason textarea */
								<div class="flex flex-col gap-2">
									<label class="text-xs font-mono text-slate-400">Reason for being unable to resolve</label>
									<textarea
										required
										placeholder="Explain why this incident cannot be resolved..."
										value={blockerReason}
										onInput={(e: any) => setBlockerReason(e.target.value)}
										class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-red-500 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors h-24 resize-none"
									/>
									<span class="text-xs text-red-400 font-semibold mt-1">⚠️ Notice: The status will not be updated to Resolved.</span>
								</div>
							) : (
								/* resolveNote textarea */
								<div class="flex flex-col gap-2">
									<label class="text-xs font-mono text-slate-400">Resolve Note</label>
									<textarea
										required
										placeholder="Describe how this incident was resolved..."
										value={resolveNote}
										onInput={(e: any) => setResolveNote(e.target.value)}
										class="w-full bg-[#050B0D] border border-[#8B949E]/20 focus:border-accent text-slate-200 rounded-xl px-4 py-3 text-sm outline-none transition-colors h-24 resize-none"
									/>
								</div>
							)}
						</div>

						{/* Footer buttons */}
						<div class="flex items-center justify-between mt-8 border-t border-[#8B949E]/10 pt-4">
							<button
								type="button"
								onClick={() => setResolvingIncident(null)}
								class="text-sm font-mono text-slate-400 hover:text-slate-200 transition-colors"
							>
								Cancel
							</button>

							{unableToResolve ? (
								<button
									type="button"
									onClick={handleSaveBlocker}
									disabled={!blockerReason}
									class={`flex items-center gap-2 bg-red-600/10 border border-red-500/30 hover:border-red-500 text-red-400 font-mono font-bold text-xs px-5 py-2.5 rounded-xl transition-all ${!blockerReason ? 'opacity-50 cursor-not-allowed' : ''
										}`}
								>
									Save Note
								</button>
							) : (
								<button
									type="button"
									onClick={handleConfirmResolve}
									disabled={!resolveNote}
									class={`flex items-center gap-2 bg-accent hover:bg-accent/90 text-brand-bg font-mono font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-accent/20 ${!resolveNote ? 'opacity-50 cursor-not-allowed' : ''
										}`}
								>
									Mark as Resolved
								</button>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
