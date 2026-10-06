# FireMeX supervisor demo runbook

Use **prerecorded imagery only**. The main demonstration is a fire video displayed on a separate screen to the MacBook webcam. A replay published directly to MediaMTX must be called a recorded source; it is not a live fire.

## One-time setup

1. Install Docker Desktop, FFmpeg, MediaMTX, Go, Node.js and Python 3.11. From the repository root, create `mediamtx.yml` from `mediamtx.yml.example`, replace the example password with a random one, and keep the file gitignored. Create the model environment with `python3.11 -m venv firemex-model/.venv` and `firemex-model/.venv/bin/pip install -r firemex-model/requirements.txt`. Run `npm ci` in `frontend`. Copy `backend/.env.example` to the gitignored `backend/.env` and set the Home Assistant token.
2. In Home Assistant, add a **Generic Camera** for the webcam. Set Stream Source URL to `rtsp://host.docker.internal:8554/webcam`, Still Image URL to `http://host.docker.internal:8765/webcam.jpg`, Username to `firemex`, Password to the private MediaMTX password, Authentication to Basic, and RTSP transport to TCP. Give the entity a clear name such as `camera.laptop_webcam`. Both URLs must validate before confirming. On Docker for Mac, `host.docker.internal` reaches the Mac host.
3. In FireMeX, enroll that Home Assistant entity in the intended organization. Name it **Laptop Webcam (live)** or equivalent and enable AI when ready for the actual test. Never enable AI for the Home Assistant sample/demo cameras.

The local helper reads the password from `mediamtx.yml` without echoing it. Run each long-lived command in its own terminal from the repository root:

```bash
docker compose up -d
mediamtx mediamtx.yml
firemex-model/.venv/bin/python scripts/demo/local-stream.py camera 'FaceTime HD Camera'
firemex-model/.venv/bin/python scripts/demo/local-stream.py bridge webcam
```

The camera launcher can list device names with `firemex-model/.venv/bin/python scripts/demo/local-stream.py camera --list`. macOS must grant camera access to the terminal host app. The publisher retries if its FFmpeg child exits; the JPEG bridge returns HTTP 503 after five seconds without a fresh frame, so an old frame is not treated as live.

In three more terminals:

```bash
cd firemex-model && MPLCONFIGDIR=/private/tmp/firemex-mpl YOLO_CONFIG_DIR=/private/tmp/firemex-yolo .venv/bin/python detect_service.py
cd backend && go run .
cd frontend && npm run dev
```

The model warms inference before `/health` reports ready. The backend should be the **only** worker-owning instance for a given database. Use the ports in `backend/.env` and Vite output. If 8080/5173 are occupied, choose unused backend/frontend ports and point `VITE_DEV_BACKEND` at that backend; do not run two workers against the same schema. In the 6 October isolated rehearsal, port 8081 and 5174 were used to leave the user's existing servers alone.

Before presenting the video, check that two successive `camera.laptop_webcam` images in Home Assistant or FireMeX differ, that Live Feed shows the actual webcam, and that detector status changes from `monitoring disabled` to `monitoring` when AI is enabled. Close the FireMeX browser tab if desired; detection runs in Go, not in the tab.

## Recorded-source backup

Use a permissioned prerecorded file supplied for the demo. Publish it separately and visibly label it as recorded:

```bash
firemex-model/.venv/bin/python scripts/demo/local-stream.py replay /absolute/path/to/clip.mp4
firemex-model/.venv/bin/python scripts/demo/local-stream.py bridge replay
```

Add a second Home Assistant Generic Camera with Stream Source `rtsp://host.docker.internal:8554/replay` and Still Image URL `http://host.docker.internal:8766/replay.jpg`, using the same Basic credentials and TCP transport. Enroll it in FireMeX with a display name beginning **Recorded replay**. In the 6 October rehearsal, an eight-second video was generated from a public-domain smoke photo; that verifies the video transport and incident path, but it is not an independent CCTV clip.

## Present and record

1. Start on the Incidents page and note the current count. Show the Live Feed camera name and a changing webcam image. Confirm AI enabled and model health.
2. Put the prerecorded fire video on another screen, position it in the MacBook webcam view, and note the **visible event onset** using an external clock. The intended model threshold is 0.50 for each class. Keep the clip visible for at least a few worker cycles; image sampling is periodic.
3. Watch for a real `fire` incident. Open its annotated evidence, show the camera and zone, class, exact model score, model hash, threshold and observation time. Reload the page to show persistence. A model miss must be reported as a miss; do not fabricate a detection or silently change the threshold.
4. Show a negative scene and record unexpected incidents. Leave the positive visible briefly to show the 60-second per-camera/class cooldown. Stop the publisher once if time permits: the image should become unavailable/degraded, then recover after restart.
5. Record the elapsed time from visible event onset to UI row. The provisional plan bound is 30 seconds for agreed positive clips; no event-onset latency can be claimed from a static or already-looping source. Record misses and false positives alongside successful cases.

The current model in the repository has SHA-256 `2ab009042ba04827ee1cd1ccb0648832577677334c5fe4927e7c7950f7406c89`. Its weights, training overlap, recommended thresholds and held-out sample provenance still need confirmation from the ML teammate. A public-domain flame photo and **two user-presented fire videos** were missed as `fire` at 0.50 in the 6 October rehearsal; do not present this model as having passed the fire-video acceptance case. A user-presented smoke video **did** create a correctly labeled, evidenced webcam incident at 65.9%. The score is a model confidence score, not a probability of danger.

## Stop and troubleshoot

Use Ctrl-C in the bridge, publisher, model, backend and frontend terminals after the demonstration; this also stops webcam capture. `docker compose down` is optional if other local work uses the containers.

| Symptom | Check |
|---|---|
| No camera frame | macOS camera permission; FFmpeg publisher; MediaMTX stream path; authenticated bridge `/{path}.jpg` |
| Bridge HTTP 503 | No fresh RTSP frame for five seconds; restart publisher or inspect MediaMTX |
| Home Assistant camera proxy HTTP 500 | Generic Camera Still Image URL, Basic credentials and bridge reachability from the container |
| Live Feed says monitoring disabled | AI switch or `DETECTION_ENABLED` setting |
| Live Feed says degraded | Home Assistant/model failure; inspect backend detector status and dependency health |
| No incident despite a visible fire | Save the model result and frame, verify 0.50 threshold and source image, report a miss; ask the ML teammate about model validation |
| Incident without image | Check evidence status and the writable `FIREMEX_DATA_DIR/evidence` path; do not claim evidence was saved |

Record the real acceptance evidence in `docs/supervisor-demo-progress.md`. Automated Go/Python tests and the frontend build validate application behavior, not fire-detection quality.
