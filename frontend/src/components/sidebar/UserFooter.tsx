import type { SessionUser } from '../../session'
import { clearSession, initials } from '../../session'

type Props = {
	user: SessionUser | null
	onNavigate: (path: string) => void
	profilePath: string
}

// The signed-in user, shown at the bottom of both sidebars.
// Shared so the admin and operator views can never drift apart.
export function UserFooter({ user, onNavigate, profilePath }: Props) {
	const name = user?.name ?? 'Loading...'
	const role = user?.role === 'admin' ? 'Administrator' : user?.role === 'operator' ? 'Operator' : ''

	const signOut = () => {
		clearSession()
		onNavigate('/FiremeX/login')
	}

	return (
		<div class="pt-4 border-t border-brand-border mt-auto">
			<button
				type="button"
				onClick={() => onNavigate(profilePath)}
				class="flex items-center gap-3 w-full text-left rounded-xl p-2 -m-2 hover:bg-slate-800/30 transition-colors"
			>
				<div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-700 font-bold text-sm text-accent select-none shrink-0">
					{user ? initials(user.name) : '..'}
					<div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-brand-surface" />
				</div>
				<div class="flex flex-col leading-none min-w-0">
					<span class="text-sm font-semibold text-slate-200 truncate">{name}</span>
					<span class="text-xs text-slate-500 mt-1">{role}</span>
				</div>
			</button>

			<button
				type="button"
				onClick={signOut}
				class="mt-3 w-full text-xs text-slate-500 hover:text-red-400 transition-colors text-left px-2"
			>
				Sign out
			</button>
		</div>
	)
}
