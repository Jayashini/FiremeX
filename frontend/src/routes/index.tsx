import { useEffect, useState } from 'preact/hooks'
import { AuthLayout } from '../layouts/AuthLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { OperatorLayout } from '../layouts/OperatorLayout'
import { Login } from '../pages/auth/Login'
import { RegisterGateway } from '../pages/auth/RegisterGateway'
import { Dashboard } from '../pages/admin/Dashboard'
import { Incidents } from '../pages/admin/Incidents'
import { Alerts } from '../pages/admin/Alerts'
import { AlertToastHost } from '../components/incidents/AlertToastHost'
import { Livefeed } from '../pages/admin/Livefeed'
import { AddDevice } from '../pages/admin/AddDevice'
import { User } from '../pages/admin/User'
import { Profile } from '../pages/admin/Profile'
import { Settings } from '../pages/admin/Settings'
import type { SessionUser } from '../session'
import { clearSession, fetchMe, getUser, homePathFor, isLoggedIn } from '../session'

export function AppRoutes() {
	const [path, setPath] = useState(() => normalizePath(window.location.pathname))
	const [openIncidentId, setOpenIncidentId] = useState<number | null>(() => incidentFromURL())

	// Start from whatever was stored, so a returning user sees their pages
	// immediately instead of a loading flash.
	const [user, setUser] = useState<SessionUser | null>(() => getUser())
	const [checking, setChecking] = useState(() => isLoggedIn() && !getUser())

	useEffect(() => {
		const handlePopState = () => { setPath(normalizePath(window.location.pathname)); setOpenIncidentId(incidentFromURL()) }
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [])

	// On load, confirm with the server who we are. This catches an expired
	// token, a changed signing key, or an account that was revoked while the
	// browser tab was closed.
	useEffect(() => {
		if (!isLoggedIn()) return
		let cancelled = false
		fetchMe().then((me) => {
			if (cancelled) return
			// If we could not confirm who this token belongs to - expired,
			// revoked, or the server did not answer - drop the session rather
			// than sitting on a loading screen forever.
			if (!me) clearSession()
			setUser(me)
			setChecking(false)
		})
		return () => {
			cancelled = true
		}
	}, [])

	const navigate = (nextPath: string) => {
		const normalized = normalizePath(nextPath)
		setOpenIncidentId(null)
		if (normalized !== path || window.location.search) {
			window.history.pushState({}, '', normalized)
			setPath(normalized)
		}
	}
	const viewIncident = (id: number) => {
		const next = `/FiremeX/${user?.role === 'operator' ? 'operator' : 'admin'}/incidents`
		window.history.pushState({}, '', `${next}?incident=${id}`)
		setOpenIncidentId(id)
		setPath(next)
	}
	const closeIncident = () => {
		setOpenIncidentId(null)
		if (window.location.search) window.history.replaceState({}, '', window.location.pathname)
	}
	const authenticated = (content: preact.ComponentChild) => <>{content}<AlertToastHost onViewIncident={viewIncident} /></>

	const onSignedIn = (signedIn: SessionUser) => {
		setUser(signedIn)
		setChecking(false)
		navigate(homePathFor(signedIn))
	}

	if (path === '/FiremeX/register') {
		return (
			<AuthLayout maxWidthClassName="max-w-[800px]">
				<RegisterGateway onNavigate={navigate} />
			</AuthLayout>
		)
	}

	if (path === '/FiremeX/login' || path === '/') {
		return (
			<AuthLayout>
				<Login onNavigate={navigate} onSignedIn={onSignedIn} />
			</AuthLayout>
		)
	}

	const isAdminPath = path.startsWith('/FiremeX/admin/')
	const isOperatorPath = path.startsWith('/FiremeX/operator/')

	if (isAdminPath || isOperatorPath) {
		// No token at all - straight back to login.
		if (!isLoggedIn()) {
			navigate('/FiremeX/login')
			return null
		}

		// Token but no confirmed identity yet (a page refresh). Wait rather
		// than guessing which side of the app to show.
		if (checking) {
			return (
				<AuthLayout>
					<p class="text-center text-sm text-slate-400">Loading your account...</p>
				</AuthLayout>
			)
		}

		// Checked, and we still do not know who this is. Back to login.
		if (!user) {
			navigate('/FiremeX/login')
			return null
		}

		// Operators have no business on admin pages. The API refuses them
		// anyway; this just avoids showing screens that would only error.
		if (isAdminPath && user.role !== 'admin') {
			navigate(homePathFor(user))
			return null
		}
		if (isOperatorPath && user.role !== 'operator') {
			navigate(homePathFor(user))
			return null
		}
	}

	// ---------------------------------------------------------------- admin
	if (path === '/FiremeX/admin/dashboard') {
		return authenticated(
			<AdminLayout activePage="dashboard" onNavigate={navigate} user={user}>
				<Dashboard onNavigate={navigate} onViewIncident={viewIncident} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/incidents') {
		return authenticated(
			<AdminLayout activePage="incidents" onNavigate={navigate} user={user}>
				<Incidents openIncidentId={openIncidentId} onIncidentClosed={closeIncident} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/alerts') {
		return authenticated(
			<AdminLayout activePage="alerts" onNavigate={navigate} user={user}>
				<Alerts onViewIncident={viewIncident} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/livefeed') {
		return authenticated(
			<AdminLayout activePage="livefeed" onNavigate={navigate} user={user}>
				<Livefeed onNavigate={navigate} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/livefeed/add-device') {
		return authenticated(
			<AdminLayout activePage="livefeed" onNavigate={navigate} user={user}>
				<AddDevice onNavigate={navigate} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/users') {
		return authenticated(
			<AdminLayout activePage="users" onNavigate={navigate} user={user}>
				<User />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/profile') {
		return authenticated(
			<AdminLayout activePage="profile" onNavigate={navigate} user={user}>
				<Profile user={user} onUserUpdated={setUser} />
			</AdminLayout>
		)
	}

	if (path === '/FiremeX/admin/settings') {
		return authenticated(
			<AdminLayout activePage="settings" onNavigate={navigate} user={user}>
				<Settings user={user} onNavigate={navigate} onUserUpdated={setUser} />
			</AdminLayout>
		)
	}

	// ------------------------------------------------------------- operator
	if (path === '/FiremeX/operator/livefeed') {
		return authenticated(
			<OperatorLayout activePage="livefeed" onNavigate={navigate} user={user}>
				<Livefeed onNavigate={navigate} readOnly />
			</OperatorLayout>
		)
	}

	if (path === '/FiremeX/operator/incidents') {
		return authenticated(
			<OperatorLayout activePage="incidents" onNavigate={navigate} user={user}>
				<Incidents openIncidentId={openIncidentId} onIncidentClosed={closeIncident} />
			</OperatorLayout>
		)
	}
	if (path === '/FiremeX/operator/alerts') {
		return authenticated(
			<OperatorLayout activePage="alerts" onNavigate={navigate} user={user}>
				<Alerts onViewIncident={viewIncident} />
			</OperatorLayout>
		)
	}

	if (path === '/FiremeX/operator/profile') {
		return authenticated(
			<OperatorLayout activePage="profile" onNavigate={navigate} user={user}>
				<Profile user={user} onUserUpdated={setUser} />
			</OperatorLayout>
		)
	}

	return (
		<AuthLayout>
			<Login onNavigate={navigate} onSignedIn={onSignedIn} />
		</AuthLayout>
	)
}


function normalizePath(pathname: string) {
	if (!pathname || pathname === '/') return '/FiremeX/login'
	return pathname.replace(/\/$/, '') || '/FiremeX/login'
}

function incidentFromURL(): number | null {
	const value = Number(new URLSearchParams(window.location.search).get('incident'))
	return Number.isSafeInteger(value) && value > 0 ? value : null
}
