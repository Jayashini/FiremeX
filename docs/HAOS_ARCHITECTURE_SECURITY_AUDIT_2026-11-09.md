# FireMeX — HAOS architecture, security and packaging audit

Reviewed: 9 November 2026. Branch: `firemex-backend`. Commit: `44b2bbc`.

This audit compares the current implementation with the supplied packaging master plan and the existing 6 November package roadmap. It records findings and proposed changes; it does not implement or publish an app. Existing untracked planning documents were preserved.

## Assessment

**Keep Go + Preact + Python/YOLO + PostgreSQL. The stack is suitable for a Home Assistant App, but the repository is not currently an installable HAOS package.** There is substantial application functionality to preserve. The highest priorities are two confirmed access/query vulnerabilities, deployment and Ingress work, reliable external alerts, and tested persistence. Detector quality is an independent customer-release blocker.

An internal experimental package is a realistic next milestone. A package that installs is not evidence that its fire detection, backups, or security are ready for customers. Initially advertise only the hardware architecture actually tested; the supplied plan targets AMD64. ARM64 testing on the development Mac would be a separate build and acceptance result.

## Verified current architecture

```text
Local browser: Preact on Vite :5173
       | development proxy, JWT header / session cookie
       v
Go API :8080, running on the development host
       |-- PostgreSQL through host :5433 -> container :5432
       |-- shared HA URL/token -> /api/states and /api/camera_proxy/<entity>
       |-- fair serial background scheduler -> Python :8100 /detect
       |-- incidents + alerts + response audit records in PostgreSQL
       `-- JPEG incident evidence in FIREMEX_DATA_DIR/evidence

Python: local CPU YOLO, loopback listener, model loaded and warmed once
Docker Compose: PostgreSQL 15 and Home Assistant Container only
start.sh: starts Compose, then local Python, Go and Vite processes
```

An authenticated browser-webcam upload path also exists. It needs an open Live Feed page and is not an unattended server camera. The current server camera path uses HA snapshots; Go does not currently supervise FFmpeg/RTSP workers.

Preserve these working foundations:

- Central environment configuration and a generated, persisted signing secret.
- Authentication with account-status checks; organization filters on normal incident/evidence operations.
- Bounded JPEG/PNG validation, shared snapshot cache and request cancellation.
- Model warmup, loopback binding, input/output validation, bounded upload size and serialized inference.
- Transactional incident/alert creation, idempotency keys and camera-disable checks.
- Authenticated evidence access, contained filesystem operations, restrictive evidence permissions, disk budget and expiry cleanup.
- Incident acknowledgement, response ownership and actor-history records.
- Existing unit, integration and model-contract tests.

## Verification performed

| Check | Result and scope |
|---|---|
| Frontend `npm run build` | Passed TypeScript and Vite production build. Built HTML still contains root-relative asset URLs. |
| Go `go test ./... -count=1 -v` | Passed. Initial run skipped DB tests; subsequent run provided a test DSN and passed all three existing PostgreSQL integration tests, including pipeline and worker fairness/recovery. |
| Python `python -m unittest -v test_detect_service.py` | All five tests passed. These use a fake model; they do not validate actual fire recognition. |
| Public-registration access probe | Reproduced with a disposable database schema and fake HA server: a new unauthenticated registrant became an active admin, listed a fake installation camera, enrolled it, and retrieved its JPEG without installation-owner approval. |
| User-ID query probe | GORM DryRun confirmed `1=1` is inserted as a SQL condition when passed as the string ID in the current user-controller pattern. No destructive SQL was executed. |
| Runtime inventory | Local PostgreSQL 15 and HA Container were running. This is not an HAOS/Supervisor installation test. |
| Tracked-source secret pattern check | No matches for the selected JWT, private-key and GitHub-token patterns. This was not a comprehensive secret scan or a Git-history audit. |

The temporary security probe file was removed after execution. Tests used disposable schemas and synthetic images; existing customer/application rows and real cameras were not used by the probes. Application source was not changed. Go tests required access to the normal dependency cache and localhost test database.

Not performed: HAOS installation, image build, Ingress browser acceptance, fresh real-camera/model benchmark, extended soak, backup/restore, upgrade, full dependency/image scan or penetration test. Historical demo results below are explicitly distinguished from today's checks.

## Security findings

### S1 — High: public registration grants access to installation cameras

**Evidence:** `backend/main.go:97`, `backend/controllers/organization.go:15`, `backend/controllers/organization.go:68`, `backend/controllers/camera.go:53`, `backend/controllers/camera.go:117`.

Public organization registration creates an active administrator. Every organization's admin uses the same installation-wide HA URL/token for discovery. Enrollment accepts any entity ID and does not check an installation-owned assignment. A registrant can therefore enroll an existing HA camera into their own organization and pass the later organization-scoped snapshot check. Database row scoping does not establish ownership of the underlying HA resource. The isolated end-to-end probe reproduced this chain.

**Exposure:** a person who can reach the current Go API and register; current Go binding is all interfaces. This is not a claim of proven Internet exposure. A correctly restricted future Ingress boundary reduces reachability but does not fix this authorization model.

**Fix:** make the HAOS product a single installation/site by default. Provision the owner through a trusted, authorized setup flow and disable public organization creation after setup. Map HA identities to approved local roles. If multiple organizations remain supported, keep installation-controlled camera grants and enforce them during discovery, enrollment and image access. A submitted camera ID cannot grant itself access.

**Acceptance:** an unapproved user cannot bootstrap an admin or access installation cameras; a second organization cannot enroll an unassigned entity even if it knows its name.

### S2 — High: user-management IDs become raw SQL conditions

**Evidence:** `backend/controllers/user.go:46`, `:75`, `:101` and the following `First(&user, id)` calls.

Approve, deny and revoke take `c.Param("id")` as a string and pass it to GORM's inline condition API. Non-numeric strings are interpreted as query expressions. This is the exact unsafe pattern identified in [GORM's security documentation](https://gorm.io/docs/security.html). The dry-run probe confirmed raw condition construction. The existing organization predicate is not a substitute for safe query construction; this audit did not attempt cross-organization extraction or destructive exploitation.

**Fix:** use the existing positive-integer parser, reject invalid IDs before any query, and use `Where("organization_id = ? AND id = ?", orgID, id).First(&user)`. Check errors from `Save` and `Delete` as well: the current handlers can report successful approval/revocation when the write failed.

**Acceptance:** non-numeric, overflow and SQL-shaped IDs return 400; cross-organization IDs return 404; failed writes never return success.

### S3 — High for deployment: development database credentials and exposure

**Evidence:** `docker-compose.yml`, `backend/config/config.go:105`.

Compose publishes PostgreSQL on host port 5433 without a loopback-only address and supplies a fixed development password. Backend defaults match it and only warn. Copying these settings into an installed product would expose a predictable database credential wherever that port is reachable.

**Fix:** in development bind the DB port to loopback when remote access is unnecessary. In the HA image publish no database port, bind PostgreSQL to loopback/a local socket, create a restricted application role, generate installation-specific credentials and persist them with restrictive permissions. Refuse development defaults in package mode. Keep migration privileges separate where practical.

### S4 — Medium/high: browser sessions are not suitable for the intended Ingress deployment

**Evidence:** `backend/controllers/auth.go:82`, `:99`; `backend/controllers/me.go:174`; `frontend/src/session.ts:30`.

The same JWT is stored in JavaScript-readable localStorage and an HttpOnly cookie. The cookie has `Secure=false` and `Path=/`. Logout clears the browser copy but does not revoke the token; password changes leave existing sessions valid for up to 24 hours. HttpOnly does not protect the duplicate localStorage token from script access. There is no explicit CSRF/origin validation middleware. SameSite Strict and the CORS allowlist already offer partial protection; no XSS or cross-site exploit was demonstrated.

Ingress places the app under HA's origin and a changing path, so root-scoped cookies and storage also need deliberate handling. Paths alone are not a security isolation boundary.

**Fix:** use trusted Ingress identity with explicit role provisioning for HA mode, preserving standalone authentication separately. Only trust identity/proxy headers after validating the actual ingress peer. Fail closed on missing identity. If app sessions remain, use secure scoped cookies, remove localStorage bearer persistence, support revocation/session versions and validate state-changing requests. Do not automatically make every Ingress visitor an admin. See [HA Ingress guidance](https://contributors.home-assistant.io/apps/guides/ingress/).

### S5 — Medium: registration and expensive requests lack admission controls

**Evidence:** `backend/controllers/organization.go:36`, `backend/main.go:159`, `backend/controllers/detection.go:79`, `backend/internal/detection/worker.go:256`.

Organization join codes have only 900 possibilities and use `math/rand`. Registration has no rate limit or bounded retry count for code allocation. Collision checks also reuse a populated GORM model rather than performing an independent existence check. A bcrypt failure after organization creation can leave an orphan organization because setup is not transactional. Operator signup still requires approval, so guessing a code alone does not grant operator access.

Most JSON endpoints lack explicit body limits; the server sets only a header timeout. Browser uploads have per-image limits, but multiple authenticated requests can retain image buffers while waiting on a shared inference mutex. That mutex does not impose a bounded queue or a cancellable wait.

**Fix:** restrict registration; use cryptographically random invitations, quotas, bounded retries and an atomic setup transaction. Apply endpoint-specific request-size/time/rate limits. For browser frames reject overload promptly or keep one latest frame per camera, with a small global admission bound. Consider disabling browser webcams in the initial unattended HA package.

### S6 — Confirmed dependency advisories; reachability is qualified

**Evidence:** `firemex-model/requirements.txt:9` and `:23`; the installed environment also reports torch 2.5.1 and python-multipart 0.0.9.

- Torch 2.5.1 falls in the affected range of [GHSA-53q9-r3pm-6pq6](https://github.com/pytorch/pytorch/security/advisories/GHSA-53q9-r3pm-6pq6), involving malicious checkpoint loading. That specific advisory was fixed in 2.6.0. This is not evidence that an uploaded JPEG can execute code. No customer checkpoint-upload route was found.
- python-multipart 0.0.9 falls in the affected ranges of [GHSA-59g5-xgcq-4qw3](https://github.com/Kludex/python-multipart/security/advisories/GHSA-59g5-xgcq-4qw3) and [GHSA-pp6c-gr5w-3c5g](https://github.com/Kludex/python-multipart/security/advisories/GHSA-pp6c-gr5w-3c5g). These concern CPU exhaustion during multipart parsing; the latter was fixed in 0.0.27. The loopback listener, body limit and Go-generated multipart requests reduce external exposure.

**Fix:** select a currently patched, compatible Python/torch/torchvision/Ultralytics/FastAPI dependency set and recheck all advisories before release; the versions above are advisory-specific fixes, not a complete secure-version recommendation. Lock transitive dependencies and hashes, scan the image, and verify the model against an approved build manifest before loading. Computing a hash for reporting alone does not authenticate the model's origin. Test real checkpoint loading and inference after upgrades.

## Architecture and HAOS readiness findings

### A1 — Installation blocker: the package runtime does not exist

No app Dockerfile, S6 service tree, app `config.yaml`, `repository.yaml`, image-publishing workflow or `.dockerignore` was found in tracked source. Compose runs only HA Container and PostgreSQL; `start.sh` relies on the developer's Go, Node and Python tools and uses background processes without service supervision.

**Fix:** build one image containing the compiled Go binary, built Preact assets, pinned Python dependencies and approved weights, PostgreSQL and S6. Home Assistant Core itself belongs to HAOS and must not be bundled in FireMeX. Use a Python/ML-compatible Linux base and validate wheel availability for each target architecture. Do not assume the smallest Alpine base can install the selected ML wheels. Start database, then migrations/model readiness, then Go with dependency checks and graceful shutdown. Bake dependencies at build time.

Go and Python both read `PORT`; give each S6 service its own explicit value to avoid collisions. Introduce `/data` storage and appropriate service users. Expose only the Ingress web service; Python and PostgreSQL remain local. Follow [HA image guidance](https://contributors.home-assistant.io/apps/guides/dockerfile/).

### A2 — Installation blocker: production serving and Ingress paths are missing

**Evidence:** `frontend/vite.config.ts`, `frontend/src/api.ts:7`, `frontend/src/routes/index.tsx`, `backend/main.go`, `backend/controllers/incident.go:59`.

Vite's development proxy supplies routing that the Go server does not implement for production assets. The built HTML uses `/assets/...` and `/logo.png`; API defaults use `/api/...`; UI navigation uses `/FiremeX/...`; backend evidence URLs also start at `/api`. Under Ingress these root-relative URLs target HA rather than the app.

**Fix:** serve the production bundle from Go or an internal reverse proxy. Centralize a runtime base path derived from the trusted Ingress context, covering assets, API calls, images, redirects, router navigation and generated snapshot links. Provide SPA fallback only for UI routes; unknown APIs/assets must remain errors. Test a changing prefix and deep-link refresh. [HA documents the path and trusted proxy requirements](https://contributors.home-assistant.io/apps/guides/ingress/).

### A3 — Installation/onboarding blocker: no Supervisor access adapter

**Evidence:** `backend/config/config.go:74`, `backend/controllers/camera.go:60`, `backend/internal/cameras/snapshot.go:117`.

The default HA address is `localhost:8123` and requires `HA_TOKEN`. Inside a FireMeX app container localhost is FireMeX, not HA Core. There is no automatic `SUPERVISOR_TOKEN` handling.

**Fix:** in explicit HA package mode map the existing base URL convention to `http://supervisor/core` and use the Supervisor token, so existing `/api/...` paths reach the Core proxy. Retain explicit standalone configuration. Request `homeassistant_api: true` only for the implemented camera/notification features; protect this administrator-capable credential. Test image proxy endpoints as well as state discovery. [Official Core proxy documentation](https://contributors.home-assistant.io/apps/guides/communication/).

### A4 — Camera contract differs from the supplied master plan

The master plan proposes direct RTSP entry and persistent FFmpeg workers. Current source, and the existing November roadmap, instead use HA camera discovery and snapshots. `AddCamera` only stores an entity identifier, not a stream URL or camera password. It does not prove the entity exists, returns a decodable image, or supplies acceptably fresh frames.

**Recommended implementation order:** keep the current HA snapshot provider for the first internal package. Add authorized connection/preview validation, explicit unavailable states and documented compatibility. This avoids replacing an implemented subsystem solely for packaging. If the supplied plan's direct-RTSP customer workflow is required, implement it as a separate source provider with persistent workers, protected credentials, bounded reconnection and network-target validation before claiming that requirement complete.

Snapshot `ReceivedAt` is local receipt time, not camera capture time (`backend/internal/cameras/snapshot.go:75`). Repeated successful HTTP responses may contain stale upstream images. Preserve this distinction in health and evidence, and test outage/freeze behavior with each supported HA camera integration. Identical image hashes cannot by themselves distinguish a frozen stream from a static scene.

### A5 — High reliability: one slow operation delays other cameras

**Evidence:** `backend/internal/detection/worker.go:196`, `:219`, `:256`, `:272`.

Scheduling is intentionally fair and serial, which bounds normal inference work, but snapshot fetch, inference and incident persistence all run in the same sequential job. A camera request can consume its 10-second timeout; a model request can consume 15 seconds; database retries can add more delay. Other cameras wait. The two-second configuration is a target interval, not a per-camera service guarantee. Browser frames can also wait behind the common mutex. There is no explicit maximum-frame-age rejection before inference/persistence.

**Fix:** first measure target hardware. Decouple bounded camera acquisition from inference with one latest-frame slot per source, deadline-aware admission and stale-frame rejection. Keep inference concurrency small and measured. Move delivery/persistence retries out of the shared sampling path where safe, preserving idempotency and camera-disable checks. Verify an offline source cannot monopolize the sampling budget and report capacity/freshness violations.

The existing four-source fixture test passes, but it does not establish four-real-camera throughput on AMD64 HAOS.

### A6 — Customer-use blocker: alerts do not leave the FireMeX UI

**Evidence:** `backend/internal/incidents/store.go:105`, `frontend/src/components/incidents/AlertToastHost.tsx:13`.

An incident creates a PostgreSQL alert row. The frontend polls and shows toasts only while visible; no HA service/event sender or durable delivery queue was found. Closing the browser does not stop HA-source inference, but it removes this notification surface.

**Fix:** persist an outgoing-notification record in the incident transaction, then deliver independently with retry/backoff and a stable incident-based notification ID. Implement HA persistent notifications, a user-configured optional mobile target, test-notification UI and visible failed-delivery state. Queue through HA restarts. An HTTP success is not proof that a phone displayed a notification; test receipt. Add monitoring-outage notifications as well as hazard notifications.

### A7 — High: health, failure recovery and incident behavior need completion

**Evidence:** `backend/controllers/system.go:29`, `backend/main.go:86`, `backend/internal/detection/worker.go:301`, `backend/internal/incidents/store.go:75`, `backend/controllers/incident.go:253`.

- Settings always reports detection as “Not connected yet”; `/ping` only reports a responsive API. Per-camera status is much better, but these views are inconsistent and there is no package readiness endpoint.
- Failed incident persistence retries three times then increments an in-memory lost-result count. There is no durable fallback; restart loses that diagnostic state.
- A single positive frame creates an unconfirmed incident. Cooldown prevents rapid duplication, but a sustained detection can create a new incident every cooldown even if an earlier one remains open. There is no temporal verification or explicit false-alarm/re-escalation policy.
- Only the original acknowledger can update an incident. If that operator is revoked or unavailable, another admin cannot take over through the current API.

**Fix:** expose real process/readiness/dependency health, bounded health timeouts, last successful analysis and durable failure diagnostics. Define a bounded fallback for critical metadata where feasible. Add reviewed candidate/escalation rules and false-alarm handling without blindly adding alert delay. Deduplicate against active incidents and explicitly define re-alert behavior. Add audited reassignment/admin takeover. Resolution must continue to leave monitoring enabled.

### A8 — Upgrade/restore blocker: persistent lifecycle is not packaged

**Evidence:** `backend/config/config.go:66`, `backend/main.go:44`, `backend/internal/incidents/retention.go`.

The data directory defaults to the process working directory, while PostgreSQL uses a separate Compose volume. Schema changes use startup `AutoMigrate` and repeated backfills, without a recorded migration/rollback contract. Evidence has retention, but incident, alert and response-history rows grow indefinitely. There is no HA backup/restore or PostgreSQL-major upgrade workflow.

**Fix:** define `/data/postgresql`, `/data/evidence` and persistent secret/config paths with ownership and permissions. Initialize a cluster only when genuinely absent; refuse incompatible major versions rather than recreating it. Keep PostgreSQL 15 initially unless an explicit tested migration changes it. Introduce ordered schema migrations and prior-version upgrade fixtures. Use a consistent initial cold-backup policy and test restore into a clean installation; document monitoring downtime. Define metadata retention/archival and disk-pressure behavior. HA's [backup settings](https://contributors.home-assistant.io/apps/reference/configuration/) distinguish cold and hot backups.

### A9 — Customer-release blocker: known model limitations and redistribution evidence

`firemex-model/README.md` describes the model as not production-accurate and reports fire recall around 0.22 on its validation data. `docs/supervisor-demo-progress.md:67` onward records two historical fire-video webcam trials that did not correctly detect fire. Today's stub contract tests do not change these results. These figures must not be generalized into real-world accuracy estimates.

**Fix:** obtain the approved model/version, data provenance, evaluation set and redistribution permissions from the model owner. Validate representative independent CCTV fire, smoke and nuisance footage, reporting event-level misses, false alerts and onset delay on supported hardware. Do not silently reduce thresholds to make a demo pass. Keep internal testing clearly experimental and avoid wording that presents an AI suspicion as a confirmed fire.

No tracked LICENSE/NOTICE files were found. Confirm the exact model and software distribution terms and add required notices/source artifacts before publishing. Ultralytics describes [AGPL and Enterprise licensing paths](https://www.ultralytics.com/license); this audit does not determine the project's legal obligations or assume that REST isolation changes them.

### A10 — Release blocker: CI builds but does not enforce the relevant checks

`.github/workflows/ci-cd.yml` builds Go and the frontend and can trigger a separate QA repository. It does not itself run Go tests, provision a test DB, run Python contracts, build a HA image, scan dependencies/images, verify model hashes or publish versioned images. No claims are made about the separate QA repository, which was not inspected. Its configured branch triggers also do not include the current `firemex-backend` branch.

**Fix:** add explicit test jobs and a disposable PostgreSQL service; make skipped integration tests visible/failing in the release job. Build architecture-specific images, run startup/persistence checks and generate dependency/model provenance. Publish the image before changing the app catalog version. Test anonymous image pull and installation from a second clean HAOS instance.

## Runtime configuration and persistence contract

Existing names should be retained where possible; values below are proposed package settings, not implemented behavior.

| Area | Existing settings | Package requirement |
|---|---|---|
| Go web service | `PORT` default 8080 | Internal Ingress port, explicit per-service setting |
| HA connection | `HA_URL`, `HA_TOKEN` | Explicit Supervisor mode and protected token; preserve standalone mode |
| Database | `DATABASE_DSN` or `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSLMODE` | Local-only restricted DB role; generated credential; persistent cluster |
| App storage/auth | `FIREMEX_DATA_DIR`, `JWT_SECRET` | `/data`; protected stable secret or HA identity mapping |
| Browser access | `CORS_ORIGINS` | Same-origin Ingress plus deliberate standalone policy |
| Acquisition | `SNAPSHOT_TTL_MS`, `DETECTION_INTERVAL_MS` | Measured sampling bounds and source freshness status |
| Inference | `MODEL_URL`, `MODEL_TIMEOUT_MS`, `DETECTION_ENABLED` | Loopback :8100, readiness and bounded admission |
| Decision thresholds | `FIRE_CONFIDENCE_THRESHOLD`, `SMOKE_CONFIDENCE_THRESHOLD`, `INCIDENT_COOLDOWN_SECONDS` | Validated versioned policy; meaningful defaults |
| Evidence | `EVIDENCE_RETENTION_DAYS`, `EVIDENCE_MAX_BYTES` | `/data/evidence`, tested retention and disk-full behavior |
| Python | `MODEL_PATH`, `CONFIDENCE_THRESHOLD`, `PORT` | Immutable approved weights; explicit independent port |

Current default sampling interval is 2 seconds, snapshot cache TTL 200 ms, model timeout 15 seconds, incident cooldown 60 seconds, evidence retention 7 days and evidence budget 1 GiB. These are defaults, not measured capacity guarantees. Keep writable ML caches in controlled temporary/cache directories; do not let model libraries require an unwritable service home directory.

## Implementation sequence for the immediate goal

| Order | Work | Completion evidence |
|---|---|---|
| 1 | Fix S1/S2, lock down database defaults, select HA identity/installation ownership model | Negative authorization tests, numeric-ID tests and failed-write handling |
| 2 | Define runtime paths, ports, supported architecture and patched ML dependencies | Reproducible Linux dependency install and model startup; no runtime downloads |
| 3 | Serve production UI and add Ingress base-path/identity plus Supervisor API adapter | UI/API/images/deep links work behind a test prefix; untrusted identity headers rejected |
| 4 | Build the single S6 image with persistent PostgreSQL, Python and Go | Fresh `/data` startup, restart, dependency recovery and persisted settings/evidence |
| 5 | Add local HA app metadata and install in a real HAOS VM/device | Install → Open Web UI → authorize a validated camera → background analysis with page closed |
| 6 | Finish HA alerts, real health, fresh-frame scheduling and incident response gaps | Notification receipt, outage recovery, owner takeover and overload/failure tests |
| 7 | Test backup/restore, prior-version migration and four-source soak; complete model/license evaluation | Clean restore, no silent data loss, documented operating limits and model limitations |
| 8 | Publish versioned image and custom repository with onboarding documentation | Second clean HAOS installation succeeds without terminal or separate service setup |

Steps 1–5 define the first internal installable milestone. Steps 6–8 and the relevant security/model gates are needed for the supplied customer outcome. Direct RTSP onboarding is an additional explicit deliverable if HA camera import does not satisfy the intended customer workflow.

Do not undertake a framework rewrite, database replacement or new live-video player to achieve packaging. The immediate engineering work is a deployment adapter plus targeted security and reliability fixes around the existing application.
