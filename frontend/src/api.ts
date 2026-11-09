// Where the FiremeX API lives.
//
// Nothing in the app should ever write a server address by hand. During
// development VITE_API_BASE is unset, so BASE is "/" and Vite's dev proxy
// (see vite.config.ts) forwards the request to the Go server on port 8080.
// In a build, VITE_API_BASE can point anywhere without touching the code.
export const INGRESS_PREFIX = window.location.pathname.match(/^\/api\/hassio_ingress\/[A-Za-z0-9_-]+(?=\/|$)/)?.[0] ?? ''
const RAW = INGRESS_PREFIX || (import.meta.env.VITE_API_BASE ?? '/')

/** Root of the server: use for public routes such as login and register. */
export const BASE = RAW.endsWith('/') ? RAW : RAW + '/'

/** Protected routes: everything the Go server mounts under /api. */
export const API = `${BASE}api/`

// Required for writes through Ingress. A cross-origin page cannot send this
// header without a successful CORS preflight.
export const INGRESS_WRITE_HEADERS: Record<string, string> = INGRESS_PREFIX
	? { 'X-FireMeX-Request': '1' }
	: {}
