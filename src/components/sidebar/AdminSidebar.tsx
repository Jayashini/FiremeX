type Props = {
	activePage: 'dashboard' | 'livefeed' | 'incidents' | 'alerts' | 'users' | 'settings'
	onNavigate: (path: string) => void
}

type SidebarItem = {
	label: string
	path: string
	key: Props['activePage']
	icon: any
}

const items: SidebarItem[] = [
	{
		label: 'Dashboard',
		path: '/admin/dashboard',
		key: 'dashboard',
		icon: (active: boolean) => (
			<svg class={`w-5 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
			</svg>
		)
	},
	{
		label: 'Live Feed',
		path: '/admin/livefeed',
		key: 'livefeed',
		icon: (active: boolean) => (
			<svg class={`w-6 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
			</svg>
		)
	},
	{
		label: 'Incidents',
		path: '/admin/incidents',
		key: 'incidents',
		icon: (active: boolean) => (
			<svg class={`w-6 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
			</svg>
		)
	},
	{
		label: 'Alerts',
		path: '/admin/alerts',
		key: 'alerts',
		icon: (active: boolean) => (
			<svg class={`w- h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
			</svg>
		)
	},
	{
		label: 'Users',
		path: '/admin/users',
		key: 'users',
		icon: (active: boolean) => (
			<svg class={`w-5 h-5 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
		)
	},
	{
		label: 'Settings',
		path: '/admin/settings',
		key: 'settings',
		icon: (active: boolean) => (
			<svg class={`w-5 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		)
	}
]

export function AdminSidebar({ activePage, onNavigate }: Props) {
	return (
		<aside class="flex flex-col justify-between w-full h-[calc(100vh)] bg-brand-surface border-r-1 border-[#8B949E]/10 p-4 select-none shrink-0">
			<div class="flex flex-col gap-8">
				{/* Brand Logo & Name */}
				<div class="flex items-center gap-3 mb-5 pb-5 border-b border-[#8B949E]/10">
					<img src="/logo.png" alt="FiremeX" class="w-12 h-12 object-contain border-2 border-[#8B949E]/40 rounded-xl bg-[#14B8A6]/10 pb-1" />
					<div class="flex flex-col leading-none ">
						<span class="text-lg font-bold text-slate-100 tracking-tight">Fireme<span class="text-accent">X</span></span>
						<span class="text-[10px] text-[#8B949E] mt-1 tracking-wider">Fire & Security Monitoring</span>
					</div>
				</div>

				{/* Nav List */}
				<nav class="flex flex-col gap-2">
					{items.map((item) => {
						const active = activePage === item.key
						return (
							<button
								key={item.key}
								type="button"
								class={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${active
									? 'bg-[#050B0D]/80 border-l-5 border-accent text-accent border-shadow-none'
									: 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
									}`}
								onClick={() => onNavigate(item.path)}
							>
								{item.icon(active)}
								<span>{item.label}</span>
							</button>
						)
					})}
				</nav>
			</div>

			{/* User Profile Footer */}
			<div class="flex items-center gap-3 pt-4 border-t border-brand-border mt-auto">
				{/* Avatar */}
				<div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 font-bold text-sm text-accent select-none">
					JS
					<div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-brand-surface" />
				</div>
				<div class="flex flex-col leading-none">
					<span class="text-sm font-semibold text-slate-200">J. Silva</span>
					<span class="text-xs text-slate-500 mt-1">Admin</span>
				</div>
			</div>
		</aside>
	)
}
