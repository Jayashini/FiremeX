// Where the FiremeX API lives.
//
// Nothing in the app should ever write a server address by hand. During
// development VITE_API_BASE is unset, so BASE is "/" and Vite's dev proxy
// (see vite.config.ts) forwards the request to the Go server on port 8080.
// In a build, VITE_API_BASE can point anywhere without touching the code.
const RAW = (import.meta.env.VITE_API_BASE ?? '/') as string

/** Root of the server: use for public routes such as login and register. */
export const BASE = RAW.endsWith('/') ? RAW : RAW + '/'

/** Protected routes: everything the Go server mounts under /api. */
export const API = `${BASE}api/`
