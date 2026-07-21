# Home Assistant Setup Guide — FiremeX

This guide walks you through setting up Home Assistant via Docker and embedding the FiremeX dashboard into it.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running on your machine.
- Node.js and npm installed (for the Preact development server).

---

## Step 1: Start the FiremeX Development Server

Open a terminal in the project root directory and run:

```bash
npm run dev
```

This will start the Vite development server on `http://localhost:5173`.

---

## Step 2: Start Home Assistant via Docker

Open a **second** terminal in the project root directory and run:

```bash
docker compose up -d
```

This will:
- Pull the official Home Assistant Docker image (first time only).
- Start the Home Assistant container in the background.
- Map the `homeassistant_config/` folder as the persistent configuration directory.
- Expose the Home Assistant UI on port `8123`.

To verify the container is running:

```bash
docker ps
```

You should see a container named `homeassistant` with status `Up`.

---

## Step 3: Initial Home Assistant Setup

1. Open your browser and navigate to `http://localhost:8123`.
2. Create your Home Assistant account (name, username, password).
3. Complete the onboarding wizard (location, timezone, etc. can be skipped or set to defaults).

---

## Step 4: Add FiremeX Dashboard to Home Assistant

Once logged in to Home Assistant:

1. Go to **Settings** (left sidebar).
2. Click **Dashboards**.
3. Click **Add Dashboard** (bottom-right corner).
4. Select **Webpage**.
5. Fill in the following:
   - **Title:** `FiremeX`
   - **Icon:** `mdi:fire`
   - **URL path:** `firemex-dashboard`
   - **Webpage URL:** `http://localhost:5173/FiremeX/admin/dashboard`
6. Make sure **"Show in sidebar"** is toggled **ON**.
7. Click **Save**.

The **FiremeX** tab with a fire icon will now appear in the left sidebar. Clicking it will load the FiremeX dashboard directly inside Home Assistant.

---

## Useful Docker Commands

| Command | Description |
|---|---|
| `docker compose up -d` | Start the container in the background |
| `docker compose down` | Stop and remove the container |
| `docker compose restart` | Restart the container |
| `docker compose logs -f` | View live container logs |
| `docker ps` | List all running containers |

---

## Troubleshooting

### Container fails to pull the image
- Ensure Docker Desktop is running.
- Check your internet connection.
- If on a university or corporate network, try switching to a mobile hotspot temporarily.
- Try running `docker logout` and then `docker compose up -d` again.

### Home Assistant enters Recovery Mode
- Ensure the following empty files exist inside `homeassistant_config/`:
  - `automations.yaml`
  - `scripts.yaml`
  - `scenes.yaml`
- Ensure a `themes/` folder exists inside `homeassistant_config/`.
- Run `docker compose down` followed by `docker compose up -d` for a clean restart.

### FiremeX dashboard shows a blank page inside Home Assistant
- Verify your Vite dev server is running (`npm run dev`).
- Check the browser console (F12) for iframe-related errors.
- Make sure the Webpage URL is set to `http://localhost:5173/FiremeX/admin/dashboard`.

---

## Project Structure (Docker Related)

```
FiremeX/
├── docker-compose.yml              # Docker container definitions
├── homeassistant_config/
│   ├── configuration.yaml          # Main HA configuration (tracked in Git)
│   ├── automations.yaml            # Automation rules (tracked in Git)
│   ├── scripts.yaml                # Script definitions (tracked in Git)
│   ├── scenes.yaml                 # Scene definitions (tracked in Git)
│   ├── themes/                     # Custom themes folder (tracked in Git)
│   ├── .storage/                   # Credentials & auth (NOT tracked in Git)
│   ├── *.db*                       # SQLite databases (NOT tracked in Git)
│   └── *.log*                      # Runtime logs (NOT tracked in Git)
└── ...
```

> **Security Note:** The `homeassistant_config/.storage/` directory contains authentication tokens and credentials. It is excluded from Git via `.gitignore` and must never be committed to a public repository.
