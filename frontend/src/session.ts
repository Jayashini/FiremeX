// Who is signed in, and how to prove it to the API.
//
// The token is the only thing that matters for security - the server re-checks
// it on every request. The user object stored alongside it is purely so the app
// knows which screens to draw without asking the server first. Someone editing
// it in devtools sees different menus and still gets 403 from the API.
import { API } from './api'

export type Organization = {
	id: number
	name: string
	sector: string
	email: string
	phone: string
	/** Operator join code. The API only sends this to administrators. */
	code?: string
}

export type SessionUser = {
	id: number
	name: string
	email: string
	role: 'admin' | 'operator'
	status: string
	member_since: string
	organization?: Organization
}

const TOKEN_KEY = 'firemex_token'
const USER_KEY = 'firemex_user'

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): SessionUser | null {
	const raw = localStorage.getItem(USER_KEY)
	if (!raw) return null
	try {
		return JSON.parse(raw) as SessionUser
	} catch {
		return null
	}
}

export function saveSession(token: string, user: SessionUser) {
	localStorage.setItem(TOKEN_KEY, token)
	localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function saveUser(user: SessionUser) {
	localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
	localStorage.removeItem(TOKEN_KEY)
	localStorage.removeItem(USER_KEY)
}

export function isLoggedIn(): boolean {
	return !!getToken()
}

/** Headers for any call to a protected endpoint. */
export function authHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${getToken() ?? ''}`,
	}
}

/**
 * Ask the server who we are.
 *
 * Called on a page refresh, when the browser still has a token but the app has
 * just started. A 401 means the token expired or the signing key changed, so
 * the stored session is cleared and the caller sends the user to login.
 */
export async function fetchMe(): Promise<SessionUser | null> {
	if (!getToken()) return null

	try {
		const response = await fetch(`${API}me`, { headers: authHeaders() })
		if (response.status === 401 || response.status === 403) {
			clearSession()
			return null
		}
		if (!response.ok) return getUser()

		const data = await response.json()
		saveUser(data.user)
		return data.user as SessionUser
	} catch {
		// Network error - keep whatever we already had rather than logging out.
		return getUser()
	}
}

/** Where a user should land after signing in. */
export function homePathFor(user: SessionUser | null): string {
	return user?.role === 'operator'
		? '/FiremeX/operator/livefeed'
		: '/FiremeX/admin/dashboard'
}

/** "Esandu Epa" -> "EE", for the sidebar avatar. */
export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return '?'
	return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}
