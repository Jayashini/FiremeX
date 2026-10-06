# Cameras in FiremeX — how they work, and how to set them up

For the current supervisor demonstration, use the tested [demo runbook](docs/supervisor-demo-runbook.md). It includes the authenticated JPEG bridge required for the MacBook webcam.

For anyone joining the project. Part 1 explains how cameras work. Part 2 is the
setup you actually run. You can skip to Part 2 if you just want it working.

---

# Part 1 — How it works

## The big idea

**FiremeX never talks to a camera.** Home Assistant does.

```
   Any camera  ──▶  Home Assistant  ──▶  FiremeX  ──▶  your browser
```

Home Assistant is the part that knows about cameras: their addresses,
passwords, protocols, brands. FiremeX just asks Home Assistant *"what cameras
do you have?"* and *"give me a picture from that one"*.

Think of Home Assistant as a receptionist. Visitors (cameras) arrive speaking
all sorts of languages. The receptionist deals with all of them and gives you
one simple answer in your own language. You never learn the languages.

**Why this matters:** it is why FiremeX works with a laptop webcam, a CCTV
camera on a pole, a phone, or a doorbell — without a single line of code
knowing the difference. If Home Assistant can see it, FiremeX can monitor it.

## What FiremeX stores about a camera

Almost nothing:

| Stored | Not stored |
|---|---|
| The Home Assistant name, e.g. `camera.front_door` | IP address |
| Your label, e.g. "Loading Bay" | Username or password |
| Your zone, e.g. "Warehouse A" | Stream URL |
| Whether AI detection is on | Brand or model |

So a camera record in FiremeX is a **pointer** to a camera in Home Assistant,
not a copy of it. Change a camera's password and FiremeX needs no edit at all.

## The four steps

### 1. Discover — "what cameras exist?"

FiremeX asks Home Assistant for a list of everything it knows about, then keeps
only the things whose name starts with `camera.`

Home Assistant names everything as `type.name` — `light.kitchen`,
`sensor.temperature`, `camera.front_door`. That one naming rule is the whole
reason FiremeX works with any camera type.

### 2. Save — "I want to monitor that one"

An admin picks a camera, gives it a friendly name and a zone, and saves it.
Only then does FiremeX have a record of it.

### 3. List — "show me my cameras"

The Live Feed page asks for the cameras belonging to **your organisation**.
Another company's cameras are invisible — that check happens on the server, on
every single request.

### 4. Show — "give me a picture"

Each tile asks for one photo, waits for it to arrive, shows it, then asks for
the next one. About five times a second when the camera is fast.

## Why still pictures instead of video?

This surprises people, so it is worth explaining.

A video is just pictures shown quickly. There are two ways to send them:

**Whole pictures (JPEG)** — each one is complete on its own. Simple, and a web
browser can display one in an ordinary `<img>` tag.

**Only the changes (H.264)** — most frames just say *"same as before, but the
hand moved"*. Much smaller, which is why real video uses it. But you cannot
grab one frame on its own: it is a recipe step that says *"now add more sugar"*,
useless without knowing what is already in the bowl. To see frame 43 you must
start from the last complete picture and replay every change since.

FiremeX uses whole pictures because:

- a browser `<img>` tag understands them, and understands nothing else
- **the fire detection model needs one frame at a time anyway** — the backend
  worker now samples these same still images for detection
- it works with every camera type, where video streaming does not

We tried the video route first. Home Assistant cannot reliably convert an RTSP
camera into a browser-friendly stream — it starts one and then closes it, which
shows up as a black tile. Still pictures work everywhere.

## Why some cameras are slow

| Camera | Time per picture | Why |
|---|---|---|
| Home Assistant demo camera | ~10 ms | Already stores JPEGs |
| **Real CCTV** (Hikvision, Dahua, Reolink, Tapo, ONVIF) | **fast** | Publishes its own snapshot URL |
| A laptop webcam over RTSP | Varies | The demo JPEG bridge decodes the stream once and serves fresh images |

Slightly surprising: **a real CCTV camera performs better than a laptop
webcam.** Proper cameras hand out a photo on request. A laptop only gives you
compressed video, which has to be unpacked every time.

If the webcam is slow, check the publisher and bridge before changing FireMeX sampling settings.

## Two things that stop it falling over

**One fetch per camera, shared.** If four tiles, two browser tabs and three
operators all want the same camera, Home Assistant is asked **once** and
everyone gets that same picture. Without this, a slow camera would be asked a
dozen times at once.

**Ask only after the last picture arrives.** Each tile waits for its current
picture before requesting the next, instead of asking on a fixed timer. With a
timer, a camera taking 6 seconds to answer a request made every 1 second builds
a queue that never clears — it took down Home Assistant and the database during
development. Chaining means a fast camera runs fast and a slow one simply runs
slow, without harming anything else.

---

# Part 2 — Setting it up

## What you need

- **Docker Desktop** — runs Home Assistant and PostgreSQL
- **Go** — the backend
- **Node.js** — the frontend
- *(optional)* **ffmpeg** and **mediamtx** — only if you want your laptop
  webcam. **Most contributors do not need these.**

## Step 1 — Start the containers

```bash
cd FiremeX
docker compose up -d
```

Starts Home Assistant on port 8123 and PostgreSQL on host port 5433.

Check both are up:

```bash
docker compose ps
```

## Step 2 — Set up Home Assistant (first time only)

1. Open http://localhost:8123
2. Create an account — **this is local to your machine**, nothing goes online
3. Skip through the setup screens

## Step 3 — Get a Home Assistant token

FiremeX needs permission to ask Home Assistant for pictures.

1. In Home Assistant, click **your name** at the bottom of the left sidebar
2. Open the **Security** tab
3. Scroll to **Long-lived access tokens**
4. Click **Create token**, name it `FiremeX`
5. **Copy it now** — it is shown once and never again

## Step 4 — Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and paste your token:

```
HA_URL=http://localhost:8123
HA_TOKEN=<the long token you just copied>
```

Leave everything else at its default. `.env` is git-ignored — your token is
yours and must never be committed.

## Step 5 — Start the backend

```bash
cd backend
go run main.go
```

Expected: `Server is running on port 8080...`

## Step 6 — Start the frontend

New terminal:

```bash
cd frontend
npm install     # first time only
npm run dev
```

Expected: a link to http://localhost:5173

## Step 7 — Create your organisation

1. Open http://localhost:5173/FiremeX/login
2. Click **Request access / Register Organization**
3. Register an organisation — you become its admin
4. **Write down the organisation code** (e.g. `ORG-384`). Others use it to join
   your organisation, and you can see it again later under **Settings**

## Step 8 — Add a camera

**Home Assistant already provides a demo camera.** That is enough to develop
against and needs no extra setup.

1. Log in to FiremeX
2. **Live Feed** → **Add Camera**
3. Pick **Demo camera** from the dropdown
4. Give it a name and zone, tick **Enable FiremeX AI Tracking**
5. Save

You should see a picture. **Setup complete.**

---

## Optional — using your laptop webcam

Docker on macOS does not receive the MacBook camera directly. For the supervisor demo the path is:

```
MacBook webcam → FFmpeg publisher → MediaMTX RTSP → authenticated JPEG bridge → Home Assistant Generic Camera → FireMeX
```

Install FFmpeg and MediaMTX, copy `mediamtx.yml.example` to the gitignored `mediamtx.yml`, and replace its example password. Use `firemex-model/.venv/bin/python scripts/demo/local-stream.py camera --list` to find the exact camera device name. Start MediaMTX, then the publisher and JPEG bridge in separate terminals from the repository root:

```bash
mediamtx mediamtx.yml
firemex-model/.venv/bin/python scripts/demo/local-stream.py camera 'FaceTime HD Camera'
firemex-model/.venv/bin/python scripts/demo/local-stream.py bridge webcam
```

The helper reads the password from the local config without putting it in command history. In Home Assistant's Generic Camera, use RTSP stream URL `rtsp://host.docker.internal:8554/webcam` and Still Image URL `http://host.docker.internal:8765/webcam.jpg`, with username `firemex`, the local password, Basic authentication and TCP RTSP transport. Add that entity from FireMeX **Live Feed → Add Camera**. The image appears in Live Feed after enrollment; the Add Camera form does not fetch an unenrolled camera frame.

For a separate prerecorded source, use `local-stream.py replay /absolute/path/to/video.mp4` and `local-stream.py bridge replay`. Its Home Assistant URLs end in `/replay` and `:8766/replay.jpg`; label it as recorded in FireMeX. See the [demo runbook](docs/supervisor-demo-runbook.md) for the full startup order, model service, detector and acceptance steps.

The bridge requires Basic authentication and returns HTTP 503 if no fresh image arrives for five seconds. If Home Assistant returns 500, check its Still Image URL and whether the container can reach the bridge. If FFmpeg exits, the publisher retries after two seconds. A macOS camera-permission prompt may require enabling the terminal app in System Settings → Privacy & Security → Camera.

## Please do not change these without reading why

These look like things worth "tidying". Each is deliberate.

**Login sets a cookie as well as returning a token.** An `<img>` tag cannot
send an `Authorization` header — the browser only sends cookies. Remove the
cookie and the camera feed becomes the one endpoint that can never
authenticate. It returned 401 for months before anyone noticed.

**The frontend asks for the next picture in `onLoad`, not on a timer.** A
timer queues requests faster than a slow camera can answer. Requests pile up
until Home Assistant and the database fall over. This is not a style choice.

**`cachedSnapshot` allows one fetch per camera at a time.** Everyone else waits
and shares the result. Removing it multiplies the load by the number of viewers.

**There are two HTTP clients.** `haClient` has a full timeout. `haStreamClient`
only limits the wait for the first response — a full timeout would cut a video
stream off mid-play.

**`StreamCamera` looks unused.** It is, by the dashboard. It is correct for
MJPEG-native cameras and is kept deliberately.

---

## Which file does what

### Backend — `backend/`

| File | Job |
|---|---|
| `controllers/camera.go` | All camera endpoints, plus the picture cache |
| `models/camera.go` | What a camera looks like in the database |
| `controllers/helpers.go` | The "which organisation are you?" check |
| `config/config.go` | Where Home Assistant is, and the token |
| `middleware/authMiddleware.go` | Accepts the cookie, so `<img>` can authenticate |
| `main.go` | The route list |

### Frontend — `frontend/src/`

| File | Job |
|---|---|
| `components/common/CameraFrame.tsx` | One camera tile, and its pacing |
| `pages/admin/Livefeed.tsx` | The grid of tiles |
| `pages/admin/AddDevice.tsx` | Choosing a camera from Home Assistant |

### Setup files

| File | Job |
|---|---|
| `docker-compose.yml` | Home Assistant + PostgreSQL |
| `backend/.env.example` | Copy to `.env`, add your token |
| `mediamtx.yml.example` | Copy to `mediamtx.yml`, add a password. Webcam and replay paths |

---

## Current detection status

The backend now samples AI-enabled Home Assistant cameras, calls the model,
stores incidents with annotated evidence, and shows them in the Incidents page.
The Dashboard and Alerts pages still contain explicitly labeled preview data.
This integration has not established that the model reliably detects all fires;
the supervisor test log records a missed public-domain fire photo. See
[supervisor-demo-progress.md](docs/supervisor-demo-progress.md) for the current
verification results.
