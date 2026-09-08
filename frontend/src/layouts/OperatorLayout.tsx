import type { ComponentChildren } from 'preact'
import type { SessionUser } from '../session'
import { OperatorSidebar } from '../components/sidebar/OperatorSidebar'
import { Footer } from '../components/common/Footer'

type Props = {
	children: ComponentChildren
	activePage: 'livefeed' | 'incidents' | 'profile'
	onNavigate: (path: string) => void
	user: SessionUser | null
}

export function OperatorLayout({ children, activePage, onNavigate, user }: Props) {
	return (
		<div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 p-0 bg-brand-bg text-slate-200 h-screen overflow-hidden">
			<OperatorSidebar activePage={activePage} onNavigate={onNavigate} user={user} />
			<main class="flex flex-col h-screen overflow-y-auto">
				<div class="flex-1">
					{children}
				</div>
				<Footer />
			</main>
		</div>
	)
}
