import type { SessionUser } from '../../session'
import { UserFooter } from './UserFooter'

type Props = {
	activePage: 'livefeed' | 'incidents' | 'profile'
	onNavigate: (path: string) => void
	user: SessionUser | null
}

type SidebarItem = {
	label: string
	path: string
	key: Props['activePage']
	icon: any
}

// Operators watch cameras and respond to detections. Everything else -
// adding devices, managing accounts, organisation settings - is an
// administrator concern and is deliberately absent here.
const items: SidebarItem[] = [
	{
		label: 'Live Feed',
		path: '/FiremeX/operator/livefeed',
		key: 'livefeed',
		icon: (active: boolean) => (
			<svg class={`w-6 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
			</svg>
		)
	},
	{
		label: 'Incidents',
		path: '/FiremeX/operator/incidents',
		key: 'incidents',
		icon: (active: boolean) => (
			<svg class={`w-6 h-6 transition-colors ${active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
			</svg>
		)
	}
]

export function OperatorSidebar({ activePage, onNavigate, user }: Props) {
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
				<nav class="flex flex-col gap-2 mt-[-20px]">
					{items.map((item) => {
						const active = activePage === item.key
						return (
							<button
								key={item.key}
								type="button"
								class={`group flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${active
									? 'bg-accent/7 border-l-4 border-accent text-accent border-y-transparent border-r-transparent'
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

			<UserFooter user={user} onNavigate={onNavigate} profilePath="/FiremeX/operator/profile" />
		</aside>
	)
}
