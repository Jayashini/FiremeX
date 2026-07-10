import { useState } from 'preact/hooks'

type AlertNotification = {
	id: string
	date: string
	time: string
	incident: string
	incidentCode: string
	camera: string
	recipient: string
	channel: string
	acknowledged: 'Yes' | 'No'
	indicatorColor: 'teal' | 'yellow' | 'red'
}

const initialAlerts: AlertNotification[] = [
	{
		id: '1',
		date: '01 Jul 2026',
		time: '10:05 AM',
		incident: 'Smoke Detected',
		incidentCode: 'INC-4821',
		camera: 'Kitchen Cam 01',
		recipient: 'John Silva',
		channel: 'SMS/Push',
		acknowledged: 'Yes',
		indicatorColor: 'teal'
	},
	{
		id: '2',
		date: '28 Jun 2026',
		time: '09:35 PM',
		incident: 'Flame Detected',
		incidentCode: 'INC-4820',
		camera: 'Server Room 03',
		recipient: 'Maria Cruz',
		channel: 'Push',
		acknowledged: 'No',
		indicatorColor: 'yellow'
	},
	{
		id: '3',
		date: '13 Jun 2026',
		time: '11:42 AM',
		incident: 'Heavy smoke detected',
		incidentCode: 'INC-4819',
		camera: 'Warehouse Cam 02',
		recipient: 'Emergency Team',
		channel: 'SMS/alarm',
		acknowledged: 'Yes',
		indicatorColor: 'teal'
	},
	{
		id: '4',
		date: '09 Jun 2026',
		time: '10:11 PM',
		incident: 'Possible fire risk',
		incidentCode: 'INC-4818',
		camera: 'Storage Cam 04',
		recipient: 'Security Team',
		channel: 'Push/alarm',
		acknowledged: 'No',
		indicatorColor: 'teal'
	},
	{
		id: '5',
		date: '02 Jun 2026',
		time: '08:02 AM',
		incident: 'Vapour cloud detected',
		incidentCode: 'INC-4817',
		camera: 'Chemical Storage Cam 01',
		recipient: 'Safety Office',
		channel: 'Push/alarm',
		acknowledged: 'Yes',
		indicatorColor: 'teal'
	}
]

export function Alerts() {
	const [alerts, setAlerts] = useState<AlertNotification[]>(initialAlerts)
	const [timeFilter, setTimeFilter] = useState('Last 7 Days')
	const [channelFilter, setChannelFilter] = useState('All channels')
	const [currentPage, setCurrentPage] = useState(1)

	const toggleAck = (id: string, state: 'Yes' | 'No') => {
		setAlerts(
			alerts.map((alert) => (alert.id === id ? { ...alert, acknowledged: state } : alert))
		)
	}

	const filteredAlerts = alerts.filter((alert) => {
		if (channelFilter === 'All channels') return true
		return alert.channel.toLowerCase().includes(channelFilter.toLowerCase())
	})

	return (
		<div class="flex flex-col gap-6 w-full pb-8">
			{/* Page Header */}
			<header class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 bg-brand-surface border-b border-[#8B949E]/10 p-4 pl-10">
				<div>
					<h1 class="text-2xl font-bold text-slate-100">Alert History</h1>
					<p class="text-sm text-[#8B949E] mt-1">Notification dispatch & acknowledgement audit</p>
				</div>

				{/* Header Actions */}
				<div class="flex flex-wrap items-center gap-3">
					{/* Date Range Selector */}
					<div class="relative">
						<select
							value={timeFilter}
							onChange={(e) => setTimeFilter((e.target as HTMLSelectElement).value)}
							class="appearance-none bg-brand-surface border border-brand-border hover:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
						>
							<option>Last 7 Days</option>
							<option>Last 30 Days</option>
							<option>Last 6 Months</option>
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

					{/* Channel Filter Selector */}
					<div class="relative">
						<select
							value={channelFilter}
							onChange={(e) => setChannelFilter((e.target as HTMLSelectElement).value)}
							class="appearance-none bg-brand-surface border border-brand-border hover:border-slate-800 rounded-xl pl-9 pr-8 py-3 text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
						>
							<option value="All channels">All channels</option>
							<option value="SMS">SMS</option>
							<option value="Push">Push</option>
							<option value="alarm">Alarms</option>
						</select>
						<span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
							</svg>
						</span>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
							<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
						</span>
					</div>
				</div>
			</header>

			{/* Stats Overview Grid */}
			<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-0 m-6">
				{/* Stat Card 1 */}
				<div class="bg-brand-surface border border-brand-border rounded-3xl p-5 flex items-center gap-4">
					<div class="flex items-center justify-center w-12 h-12 bg-teal-500/10 text-teal-400 rounded-full border border-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.05)]">
						<svg class="w-5 h-5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
						</svg>
					</div>
					<div class="flex flex-col leading-none">
						<span class="text-2xl font-extrabold text-slate-100">128</span>
						<span class="text-xs text-slate-500 mt-2 font-medium">Alerts sent</span>
					</div>
				</div>

				{/* Stat Card 2 */}
				<div class="bg-brand-surface border border-brand-border rounded-3xl p-5 flex items-center gap-4">
					<div class="flex items-center justify-center w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="flex flex-col leading-none">
						<span class="text-2xl font-extrabold text-slate-100">112</span>
						<span class="text-xs text-slate-500 mt-2 font-medium">Acknowledged</span>
					</div>
				</div>

				{/* Stat Card 3 */}
				<div class="bg-brand-surface border border-brand-border rounded-3xl p-5 flex items-center gap-4">
					<div class="flex items-center justify-center w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.05)]">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="flex flex-col leading-none">
						<span class="text-2xl font-extrabold text-slate-100">14</span>
						<span class="text-xs text-slate-500 mt-2 font-medium">Awaiting ack</span>
					</div>
				</div>

				{/* Stat Card 4 */}
				<div class="bg-brand-surface border border-brand-border rounded-3xl p-5 flex items-center gap-4">
					<div class="flex items-center justify-center w-12 h-12 bg-red-500/10 text-red-400 rounded-full border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.05)]">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
						</svg>
					</div>
					<div class="flex flex-col leading-none">
						<span class="text-2xl font-extrabold text-slate-100">2</span>
						<span class="text-xs text-slate-500 mt-2 font-medium">Delivery failed</span>
					</div>
				</div>
			</section>

			{/* Notifications Panel */}
			<section class="bg-brand-surface mt-0 m-6 border border-brand-border rounded-3xl p-6 overflow-hidden">
				<div class="flex flex-col gap-1 mb-6">
					<div class="flex items-center gap-2 text-slate-100 font-bold">
						<span class="text-accent">
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</span>
						<h2 class="text-lg">Dispatched Notifications</h2>
					</div>
					<p class="text-xs text-slate-500">Each alert is triggered by a linked incident and sent to assigned personnel</p>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left border-collapse">
						<thead>
							<tr class="border-b border-brand-border text-xs text-accent font-bold uppercase tracking-wider">
								<th class="pb-3 pt-1 px-4 font-bold">Timestamp</th>
								<th class="pb-3 pt-1 px-4 font-bold">Incident</th>
								<th class="pb-3 pt-1 px-4 font-bold">Camera</th>
								<th class="pb-3 pt-1 px-4 font-bold">Recipient</th>
								<th class="pb-3 pt-1 px-4 font-bold">Channel</th>
								<th class="pb-3 pt-1 px-4 font-bold text-center">Acknowledged</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-brand-border/40 text-sm">
							{filteredAlerts.map((alert) => (
								<tr key={alert.id} class="hover:bg-slate-800/10 transition-colors group">
									{/* Timestamp column with custom colored indicator bar */}
									<td class="py-4 px-4 font-mono text-slate-400">
										<div class="flex items-center gap-3">
											<span
												class={`w-1 h-8 rounded-full shrink-0 ${alert.indicatorColor === 'teal'
													? 'bg-accent shadow-[0_0_8px_rgba(20,184,166,0.4)]'
													: alert.indicatorColor === 'yellow'
														? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
														: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
													}`}
											/>
											<div class="flex flex-col leading-tight">
												<span class="text-slate-200 font-medium">{alert.date}</span>
												<span class="text-[10px] text-slate-500 mt-0.5">{alert.time}</span>
											</div>
										</div>
									</td>

									{/* Incident Description and Link Tag */}
									<td class="py-4 px-4">
										<div class="flex items-center gap-2">
											<span class="text-slate-200 font-bold tracking-tight">{alert.incident}</span>
											<span class="inline-flex items-center gap-1 bg-accent/5 border border-accent/20 px-2 py-0.5 rounded text-[10px] font-semibold text-accent/80 font-mono">
												<svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
												{alert.incidentCode}
											</span>
										</div>
									</td>

									<td class="py-4 px-4 text-slate-400 font-medium">{alert.camera}</td>
									<td class="py-4 px-4 text-slate-300 font-semibold">{alert.recipient}</td>
									<td class="py-4 px-4 font-mono text-xs text-slate-400">{alert.channel}</td>

									{/* Yes/No controls and arrow toggle details */}
									<td class="py-4 px-4">
										<div class="flex items-center justify-center gap-2">
											{/* YES pill */}
											<button
												type="button"
												class={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${alert.acknowledged === 'Yes'
													? 'bg-emerald-500 border-emerald-500 text-brand-bg shadow-[0_0_12px_rgba(16,185,129,0.2)]'
													: 'bg-transparent border-emerald-500/20 text-emerald-500/70 hover:bg-emerald-500/5 hover:text-emerald-500'
													}`}
												onClick={() => toggleAck(alert.id, 'Yes')}
											>
												Yes
											</button>

											{/* NO pill */}
											<button
												type="button"
												class={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${alert.acknowledged === 'No'
													? 'bg-amber-500 border-amber-500 text-brand-bg shadow-[0_0_12px_rgba(245,158,11,0.2)]'
													: 'bg-transparent border-amber-500/20 text-amber-500/70 hover:bg-amber-500/5 hover:text-amber-500'
													}`}
												onClick={() => toggleAck(alert.id, 'No')}
											>
												No
											</button>

											{/* Chevron row click detail details */}
											<button
												type="button"
												class="p-1 text-slate-500 hover:text-slate-300 rounded ml-2 transition-colors opacity-60 group-hover:opacity-100"
												onClick={() => window.alert(`Details for notification ID ${alert.id}`)}
											>
												<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Table Footer / Pagination */}
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t border-brand-border/40 text-xs">
					<span class="text-slate-500 font-medium">
						Showing 1-{filteredAlerts.length} of 128 alerts
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
		</div>
	)
}
