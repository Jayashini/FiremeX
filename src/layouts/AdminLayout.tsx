import type { ComponentChildren } from 'preact'
import { AdminSidebar } from '../components/sidebar/AdminSidebar'

type Props = {
	children: ComponentChildren
	activePage: 'dashboard' | 'livefeed' | 'incidents' | 'alerts' | 'users' | 'cameras' | 'settings'
	onNavigate: (path: string) => void
}

export function AdminLayout({ children, activePage, onNavigate }: Props) {
	return (
		<div class="min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 p-6 bg-brand-bg text-slate-200">
			<AdminSidebar activePage={activePage} onNavigate={onNavigate} />
			<main class="flex flex-col gap-6 overflow-y-auto">
				{children}
			</main>
		</div>
	)
}
