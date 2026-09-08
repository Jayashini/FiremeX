import type { ComponentChildren } from 'preact'
import type { SessionUser } from '../session'
import { AdminSidebar } from '../components/sidebar/AdminSidebar'
import { Footer } from '../components/common/Footer'

type Props = {
	children: ComponentChildren
	activePage: 'dashboard' | 'livefeed' | 'incidents' | 'alerts' | 'users' | 'settings' | 'cameras' | 'profile'
	onNavigate: (path: string) => void
	user: SessionUser | null
}

export function AdminLayout({ children, activePage, onNavigate, user }: Props) {
	return (
		<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 p-0 bg-brand-bg text-slate-200 h-screen overflow-hidden">
			<AdminSidebar activePage={activePage} onNavigate={onNavigate} user={user} />
			<main class="flex flex-col h-screen overflow-y-auto">
				<div class="flex-1">
					{children}
				</div>
				<Footer />
			</main>
		</div>
	)
}
