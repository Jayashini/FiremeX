import type { ComponentChildren } from 'preact'
import { AdminSidebar } from '../components/sidebar/AdminSidebar'
import { Navbar } from '../components/navbar/Navbar'

type Props = {
	children: ComponentChildren
	activePage: 'dashboard' | 'livefeed' | 'incidents' | 'alerts'
	onNavigate: (path: string) => void
}

export function AdminLayout({ children, activePage, onNavigate }: Props) {
	return (
		<div class="admin-shell">
			<AdminSidebar activePage={activePage} onNavigate={onNavigate} />
			<div class="admin-main">
				<Navbar onNavigate={onNavigate} />
				<section class="page-content">{children}</section>
			</div>
		</div>
	)
}
