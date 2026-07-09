import { useEffect, useState } from 'preact/hooks'
import { AuthLayout } from '../layouts/AuthLayout'
import { AdminLayout } from '../layouts/AdminLayout'
import { Login } from '../pages/auth/Login'
import { Incidents } from '../pages/admin/Incidents'
import { Alerts } from '../pages/admin/Alerts'
import { Livefeed } from '../pages/admin/Livefeed'

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

	if (path === '/login' || path === '/') {
		return (
			<AuthLayout>
				<Login onNavigate={navigate} />
			</AuthLayout>
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
				<Livefeed />
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
