type Props = {
	activePage: 'livefeed' | 'incidents' | 'alerts'
	onNavigate: (path: string) => void
}

const items = [
	{ label: 'Live Feed', path: '/admin/livefeed', key: 'livefeed' },
	{ label: 'Incidents', path: '/admin/incidents', key: 'incidents' },
	{ label: 'Alerts', path: '/admin/alerts', key: 'alerts' },
] as const

export function AdminSidebar({ activePage, onNavigate }: Props) {
	return (
		<aside class="sidebar">
			<div class="brand-block">
				<img src="/logo.png" alt="FiremeX" class="brand-logo" />
				<div>
					<strong>FiremeX</strong>
					<p>Security operations</p>
				</div>
			</div>
			<nav>
				{items.map((item) => (
					<button
						key={item.key}
						type="button"
						class={`sidebar-link ${activePage === item.key ? 'active' : ''}`}
						onClick={() => onNavigate(item.path)}
					>
						{item.label}
					</button>
				))}
			</nav>
		</aside>
	)
}
