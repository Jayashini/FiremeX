import type { ComponentChildren } from 'preact'
import { AdminSidebar } from '../components/sidebar/AdminSidebar'
import { Footer } from '../components/common/Footer'

type Props = {
	children: ComponentChildren
	activePage: 'dashboard' | 'livefeed' | 'incidents' | 'alerts' | 'users' | 'settings' | 'cameras'
	onNavigate: (path: string) => void
}

export function AdminLayout({ children, activePage, onNavigate }: Props) {
	return (
		<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 p-0 bg-brand-bg text-slate-200 h-screen overflow-hidden">
			<AdminSidebar activePage={activePage} onNavigate={onNavigate} />
			<main class="flex flex-col h-screen overflow-y-auto">
				<div class="flex-1">
					{children}
				</div>
				<Footer />
			</main>
		</div>
	)
}
