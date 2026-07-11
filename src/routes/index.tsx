import { useEffect, useState } from 'preact/hooks'
import { AuthLayout } from '../layouts/AuthLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { Login } from '../pages/auth/Login'
import { RegisterGateway } from '../pages/auth/RegisterGateway'
import { Dashboard } from '../pages/admin/Dashboard'
import { Incidents } from '../pages/admin/Incidents'
import { Alerts } from '../pages/admin/Alerts'
import { Livefeed } from '../pages/admin/Livefeed'
import { AddDevice } from '../pages/admin/AddDevice'
import { User } from '../pages/admin/User'

export function AppRoutes() {
	const [path, setPath] = useState(() => normalizePath(window.location.pathname))

	useEffect(() => {
		const handlePopState = () => setPath(normalizePath(window.location.pathname))
		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [])

	const navigate = (nextPath: string) => {
		const normalized = normalizePath(nextPath)
		if (normalized !== path) {
			window.history.pushState({}, '', normalized)
			setPath(normalized)
		}
	}

	if (path === '/FiremeX/register') {
		return (
			<AuthLayout maxWidthClassName="max-w-[800px]">
				<RegisterGateway onNavigate={navigate} />
			</AuthLayout>
		)
	}

	if (path === '/login' || path === '/') {
		return (
			<AuthLayout>
				<Login onNavigate={navigate} />
			</AuthLayout>
		)
	}

	if (path === '/admin/dashboard' || path === '/admin') {
		return (
			<AdminLayout activePage="dashboard" onNavigate={navigate}>
				<Dashboard onNavigate={navigate} />
			</AdminLayout>
		)
	}

	if (path === '/admin/incidents') {
		return (
			<AdminLayout activePage="incidents" onNavigate={navigate}>
				<Incidents />
			</AdminLayout>
		)
	}

	if (path === '/admin/alerts') {
		return (
			<AdminLayout activePage="alerts" onNavigate={navigate}>
				<Alerts />
			</AdminLayout>
		)
	}

	if (path === '/admin/livefeed') {
		return (
			<AdminLayout activePage="livefeed" onNavigate={navigate}>
				<Livefeed onNavigate={navigate} />
			</AdminLayout>
		)
	}

	if (path === '/admin/livefeed/add-device') {
		return (
			<AdminLayout activePage="livefeed" onNavigate={navigate}>
				<AddDevice onNavigate={navigate} />
			</AdminLayout>
		)
	}

	if (path === '/admin/users') {
		return (
			<AdminLayout activePage="users" onNavigate={navigate}>
				<User />
			</AdminLayout>
		)
	}

	// Placeholders for sidebar items
	if (path === '/admin/cameras' || path === '/admin/settings') {
		const key = path.split('/').pop() as 'cameras' | 'settings'
		return (
			<AdminLayout activePage={key} onNavigate={navigate}>
				<div class="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
					<div class="text-6xl mb-4">⚙️</div>
					<h2 class="text-2xl font-bold mb-2 capitalize">{key} Page</h2>
					<p class="text-sm">This is a mockup placeholder for the {key} dashboard page.</p>
				</div>
			</AdminLayout>
		)
	}

	return (
		<AuthLayout>
			<Login onNavigate={navigate} />
		</AuthLayout>
	)
}

function normalizePath(pathname: string) {
	if (!pathname || pathname === '/') return '/login'
	return pathname.replace(/\/$/, '') || '/login'
}
