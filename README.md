# FiremeX

**FiremeX** is a web-based **fire & security monitoring** console for enterprise
safety operations. It gives organizations a real-time dashboard to watch camera
feeds, review AI-detected fire/smoke incidents, manage alerts, and administer the
operator team that responds to them.

This repository contains the FireMeX web app, Go API, local fire/smoke model,
PostgreSQL database, and Home Assistant development environment.

## Features

- **Authentication** — Login, plus a registration gateway that supports two paths:
  registering a new **Organization** (which generates a unique org code) or
  requesting **Operator** access to an existing organization (approval-gated).
- **Dashboard** — Real-time situation overview with a live clock and recent
  incident summary.
- **Live Feed** — Grid of monitored cameras; add and manage devices.
- **Incidents** — Detection history log with search, camera/status filters, and
  a resolve/blocker workflow (mark incidents Unresolved / In Progress / Resolved
  with notes).
- **Alerts** — Notification history filterable by time range and channel.
- **Users** — Manage active users and approve/reject pending access requests.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Preact 10 |
| Build tool | Vite 8 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |

Routing is handled by a small custom router in `src/routes/index.tsx` (using the
History API), not a routing library.

## Getting started

Requires Docker Desktop, Go, Node.js/npm, and Python 3.

```bash
./start.sh
```

The first run installs missing frontend and Python dependencies. It then starts
PostgreSQL, Home Assistant, the AI model, Go backend, and frontend and verifies
that each service is ready. Open the printed URL:

```text
http://localhost:5173/FiremeX/login
```

The application services continue running after the terminal closes. Runtime
logs are stored in `.firemex-runtime/`. Stop the complete system, including
PostgreSQL and Home Assistant, with:

```bash
./stop.sh
```

## Scripts

```bash
npm run dev       # start the Vite dev server with hot reload
npm run build     # type-check (tsc -b) and build for production into dist/
npm run preview   # serve the production build locally
```

## Project structure

```
src/
  main.tsx              App entry point (renders <App/> into #app)
  app.tsx               Root component
  routes/index.tsx      Custom History-API router
  layouts/              Page shells (Auth, Admin, Operator)
  components/           Shared UI (sidebar, navbar, footer, button)
  pages/
    auth/               Login, RegisterGateway (+ password screens)
    admin/              Dashboard, Livefeed, AddDevice, Incidents,
                        Alerts, User, Profile
  index.css             Tailwind import + theme tokens and global styles
public/                 Static assets (logo, images)
```
