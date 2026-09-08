import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

// Where the Go backend runs during development.
const backend = process.env.VITE_DEV_BACKEND ?? 'http://localhost:8080'

// Routes the Go server owns. Used by both `npm run dev` and `npm run preview`.
const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/login': { target: backend, changeOrigin: true },
  '/register': { target: backend, changeOrigin: true },
  '/ping': { target: backend, changeOrigin: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), preact()],
  // The app now asks for relative paths such as /api/cameras and /login.
  // Vite forwards those to the Go server, so the browser only ever talks to
  // one origin and CORS is not involved.
  server: { proxy },
  preview: { proxy },
})
