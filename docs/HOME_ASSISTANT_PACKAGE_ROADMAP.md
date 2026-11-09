# FireMeX Home Assistant package roadmap

Prepared: 6 November 2026. Source baseline: `44b2bbc`.

## Goal and scope

Deliver an experimental FireMeX Home Assistant App that installs once, opens through Open Web UI, imports compatible Home Assistant cameras, performs background inference, records incidents and evidence, and retains customer data across restart, update and restore.

Keep Go, Preact, Python/YOLO and PostgreSQL. Use one supervised container. Develop an ARM64 (`aarch64` in HA metadata) build for the owner's Apple silicon UTM VM; validate an AMD64 build on Intel/AMD hardware before advertising that platform. This is a proposed implementation sequence, not completed work or authorization to publish.

V1 camera direction: reuse Home Assistant camera discovery and snapshots. Direct RTSP onboarding is a fallback workstream only if the selected cameras cannot supply adequate images through HA. Do not rebuild the working camera pipeline merely to match the original master-plan template. Browser-local webcams remain a demo feature requiring an open browser; a webcam published to HA is a different, server-accessible source.

## Verified starting point

Code review establishes implementation, not successful operation in the new package:

| Area | Current evidence | Remaining work |
|---|---|---|
| HA camera discovery | `backend/controllers/camera.go` reads `/api/states` and lists `camera.*` | Validate enrollment and image availability; listing alone is not compatibility |
| Camera images | `backend/internal/cameras/snapshot.go` fetches authenticated HA snapshots with bounded image validation and shared short cache | Verify source freshness, errors and sustained operation on HAOS |
| Background inference | Go scheduler and local Python REST client exist | Package startup, readiness, restart and resource validation |
| Incidents and evidence | Persistence, response ownership, audit actions and retention exist | Regression-test in packaged deployment |
| Settings | Environment configuration, configurable data directory, persisted JWT secret exist | Safe package defaults, Supervisor adapter, persistent permissions |
| Database | PostgreSQL 15 in development; GORM AutoMigrate at startup | Versioned upgrade policy, safe initialization and tested restore |
| UI | Preact/Vite build and History API router exist | Production serving, Ingress paths, cookies and authorization |
| Health | Settings endpoint exists | It still hardcodes detection as “Not connected yet”; connect it to actual health |
| Deployment | Compose runs HA Container and PostgreSQL; local scripts run application processes | No HA package Dockerfile or S6 service layout found in scoped review |

The October demo log reports successful webcam → HA Container → FireMeX smoke incidents and evidence, publisher outage/recovery, and previous automated checks. It also records two failed correct-fire trials. These are historical results, not fresh verification. Do not describe the whole system as finished or the model as validated.

## Milestone 1 — Confirm baseline and package contract

Can start before HAOS is ready.

- [ ] Re-run relevant existing Go, Python contract and frontend build checks. Record tool versions, results and any database prerequisites; use disposable data.
- [ ] Inventory actual environment options, ports, persistent files, model hash and dependencies without copying secrets.
- [ ] Define package runtime settings using existing names: `PORT`, `MODEL_URL`, `FIREMEX_DATA_DIR`, database configuration and HA access adapter.
- [ ] Preserve development behavior; set package data directory to `/data` and keep inference/database private.
- [ ] Specify ownership and persistent paths for database, evidence, JWT secret and configuration.
- [ ] Check ARM64 Python wheels against the chosen Linux base/Python version; do not assume macOS ARM installation proves Linux compatibility.
- [ ] Confirm model/software redistribution permissions before distributing images. Obtain model provenance and intended weights from the ML teammate.

Exit: documented runtime contract and reproducible baseline; dependency failures identified before container work assumes they are resolved.

## Milestone 2 — Make UI and HA access portable

Can implement locally; final acceptance needs HAOS.

- [ ] Build the UI and serve it from Go or a packaged reverse proxy; no Vite development server in the installed app.
- [ ] Centralize the UI base path for routes, links, API requests, images and redirects; support the changing Ingress prefix.
- [ ] Provide SPA deep-link fallback without converting missing API/assets into HTML success responses.
- [ ] Add a package HA client mode using the Supervisor-provided token and Core API proxy; retain explicit `HA_URL`/`HA_TOKEN` for standalone development.
- [ ] Test camera snapshot proxy calls through that adapter, not only state discovery.
- [ ] Define initial user access explicitly: retain current FireMeX login for the first internal smoke test; before customer release implement trusted Ingress identity mapping to existing organization/roles and preserve incident response ownership. No silent auto-admin mapping.
- [ ] Restrict trusted proxy headers to the actual ingress boundary; implement appropriate CSRF/origin checks, cookie paths and protected evidence access.

Exit: production bundle and APIs work behind a local prefix proxy; existing standalone authentication still works. Real Ingress identity and browser behavior remain pending HAOS tests.

## Milestone 3 — Build the single-container runtime

Can start after runtime/dependency contract is established, without HAOS.

- [ ] Add `deploy/homeassistant/Dockerfile.ha` with Go/UI build stages and a compatible HA S6 runtime base.
- [ ] Pin compatible runtime versions. Preserve PostgreSQL 15 initially unless a tested migration explicitly changes it; choose a base that actually supports the required database and ML runtime.
- [ ] Bake model weights and Python dependencies into the image; no installation or weight download on customer startup.
- [ ] Add S6 preparation, PostgreSQL, inference and Go services. Use readiness checks with bounded retries, not fixed sleeps.
- [ ] Initialize a database only on a genuinely new cluster; reject unexpected/incompatible cluster versions without overwriting data.
- [ ] Generate persistent secrets and use a restricted application database role; drop service privileges and restrict data permissions.
- [ ] Warm the model before inference readiness. Gracefully stop application workers and database.
- [ ] Keep `/init` as PID 1; keep database and inference off host-published ports.
- [ ] Build ARM64 and smoke-test with an isolated persistent `/data` mount. Build AMD64 after the shared runtime works; don't declare it supported without execution tests.

Exit: one image starts all services, exposes real readiness, survives service failure/restart, and reuses database/evidence/settings across container recreation. Record image size and startup/resource measurements.

## Milestone 4 — Finish camera validation, health and alert delivery

Most implementation can happen while HAOS installs. Can overlap milestone 3 once contracts are stable.

- [ ] Add bounded connection/preview validation before enabling an imported HA camera; handle missing, unavailable and non-image entities clearly.
- [ ] Correct existing documentation/comments claiming every HA camera automatically works.
- [ ] Track image receipt separately from inference/persistence success. Receipt time is not capture time: a newly fetched image may still be stale upstream.
- [ ] Report snapshot freshness limits honestly; identical image hashes alone cannot distinguish a stationary scene from a frozen source.
- [ ] Replace the hardcoded settings detection status with actual database, inference, camera and worker health.
- [ ] Preserve existing acknowledge/response ownership, audit history, AI toggle, cooldown and retention behavior. Verify resolution never disables monitoring.
- [ ] Add durable HA alert delivery with retry/backoff and deduplication; persist failed delivery status instead of treating in-browser toasts as HA notifications.
- [ ] Provide persistent HA notification and test-notification flow; optional mobile target only after configuration and delivery verification.

Exit: imported cameras are validated, dependency failure is visible, and incident delivery can be exercised with controlled fixtures. Actual HA notifications still require live HAOS acceptance.

## Milestone 5 — Install and exercise in HAOS/UTM

Requires HAOS and sufficient Mac disk space. The earlier disk check reported approximately 4.4 GiB free; recheck and free capacity before large image builds or VM growth.

- [ ] Add local app metadata and user documentation; use `aarch64` for the ARM test package, Ingress, S6-compatible init configuration and no unnecessary host ports/privileges.
- [ ] Enable Core API access only for the implemented bridge; document its powerful permission.
- [ ] Install through Supervisor and verify Open Web UI, sidebar, refresh, deep links, login/roles, API writes and evidence images.
- [ ] Reuse the authenticated webcam publisher/JPEG bridge; use the Mac address reachable from UTM, not Docker-only `host.docker.internal`.
- [ ] Add the webcam in HA Generic Camera, import it into FireMeX, and confirm changing frames and analysis with the FireMeX page closed.
- [ ] Run a clearly labeled prerecorded positive/negative source through the same camera path. Separate pipeline tests from real-model quality results.
- [ ] Test HA restart, publisher outage/recovery, model failure, database failure, app stop/start and VM reboot.

Exit: installation and end-to-end operation work in the real Supervisor environment. Save a redacted acceptance log.

## Milestone 6 — Prove updates, backups and operating limits

- [ ] Introduce recorded schema migrations/version checks before shipping upgrades; test migration from a prior populated installation.
- [ ] Reinstall/update without deleting `/data`; verify users, cameras, settings, incidents and evidence.
- [ ] Use a consistent cold-backup policy initially; test restoration into a clean installation, including database permissions and secrets. Document monitoring downtime during backup.
- [ ] Refuse unsupported PostgreSQL major upgrades and document restore/rollback limitations.
- [ ] Exercise evidence retention, disk-full behavior and bounded memory/storage use.
- [ ] Run a four-source extended soak test with outages; record camera freshness, p95 latency, memory/CPU, queue drops and lost results.
- [ ] Obtain ML-reviewed representative fire, smoke and nuisance footage. Record misses, false alerts and event-onset delays. Resolve or explicitly limit the known correct-fire failure before any customer fire-detection claim.
- [ ] Test the exact AMD64 image on Intel/AMD HAOS before supporting that platform. ARM results do not establish AMD64 capacity.

Exit: restore and upgrade evidence exists; tested hardware/camera limits and model limitations are documented. No claim of certified protection or guaranteed detection.

## Milestone 7 — Publish an experimental customer package

Only after applicable installation, security, licensing and acceptance gates pass.

- [ ] Add release CI checks and reproducible architecture builds, dependency/image scanning and license notices.
- [ ] Publish immutable versioned images and verify anonymous pull before updating catalog versions.
- [ ] Create public custom-repository metadata, app config, README, setup guide, changelog and branded assets. Advertise only tested architectures.
- [ ] Document camera requirements, local/cloud dependencies, privacy, evidence retention, notifications, backups, known issues and support diagnostics without secrets.
- [ ] On a second clean HAOS installation, add the repository and complete camera enrollment, test notification, incident response and restart using only the customer guide.

Exit: a new user installs without terminal commands or separate application/database setup. Public publishing is a distinct action; this roadmap does not publish or create remote repositories.

## Order and boundaries

Start now: milestone 1 → milestone 2 and milestone 3 → milestone 4. HAOS installation can run independently. Once ready: milestone 5 → milestone 6 → milestone 7. Start ML handoff/license review early because model replacement and validation can take longer than packaging.

Two finish lines must remain separate:

1. **Internal package works:** installation, services, camera images, persistence and UI work in UTM. Known model shortcomings may remain, clearly labeled.
2. **Customer release is ready:** model claims, security, licensing, notifications, recovery, updates and advertised hardware have evidence.

Do not add direct RTSP orchestration, MQTT, physical sirens, a new database, a UI redesign or a new live-video player unless a concrete test failure or separate user decision requires it.

## References

- [Existing observed demo results](supervisor-demo-progress.md)
- [Existing reproducible demo runbook](supervisor-demo-runbook.md)
- [Product decisions](product-decisions.md)
- [HA app configuration](https://contributors.home-assistant.io/apps/reference/configuration/)
- [HA Ingress and identity](https://contributors.home-assistant.io/apps/guides/ingress/)
- [Core/Supervisor communication](https://contributors.home-assistant.io/apps/guides/communication/)
- [S6 supervision](https://contributors.home-assistant.io/apps/guides/s6-overlay/)
- [Publishing](https://contributors.home-assistant.io/apps/guides/publishing/)
