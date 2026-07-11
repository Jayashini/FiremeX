type Props = {
	onNavigate: (path: string) => void
}

export function Navbar({ onNavigate }: Props) {
	return (
		<header class="topbar">
			<div>
				<p class="eyebrow">FiremeX Command Center</p>
				<h1>Admin console</h1>
			</div>
			<div class="topbar-actions">
				<button type="button" class="ghost-button" onClick={() => onNavigate('/FiremeX/admin/livefeed')}>Live feed</button>
				<button type="button" class="ghost-button" onClick={() => onNavigate('/FiremeX/admin/incidents')}>Incidents</button>
				<button type="button" class="primary-button" onClick={() => onNavigate('/FiremeX/admin/alerts')}>Alerts</button>
			</div>
		</header>
	)
}
