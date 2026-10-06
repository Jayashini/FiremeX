# FireMeX Current State Analysis

Audit date: 5 October 2026. Repository baseline: `fe2a794`, including the existing working-tree change to the PostgreSQL host port in Docker Compose.

FireMeX currently has a local account-management and Home Assistant camera-viewing application, plus a separate fire/smoke inference service. It does not yet have an operating camera-to-detection-to-alert pipeline or the packaging and licensing needed for a paid Home Assistant product. The existing technologies are suitable to continue with; a wholesale rewrite is unnecessary.

The immediate priority is security: unsafe database lookups, unrestricted creation of installation administrators, and incomplete revocation enforcement undermine the existing access boundaries. The next product milestone after stabilization is one real camera producing a persistent, reviewable detection event.

## Audit scope and verification

Reviewed the Go entry point, every backend controller, model, middleware and configuration module; frontend routing, sessions, pages and shared components; Python inference, annotation and video utility; dependency manifests; Compose and startup scripts; Home Assistant configuration; CI workflow; shell checks; Markdown documentation; the text of both Word documents; and model evaluation images. Runtime secrets were not reproduced. Generated dependencies and Home Assistant's private account database were not treated as application source.

Verification performed:

| Check | Result | What it establishes |
|---|---|---|
| Frontend `npm run build` | Passed | TypeScript and production asset build succeed in the available environment. |
| Backend `go test ./...` | Passed; every package reports no test files | Packages compile. This is not evidence of passing behavioral tests. |
| Python source parsing | Passed for all three scripts | Syntax is valid. |
| Annotation helper | Passed | Produces a decodable 640 × 480 JPEG and preserves the input image. |
| Model checksum | Matches README | Supplied weights have SHA-256 `2ab009042ba04827ee1cd1ccb0648832577677334c5fe4927e7c7950f7406c89`. |
| Shell syntax checks | Passed | Shell startup and test scripts parse. |
| GORM database-free query reproduction | Confirmed unsafe SQL construction | A crafted string ID can change the WHERE expression and escape the intended organization predicate. No exploit was executed against the database. |

The application was not exercised end to end against live cameras or customer data. The supplied integration scripts create records in the development database and were inspected, not executed. Actual ML inference was not rerun: the inspected environment has no project virtual environment, and the bundled Python lacks Torch, Ultralytics and FastAPI. No dependency vulnerability scan or complete Git-history secret scan was performed. The separate QA repository is not included. The proposal's external Google Drive architecture diagram could not be retrieved.

No application source was changed. The existing Compose modification was preserved. This analysis is the only new repository document; frontend verification regenerated ignored build output.

## 1. Current architecture

```text
CUSTOMER/DEVELOPER MACHINE — current development arrangement

Browser: Preact dashboard, normally served by Vite :5173
    │ same-origin HTTP requests through Vite's development proxy
    ▼
Go/Gin API :8080
    ├── JWT authentication + admin checks
    ├── organization/user/profile management
    ├── organization-scoped camera records
    │       ↕ GORM
    │   PostgreSQL 15 container
    │   host :5433 → container :5432 in this working tree
    │
    └── Home Assistant client + shared snapshot cache
            │ server-side HA bearer token
            ▼
        Home Assistant Container :8123
            ▼
        camera entities → configured CCTV/IP/demo cameras

Optional webcam development path:
webcam → ffmpeg → MediaMTX RTSP → Home Assistant

SEPARATE COMPONENT — no caller in the Go application

Manual HTTP caller → Python/FastAPI :8100 /detect
                         ▼
                  YOLOv8/PyTorch weights
                         ▼
               fire/smoke boxes + confidence
               optional annotated JPEG in base64

UI-only data:
Dashboard risk/incidents + Incidents page + Alerts page
    → hardcoded fixtures and browser component state

Incident model → included in startup AutoMigrate
    → no incident controller, writer, worker or frontend API connection
```

The browser's apparent live video is a sequence of snapshots, not the Python model inspecting a continuous stream. Each image waits for the previous request to finish, then schedules another after 200 ms. The backend caches each camera for 200 ms and shares one in-flight upstream snapshot across viewers. This is useful existing load control and should be retained.

Home Assistant discovery calls `/api/states`; snapshots call `/api/camera_proxy/<entity>`; a separate MJPEG proxy calls `/api/camera_proxy_stream/<entity>`. The dashboard uses snapshots. Actual compatibility depends on whether the configured Home Assistant camera integration provides usable images; the documentation's universal compatibility claim has not been established.

The model loads once at Python service startup. Nothing in the backend calls `/detect`, checks that service's real health, or starts a detector loop. The `ai_enabled` flag is stored and displayed only.

Evidence: [backend entry point](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go:17), [camera implementation](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go:56), [camera tile](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/components/common/CameraFrame.tsx:27), [inference service](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/detect_service.py:60), [Compose](/Users/esanduepa/Desktop/Projects/FiremeX/docker-compose.yml:1).

## 2. What is already built

Status describes the requested product feature, not simply whether a file exists. “Partial” can include substantial working development functionality. No product-wide component has enough validation to be called production-complete.

| Component | Status | What exists |
|---|---|---|
| Home Assistant add-on | Not started | Home Assistant Container and embedding instructions exist; no FireMeX add-on manifest, image, ingress or Supervisor setup. |
| Camera integration | Partial | Discovery, save/list/delete, snapshots, MJPEG proxy and shared snapshot cache. No update endpoint, real monitoring state or validated camera limits. |
| AI detection | Partial | Supplied YOLO weights, FastAPI inference, image annotation and a manual image/video runner. Not connected to cameras or incidents. |
| Backend | Partial | Gin routes, accounts, organizations, profiles, camera APIs and dependency status. Core detection, incident, notification and commercial APIs absent. |
| Frontend | Partial | Preact admin/operator layouts; real login, registration, users, settings, profile and camera calls. Incident/alert workflows are previews. |
| Licensing | Not started | No license model, signature verifier, activation route, entitlement enforcement or cloud issuer. JWT is session authentication only. |
| Subscriptions and payments | Not started | Business plan describes them; no provider integration, webhook, billing record or renewal logic. |
| Website | Not started | Current frontend is the local operations console; no public product, pricing, checkout or customer portal implementation. |
| Authentication | Partial | bcrypt, signed 24-hour JWTs, HttpOnly camera cookie, role checks, operator approval. Critical/high access defects remain. |
| Incidents | Partial | Rich GORM model registered for migration; UI mock workflow. No real create/read/update/snapshot endpoints. |
| Alerts | Partial | Preview history and local acknowledgement controls. No generation, persistence or delivery implementation. |
| Database | Partial | PostgreSQL/GORM models for Organization, User, Camera and Incident. No versioned migrations, backup/restore process or notification/license tables. |
| Docker | Partial | Compose runs Home Assistant and PostgreSQL only. No Dockerfile or container service for Go, frontend or Python. |
| Deployment | Partial | Manual development startup and external QA dispatch. No self-contained install, release images, update/rollback or production serving config. |
| Testing | Partial | Three shell integration scripts and annotation self-test. No Go test files, frontend test runner or detector/pipeline test suite. |
| CI/CD | Partial | GitHub Actions builds frontend/backend, then dispatches to another repository on main pushes. No Python checks, integration test job or verified release deployment here. |

Accounts, organization edits, password changes and camera metadata are backed by API code, rather than fixtures. They remain subject to the defects below.

Additional evidence: [account/profile handlers](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/me.go:76), [organization handlers](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/organization.go:15), [user handlers](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go:17), [incident model](/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/incident.go:45), [CI workflow](/Users/esanduepa/Desktop/Projects/FiremeX/.github/workflows/ci-cd.yml:1).

## 3. What is partially built

**Camera management.** Camera entity IDs, labels, zones and AI preference persist. Missing are verified entity selection, duplicate prevention, a camera edit/AI-toggle endpoint, reliable online/offline status, and an authorized preview for cameras not yet added. The Add Device preview currently calls a snapshot route that requires a saved camera record, so a genuinely new camera gets 404 until it is added.

**ML inference.** The API returns `hazard`, labels, confidence and boxes, and optionally an annotated image. Missing are request limits, protected service exposure, inference scheduling, bounded concurrency, deployment packaging, reproducible evaluation and the caller that supplies camera frames. Confidence is a model score, not a calibrated probability that a fire exists.

**Incidents.** The model already stores organization/camera IDs, historical camera name and zone, fire/smoke class, confidence, detection JSON text, a hidden evidence-file path, status, resolution/blocker notes and resolver/time. It also computes a reference and snapshot-availability flag and defines organization/time and camera/time indexes. Preserve these useful pieces. No code writes real incidents, serves evidence or applies status transitions. The status helper is currently unused.

**Dashboard and alerts.** Dashboard camera count comes from the API, while risk level, alert count and recent incidents are fixtures. Incidents can be filtered and marked resolved in component memory; those changes disappear on remount/reload. Alerts can be acknowledged in component memory. Several time filters and pagination controls do not affect the returned rows. Preview banners correctly identify sample data on these three pages.

**Authentication and operations.** Registration, login, profile edits and team approval have real APIs. Missing protections include active-status enforcement on existing sessions, safe installation bootstrap, login throttling, production transport/session settings and stronger validation. Password changes and logout deliberately do not revoke already-issued JWTs.

**Deployment and health.** Database and HA checks exist. Detection status is hardcoded to “Not connected yet.” There is no ready-to-install FireMeX service definition. The CI dispatch is a request to an external repository, not proof that deployment succeeded.

## 4. What has not been built

- Background monitoring independent of open browser tabs; inference client; fair camera scheduling; repeat-detection confirmation; cooldown/deduplication; stale-frame handling; fire/smoke severity policy.
- Real incident APIs, evidence-file persistence and retention, human confirmation/false-alarm handling, audit history and concurrent-update rules.
- Persistent alert records, delivery attempts, retries, acknowledgement synchronization, local HA notifications/events/entities, SMS, email or push integrations.
- Activation UI, license service, asymmetric signing/verification, device binding, plan limits, renewal, revocation and offline/grace behavior.
- Public marketing site, cloud customer accounts, checkout, billing webhooks and customer license management.
- Installable HA package, persistent service supervision, production frontend hosting, release images, update and recovery mechanisms.
- Reproducible model training/evaluation assets: no dataset/split manifest, training script, training run configuration or independent test set is supplied.
- Production observability, restore testing, capacity benchmarks and comprehensive automated tests.

Email password recovery files are empty. Current scope explicitly excludes email password reset, NVR recording, PTZ and multi-site management; do not expand the next milestone to include those. The older proposal mentions sensors and broader hazards, but no sensor-fusion implementation exists and it is outside the current fire/smoke focus.

## 5. Existing technology stack

| Layer | Actual implementation |
|---|---|
| Frontend | Preact 10, TypeScript 6, Vite 8, Tailwind CSS 4; custom History API router. Not React despite the compatibility aliases. |
| Backend | Go module specifies 1.26.5; Gin, GORM, PostgreSQL driver/pgx, godotenv, gin-contrib/cors. Available Go toolchain is also 1.26.5. |
| Database | PostgreSQL 15 Alpine in Compose. HA also has its own runtime SQLite database; that is not FireMeX's application database. |
| ML | YOLOv8n described by model documentation; Ultralytics 8.2.0, Torch 2.5.1, torchvision 0.20.1, OpenCV 4.9.0.80, Pillow 10.4.0 declared in requirements. |
| Inference HTTP | FastAPI 0.111.0, Uvicorn 0.29.0, multipart image upload. Declared dependencies were not reinstalled or executed as a full service in this audit. |
| HA integration | HTTP REST and camera proxy endpoints, configured HA URL and long-lived token. No custom integration or Supervisor-aware add-on code. |
| Authentication | bcrypt password hashes; HS256-issued JWTs; bearer header or SameSite Strict HttpOnly cookie; token also stored in localStorage. |
| Configuration | Central Go configuration; environment variables and optional backend .env; generated installation JWT secret when none supplied. |
| Streaming tools | Optional ffmpeg and MediaMTX for the developer webcam. Not part of the core inference pipeline. |
| Commercial licensing | None. The local JWT signing secret is not a commercial license key. |
| Payments | None; provider has not been selected in code. |
| Deployment | Docker Compose for dependencies; separately launched development processes. |
| CI/CD | GitHub Actions frontend/backend build jobs; repository_dispatch to QA-FiremeX using a GitHub secret. |

Evidence: [frontend manifest](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/package.json:1), [Go module](/Users/esanduepa/Desktop/Projects/FiremeX/backend/go.mod:1), [Python requirements](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/requirements.txt:1), [configuration](/Users/esanduepa/Desktop/Projects/FiremeX/backend/config/config.go:56).

## 6. Current user flow

The following is implemented in code, assuming the developer starts and correctly configures the dependencies; it is not a fresh end-to-end certification of this machine.

```text
Developer starts HA + PostgreSQL, Go API and Vite
    ↓
Configure HA access token and database connection
    ↓
Register an organization and its first administrator
    ↓
Sign in → administrator dashboard
    ↓
Discover HA cameras → save entity, name, zone and AI preference
    ↓
View repeated camera snapshots in Live Feed
    ↓
Manage team requests, profile and organization settings
```

Operators register using a join code, wait for approval, then sign in to the read-only camera-management view, their profile and the preview Incidents page. An admin can approve, deny or mark an operator revoked, although existing-session revocation is broken.

There is no purchase or activation gate. Enabling AI does not start detection. Opening Incidents or Alerts displays sample records, not activity from the cameras. Separately, a developer can start the Python service and send an image manually, or use the image/video utility with an installed ML environment.

## 7. Target user flow

```text
Discover FireMeX → website → cloud customer account
    ↓
Choose plan → payment verified by backend webhook
    ↓
Receive activation key/license access
    ↓
Install FireMeX Home Assistant add-on
    ↓
Secure first-run setup → activate installation
    ↓
Verify signed entitlement → establish local organization/admin
    ↓
Select HA camera entities and monitoring settings
    ↓
Background worker samples cameras even with no browser open
    ↓
Local model detects fire/smoke → detection policy confirms event
    ↓
Persist unconfirmed event and evidence → notify operators
    ↓
Operator reviews, confirms or dismisses → incident response/history
```

Renewal refreshes the signed entitlement without reconfiguring cameras. A temporary cloud outage follows an explicit offline policy and is displayed separately from camera or detector failure.

There is a naming conflict to settle before building incident APIs: current scope/model README say “detection → alert → human confirmation → incident,” but the Incident model calls machine reports unresolved incidents. Keep the existing storage model if useful, add an explicit review state, and label machine reports unconfirmed in the UI. A human-confirmation policy must not delay the initial warning to operators.

The proposed NORMAL/POSSIBLE_SMOKE/etc. ladder is not implemented. Fire can appear without a preceding smoke stage; use detection class, severity, review state and system health as separate concepts rather than forcing every event through one linear ladder.

## 8. Gap analysis

| Current FireMeX | Required bridge | Target FireMeX |
|---|---|---|
| Anyone can register a local organization/admin | Authorized, one-time installation setup | One customer site with controlled ownership |
| Shared HA connection with camera-row filtering | Installation ownership plus validated camera selection | Only authorized site users see site cameras |
| Camera snapshots and saved AI flag | Background scheduler and inference client | Monitoring independent of dashboard use |
| Per-image model answers | Temporal rules, freshness, deduplication, measured thresholds | Reviewable warnings with controlled noise |
| Incident schema and mock page | Persistence, evidence API, review actions and audit trail | Shared, durable incident handling |
| Mock alert history | Notification records, delivery and acknowledgement | Operators actually receive warnings |
| Developer-operated processes | HA package, supervisor, persistent storage, health checks | Installable and recoverable local product |
| No commercial backend | Customer/payment/license services | Purchase, activate and renew |
| Session JWT secret | Separate cloud signing key and local public-key verification | Offline-verifiable commercial entitlement |
| Build-only CI and manual scripts | Isolated integration, model and release checks | Evidence that releases work and preserve access boundaries |

The missing center is the detection-to-event pipeline. The highest-priority existing defects are in the access boundary that pipeline will inherit.

## 9. Problems in the existing project

Severity reflects impact if used by real organizations. It is not a CVSS score. Critical findings below are application-level security defects; the absence of an entire planned feature is reported separately above.

### Critical

**C1 — String route IDs can become SQL conditions.** User approve/deny/revoke and camera deletion pass `c.Param("id")` directly to `First(&record, id)`. GORM treats some nonnumeric strings as SQL expressions, not bound primary-key values. A database-free reproduction with the repository's dependencies generated a WHERE clause whose injected OR bypasses organization filtering. This can select another organization's record before a subsequent mutation. Admin authentication reduces neither the public-registration route to admin access nor the need to validate IDs. Parse a positive integer and use a parameterized ID predicate. The finding is confirmed at query construction; live exploitation and full database consequences were not tested. Evidence: [user.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go:49), [camera.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go:182). [GORM's security guidance](https://gorm.io/docs/security.html) explicitly documents this unsafe inline-condition pattern.

**C2 — Public organization registration grants access to shared HA cameras.** A reachable unauthenticated caller can create an organization/admin, log in, discover all camera entities from the installation-wide HA connection, add an entity to their organization and then request its snapshot. Camera records are organization-scoped, but the underlying camera can be enrolled again by that new administrator. This defeats the intended surveillance access boundary without needing C1. Enforce owner-authorized first-run setup and close organization bootstrap afterward. Preserve organization columns; do not redesign as a shared multi-customer server. Evidence: [public registration routes](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go:68), [admin creation](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/organization.go:60), [discovery](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go:56), [camera creation](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go:120).

### High

**H1 — Revocation does not stop existing sessions.** Login checks pending/revoked, but JWT middleware, current-user lookup and admin middleware never require `status == active`. Cache invalidation only reloads the revoked row; it does not deny it. An operator's token can therefore continue accessing camera/profile APIs until expiration, and an existing MJPEG connection is not reauthorized during streaming. Add central active-user enforcement and define bounded revocation latency for long-running streams. Evidence: [JWT middleware](/Users/esanduepa/Desktop/Projects/FiremeX/backend/middleware/authMiddleware.go:38), [user lookup](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/helpers.go:80), [revocation](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go:96).

**H2 — Live Feed implies protection that is not running.** Every listed camera is assigned Normal, rendered Online, and can display “AI monitoring” solely because its saved preference is true. These labels do not depend on successful snapshots or detector operation. A failed image can show “No signal” while the surrounding tile remains Online. Use explicit camera and detector health, last successful sample time, and “not connected” until inference really runs. Evidence: [Livefeed](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Livefeed.tsx:45).

**H3 — Unsafe deployment defaults.** Compose publishes PostgreSQL on all host interfaces with a known development password. The default application DB role is the initialization user, rather than a restricted runtime role. The example JWT secret is a predictable string that configuration accepts without validation. Session cookies always use `secure=false`; there is no production HTTPS ingress/proxy config. These are development settings, not a ready customer deployment. The actual local JWT secret is not the example string and is at least 32 characters; no actual secret is disclosed here. Evidence: [Compose](/Users/esanduepa/Desktop/Projects/FiremeX/docker-compose.yml:14), [example settings](/Users/esanduepa/Desktop/Projects/FiremeX/backend/.env.example:13), [cookie creation](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/auth.go:82).

**H4 — No abuse limits on authentication or inference.** Login/registration lack throttling and request-size controls. The Python service listens on all interfaces without authentication, reads an entire uploaded image and runs expensive computation. Anyone who can reach it can consume resources. Bind inference privately and enforce upload/pixel limits, concurrency limits and timeouts; add login/registration throttling. This is especially relevant when all services share HA hardware. Evidence: [inference endpoint](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/detect_service.py:78).

**H5 — Model quality does not support production claims.** README reports precision 0.53, recall 0.35 and fire recall around 0.22. The supplied PR image reports mAP@0.5 of 0.283 rather than README's 0.27; the matrix shows approximately 0.24 for fire and 0.55 for smoke on the diagonal. These may be different evaluations, but the provenance is missing. Do not reinterpret them as field performance. Establish a versioned evaluation dataset and measure missed events, false alerts per camera-hour and detection delay. Evidence: [model README](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/README.md:1), [PR curve](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/PR_curve.png), [confusion matrix](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/confusion_matrix.png).

**H6 — Commercial dependency rights are unresolved.** Ultralytics is used directly; no commercial license evidence or complete dataset-rights record is supplied. Paid software is not automatically incompatible with AGPL, but proprietary distribution needs an appropriate compliance/licensing decision. Ultralytics states that its enterprise option covers proprietary embedding and addresses trained models. Simply exporting to ONNX or changing the runtime is not enough to assume the model's obligations disappear. Resolve code, weights and dataset rights before sale. [Official Ultralytics licensing terms](https://www.ultralytics.com/license).

### Medium

| Finding | Evidence and consequence | Focused correction |
|---|---|---|
| Organization creation is not atomic | `RegisterOrganization` inserts the organization before hashing/creating the admin; documentation claims a transaction. Hash failure can leave an orphan. | Hash first; wrap database writes in a transaction. |
| Join codes have only 900 possible values | `ORG-100` to `ORG-999`, `math/rand`, collision loop without a retry bound; approval still gates operators, but enumeration/spam and exhaustion remain. | Stronger random codes, bounded retries, DB uniqueness and throttling. |
| DB failures can be reported as success | User mutations ignore Save/Delete errors; list handlers ignore Find errors. | Check errors and affected rows; return appropriate failures. |
| Camera inputs are weakly validated | Any nonempty entity ID/name accepted; no uniqueness constraint or camera edit route. | Validate entity syntax/existence/permission and enforce intended uniqueness with soft-delete behavior considered. |
| New-camera preview cannot work normally | AddDevice calls the saved-camera-only snapshot endpoint before saving. | Provide a narrowly authorized discovery preview; keep operator snapshot ownership checks. |
| Failed camera deletion disappears locally | Livefeed filters its state even if the request fails or returns a non-2xx response. | Update state only after success and show the failure. |
| Inference blocks the async request handler | Synchronous `model(...)` runs inside `async def detect`. Multiple cameras can stall API responsiveness. | Use a bounded serialized inference worker or measured worker arrangement; avoid unbounded parallel calls on the shared model. |
| Threshold control has two stages | The request threshold is applied after model prediction; it is not passed to `model(...)`. Candidates discarded by the model's own default cannot be recovered with a lower requested cutoff. | Pass validated thresholds into prediction and document one effective policy. |
| Snapshot load still grows | Browser requests and camera-ownership DB lookups scale with viewers, even when upstream HA images are shared. Future `FetchSnapshot` callers would bypass the existing cache. | Share a camera service between UI and detector; benchmark and bound sampling before promising camera counts. |
| Incomplete cancellation/resource bounds | HA requests are not tied to caller cancellation; streaming reads can block; HTTP server lacks configured timeouts/graceful shutdown. Snapshot limit truncates excess bytes instead of reporting oversize. | Context-aware calls, stream cleanup and explicit size/time limits. |
| JWT/session hardening incomplete | HMAC-family verification rather than exact HS256 allowlist; expiry is not explicitly required; no issuer/audience policy; bearer token also in localStorage. No XSS was demonstrated. | Tighten claim validation; choose a consistent same-origin session strategy; define password-change/session invalidation behavior. |
| No durable incident audit guarantees | Omitting DeletedAt does not prohibit GORM hard deletes; ordinary DB credentials can still modify rows. No event history or DB constraints for workflow/class/confidence. | Add application/DB rules and transition history; do not describe the current table as immutable. |
| HA ingress and LAN deployment unresolved | Absolute `/api`, `/FiremeX` and `/logo.png` paths; no ingress-prefix handling. Cross-origin API mode lacks credentialed login/logout fetches needed for camera cookies. | Prefer same-origin serving and test dynamic ingress paths explicitly. |
| Compose/docs port drift | Working tree maps 5433; defaults/example/tests still assume 5432. Local ignored .env already sets 5433. | Align examples and isolated test configuration; preserve the existing user change. |
| Test scripts are not isolated | Run a test server but write to the development database, leave records, share port 8099 and depend on invocation/environment details. | Provision disposable test databases and assert security negative cases. |
| CI does not verify behavior | No tests or Python job; dispatch curl lacks HTTP-failure handling and no downstream completion check exists here. | Run relevant tests and fail on dispatch rejection; track release completion separately. |
| Persistence/recovery are incomplete | AutoMigrate only; no upgrade/rollback, evidence retention, backups, restore or disk-full policy. | Add versioned migrations and tested recovery before shipping. |

### Low

- Root README still says there is no backend and login is unenforced. Home Assistant setup starts npm from the wrong directory. User-management docs overstate revocation and transactions. Scope says no incident DB model even though one is now migrated.
- The model README says not to commit weights, but the weights are tracked. Choose and document a versioned model-delivery strategy; there is no need for destructive history rewriting as part of this audit.
- Empty password/404/button files, unused scaffold assets and repeated navigation/form patterns are cleanup work, not reasons to replace the frontend stack.
- `try_model.py` selects the frame with the most boxes, not the strongest confidence, and says “no frames read” when it read a video without qualifying detections. Sub-one FPS input can produce a zero sampling step.
- API JSON mixes GORM fields such as `ID`/`CreatedAt` with explicit lowercase response fields. Standardize incrementally when adding endpoints.

Tracked-file inspection did not find the actual backend .env, MediaMTX private config, generated TLS private key or HA credential storage in the current Git index. Those files do exist locally where applicable; sharing the entire workspace rather than tracked source can still disclose them. This is not a certification of repository history.

## 10. Recommended final architecture

Preserve Preact, Go/Gin, GORM/PostgreSQL, the HA-first camera boundary and a separate Python inference process. Separate the cloud commercial system from the local operational system.

```text
FIREMEX CLOUD — new

Customer → website/customer authentication → checkout provider
                                             │ verified webhook
                                             ▼
                           subscription and license service
                              ├── customer/subscription DB
                              └── protected private signing key
                                             │ HTTPS activation/refresh
                                             ▼
CUSTOMER SITE — extend existing implementation

Home Assistant OS / Supervisor
    ├── configured camera entities
    └── FireMeX app/add-on
          ├── Preact UI + same-origin Go API
          ├── local accounts + authorization + installation ownership
          ├── license verifier with public keys only
          ├── shared HA camera/snapshot service
          ├── bounded background monitoring scheduler
          │       ↕ private HTTP
          │   Python inference process + versioned model
          ├── detection policy → event/incident service
          │                       ├── local PostgreSQL
          │                       └── evidence files
          └── alert delivery worker → local UI + HA notification/event

No camera frames need to pass through FireMeX cloud.
```

**Local service boundaries.** Introduce a small shared camera package instead of having a worker import HTTP controllers. Controllers, background monitoring and snapshot caching should call that package. Keep the current model API contract and extend it with model version and timing. Start with one bounded inference consumer and configurable per-camera sampling; derive supported capacity from measurements. Drop obsolete frames rather than building a growing queue. Use per-camera freshness and cooldown state and a persistent event ID for deduplication.

**Incidents and notifications.** Persist event/evidence metadata before delivery. Use a local database delivery/outbox table so restarting after a failed notification does not lose it; an external message broker is unnecessary initially. Make acknowledgements and state transitions shared across users, with an audit history. Store evidence separately from the database with authenticated access and retention rules. Start with short polling or server-sent events for UI updates; continuous recording is outside scope.

**HA packaging.** Target Home Assistant OS for the primary add-on distribution. Official documentation now calls add-ons “apps”; Container does not include their installation support. The repository's reference to Supervised as another current supported path should be updated. [Home Assistant installation documentation](https://www.home-assistant.io/installation/).

Use `homeassistant_api: true` and the supplied `SUPERVISOR_TOKEN` with the Core API proxy in the add-on environment; preserve explicit URL/token configuration for development. Do not request broad Supervisor management privileges just to fetch camera images. [Official app communication documentation](https://developers.home-assistant.io/docs/apps/communication/).

Serve built frontend assets and the API through one origin, support the ingress base path, and restrict ingress access as required. Keep local FireMeX operator roles initially; HA ingress authentication alone does not establish FireMeX organization/role permissions. [Ingress requirements](https://developers.home-assistant.io/docs/apps/presentation/).

For a genuinely single-install first release, package the Go process, Python worker and locally managed PostgreSQL as supervised processes in the add-on image, with persistent data under `/data` and coordinated backup/shutdown hooks. This preserves PostgreSQL but adds packaging responsibility and resource cost. Validate this on HA OS before promising low-end hardware support. A separately managed PostgreSQL dependency is an alternative for an installer-led edition, not an assumed built-in HA service. Start with one measured hardware target, then add other architectures; do not promise every Raspberry Pi configuration.

### Licensing design

There is no existing commercial license implementation to preserve. Preserve the installation-specific JWT secret for sessions, but never use it to issue or validate commercial entitlements: the customer controls that machine and therefore could mint licenses if it held a shared signing secret.

Recommended flow: payment webhook confirms payment → cloud issues an opaque activation key → installation exchanges it over HTTPS → cloud returns a signed entitlement bound to that installation → add-on verifies using an embedded public key.

Use a standard asymmetric signature scheme such as Ed25519 through established libraries, not custom cryptography. Keep the private key exclusively in the cloud and protect/rotate it. Include a format version and key ID, license/customer/organization IDs, product/audience, plan and limits, installation ID, issued/not-before/expiry times and an explicit offline-valid-until bound. Put status and activation inventory in the cloud database; each signed entitlement is only a snapshot of that state.

| Capability | Current state | Recommended behavior |
|---|---|---|
| Offline signature verification | Absent | Verify authenticity, product, installation binding and time bounds locally; no cloud call per frame. |
| Online validation | Absent | Refresh periodically over HTTPS with retry/backoff; do not treat a connection error as revocation. |
| Expiry | Absent | Enforce signed validity bounds with visible advance warnings. |
| Renewal | Absent | Payment-confirmed renewal issues a replacement signed entitlement. |
| Revocation | Absent | Reject a confirmed revocation at refresh; offline revocation is only enforceable after the signed offline-valid window ends. |
| Grace periods | Absent | Specify distinct rules for network outage, payment failure and expired subscription. Duration remains a business decision. |
| Installation binding | Absent | Persist a random installation identity/key pair; cloud counts activations and supports transfer/recovery. Host-controlled files can be copied. |
| Camera/operator limits | Absent | Enforce in local APIs and background workers, not just the UI. |
| Rotation and replay | Absent | Versioned public keys, entitlement revision and persisted latest accepted validation time; test clock rollback and restored backups. |

A starting policy could be daily refresh with a bounded multi-day offline window, but those numbers must be agreed against the product's offline promise. The system cannot simultaneously offer unlimited offline use and immediate subscription revocation. Expiry/revocation must produce an unmistakable monitoring-status change; never continue showing a reassuring “Normal” indicator if licensed monitoring has stopped. Keep historical records and activation/support access available. Decide the treatment of already-open warnings explicitly.

Signatures prevent straightforward forged entitlements. They do not make software unmodifiable on a machine fully controlled by the customer, nor perfectly prevent cloning or local clock manipulation. The design should offer practical enforcement and recoverability rather than claim unbreakable DRM.

**Commercial cloud.** Use a separate Go service if maintaining one backend language helps the team; a separate database protects the boundary from local site data. Add a public Preact website/customer portal if suitable. Payment-provider selection depends on the selling entity and supported markets and is not determined by this repository. Validate webhook signatures, make events idempotent and reconcile subscription state; never issue licenses solely from a browser checkout-success page. Keep local operator accounts independent of cloud login so internet outages do not prevent staff access.

## 11. Repository structure

Current structure, relative to `/Users/esanduepa/Desktop/Projects/FiremeX`:

```text
FiremeX/
├── backend/
│   ├── main.go, go.mod, go.sum, .env.example
│   ├── config/ and database/
│   ├── controllers/     auth, users, organization, cameras, profile, health
│   ├── middleware/      JWT and admin checks
│   └── models/          organization, user, camera, incident
├── frontend/
│   ├── package.json, package-lock.json, vite.config.ts, tsconfig*.json
│   ├── public/ and src/assets/
│   └── src/            routes, layouts, components, pages, session, API
├── firemex-model/       weights, inference, annotation, runner, metrics
├── homeassistant_config/   tracked configuration + ignored private runtime
├── scripts/            three integration-check scripts
├── .github/workflows/ci-cd.yml
├── docker-compose.yml, start.sh, start.bat
├── mediamtx.yml.example
└── Markdown and Word documentation
```

The top-level split is sensible. Add boundaries only as they acquire real responsibilities; do not move or rename everything.

```text
Preserve existing directories; proposed additions over the roadmap:

backend/internal/
    camera/         shared HA client and frame/cache handling
    monitoring/     bounded scheduler and inference client
    incidents/      event rules, review workflow and evidence
    notifications/  persistent delivery/retry worker
    licensing/      signature verification and entitlement state
backend/migrations/ versioned schema changes
firemex-model/tests/ and evaluation/  reproducibility and contract checks
addon/              HA manifest, Dockerfile, startup and ingress config
cloud/              separately deployed commercial service and migrations
website/            public site and cloud customer portal
docs/               new architecture decisions and release/runbook material
```

These are proposed directories, not claims that implementations exist. Existing controllers can delegate to new packages incrementally. Keep ignored runtime state out of distributed source bundles.

## 12. Development roadmap

Testing accompanies every phase; it is not postponed until the end. Durations are not assigned without team availability and target hardware. Exit criteria below make progress measurable.

| Phase | Goal and work | Important modules/files | Dependencies | Expected result / exit criterion |
|---|---|---|---|---|
| 1. Stabilize access and setup | Fix unsafe IDs, central active-status enforcement, authorized first-run ownership, registration transaction/error handling and misleading live status. Align setup settings. | Existing auth/admin middleware, helpers, user/organization/camera controllers, Livefeed, Compose/examples and tests. | Current application. | Malformed IDs rejected; cross-org actions denied; revoked users blocked; no public second-owner enrollment; failures cannot look healthy. |
| 2. Establish reproducible runtime | Containerize API/UI/Python; restrict inference exposure; deterministic dependency/model build; provision disposable test DB; implement a minimal HA OS install/ingress packaging spike. | New addon packaging; existing Compose, Vite/API paths, config and model requirements. | Phase 1 for any shared deployment. | Clean checkout starts reproducibly; HA packaging/storage assumptions are proven before commercial work. |
| 3. Connect one real camera to an event | Extract shared camera client; bounded worker; inference HTTP client; evidence persistence; cooldown; explicit detector health; minimal event read API and one real UI view. | camera controller, Incident model, new camera/monitoring/incident packages; detect_service; Incidents page. | Phase 2 runtime and agreed unconfirmed/confirmed semantics. | A test image yields one persistent reviewable event; quiet frames do not; restarting or closing browsers does not break monitoring. |
| 4. Complete response and alerts | Review/false-alarm/resolve workflow, history, notification outbox/retry, local UI updates and HA notification/event delivery. | New incident/notification handlers and models; Incidents, Alerts, Dashboard; HA client. | Phase 3. | Multiple operators see consistent events; failed deliveries retry without uncontrolled duplicate alerts. |
| 5. Validate detection and capacity | Reproducible training/evaluation data, model versioning, hard-negative scenes, false alerts/hour, missed-event and latency metrics; multi-camera load and long-run tests. Resolve model/data distribution rights. | firemex-model evaluation assets and service; monitoring metrics/config. | Phase 3; iterate alongside Phase 4. | Measured acceptance criteria and supported camera/hardware limits; model quality adequate for the defined pilot. |
| 6. Add licensing | Cloud issuer and activation records; asymmetric signed entitlements; local verifier, binding, limits, renewal/revocation/grace states and UI. | New cloud service, backend licensing package and activation endpoints/UI. | Stable installation identity/storage; offline/expiry business policy. | Valid license activates; tampered/expired/wrong-install licenses fail; bounded offline use and renewal work in tests. |
| 7. Add customer commerce | Website, customer account, checkout, verified/idempotent payment webhooks, license delivery and customer portal. | New website and cloud billing/subscription modules. | Phase 6 license lifecycle and selected supported payment provider. | Payment-to-activation and renewal/cancellation/refund flows pass in provider test mode. |
| 8. Release and operational readiness | Final HA packaging, upgrade/rollback, backup/restore, disk-full/outage recovery, security/dependency checks, model/image provenance and signed release artifacts. | addon, migrations, CI, release workflows, runbooks and end-to-end tests. | Earlier phases; hardware and model acceptance. | Reproducible install/upgrade/restore on target HA OS hardware, passing long-run/security tests and clear degraded-state behavior. |
| 9. Controlled pilot | Install at a limited number of representative sites; collect consented evaluation/operational feedback; test support and incident handling. | Deployment/support documents, monitoring and evaluation reports. | Phase 8. | Evidence supports availability, latency, false-alert and support claims before general paid release. |

For the existing-file locations in this table, use the source links elsewhere in this report. New modules are incremental additions under the full repository root shown above. The roadmap does not restart camera integration or account UI from zero.

## 13. One next development task

**Fix unsafe route-ID handling in the user-management and camera-deletion endpoints, with regression tests.**

This is the correct immediate task because it is a confirmed defect in code that already exists, can undermine organization boundaries and affects destructive actions. It is bounded, does not depend on licensing or model decisions, and teaches a reusable secure API pattern. Connecting the detector first would build on the same unsafe access layer.

FILE TO MODIFY:
`/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go`

Validate a positive numeric `:id` before approve/deny/revoke queries. Reject malformed, zero, negative and overflowing values with HTTP 400. Use bound ID and organization conditions, retain 404 for another organization's numeric ID, preserve status/admin restrictions, and check database mutation errors.

FILE TO MODIFY:
`/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go`

Apply the same validation and parameterized organization/ID lookup to deletion. Preserve soft deletion and existing ownership behavior.

FILE TO MODIFY:
`/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/helpers.go`

Add a small shared positive-ID parser so the four handlers implement exactly the same contract. Keep this helper independent of business logic.

FILES TO CREATE:
`/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/id_test.go`
`/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/access_regression_test.go`

Cover invalid IDs before any database call, successful authorized numeric IDs, unknown and other-organization numeric IDs, and SQL-like strings that must remain data or be rejected. Use a disposable database for actual mutation/isolation assertions; a GORM dry-run assertion alone is not a complete regression test. Wire the appropriate test command into CI when the isolated fixture is ready.

Finished functionality: all four endpoints treat an ID strictly as an ID; no URL input can alter query structure, and successful authorized behavior remains intact. No frontend redesign or new product feature is required for this task.

The broader camera-to-detection-to-event milestone follows the access/setup stabilization phase. It remains the next major product capability, but it is not the single task to start before this vulnerability is closed.
