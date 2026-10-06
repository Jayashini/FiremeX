# FireMeX Future Action Plan

Prepared 5 October 2026. This is the implementation backlog for turning the existing repository into a reliable, paid Home Assistant fire and smoke monitoring product. It builds on the [Current State Analysis](/Users/esanduepa/Desktop/Projects/FiremeX/FIREMEX_CURRENT_STATE_ANALYSIS.md). All checkboxes below are future work; writing this plan does not mark them complete.

**Priority update — 6 October 2026:** First deliver the focused [supervisor demonstration](FIREMEX_SUPERVISOR_DEMO_PLAN.md): computer camera → existing model → persisted incident and evidence in the real table. The user currently requests its implementation plan. This advances selected camera/detection/incident work without claiming the wider roadmap is complete. Read [product decisions and project memory](docs/product-decisions.md) for confirmed choices and tentative thresholds.

The production sequence is: secure the current application, make it reproducible, connect cameras to detection and persistent events, complete alerts, prove detection quality, add licensing and commerce, then qualify the release on customer hardware. Keep Preact, Go/Gin, PostgreSQL/GORM and the separate Python inference process. Introduce new modules only when a phase needs them.

## 1. Product boundaries and delivery milestones

The first commercial release serves one organization at one site, with one installation and multiple local users. Home Assistant remains the primary camera source. Detection and incident handling run locally even when no dashboard is open. Cloud services handle customer accounts, payment, licensing and update distribution. Offline operation follows a published, bounded license policy.

The product provides advisory early warnings alongside existing fire-safety arrangements. The user has subsequently requested siren activation above 50% model confidence; hardware, policy and validation remain to be defined, and this is separate from the immediate supervisor demo. NVR recording, PTZ, sensor fusion, multi-site management and broader hazard classes remain outside this release. SMS/email are optional later delivery channels; complete local dashboard and Home Assistant alerts first. Local email password reset is outside the current scope; a controlled local administrator recovery procedure is still required.

| Milestone | Finished capability | Required phases |
|---|---|---|
| M1 — Secure development baseline | Existing accounts and cameras have tested access boundaries and honest status indicators. | 0–1 |
| M2 — Reproducible local runtime | A clean environment starts the full stack; HA package feasibility and persistent storage are proven. | 2 |
| M3 — Working detection demonstration | One camera produces a real persisted detection and reviewable evidence without an open browser. | 3–4 |
| M4 — Operational local beta | Multiple operators receive real alerts, review events and see accurate health. | 5 |
| M5 — Qualified monitoring engine | Detection quality, performance, compatibility and rights meet documented pilot criteria. | 6 |
| M6 — Paid-product beta | Installation activation, bounded offline entitlement and sandbox purchase/renewal work. | 7–8 |
| M7 — Release candidate | Installation, upgrades, restoration, security and failure recovery pass on supported hardware. | 9 |
| M8 — General paid release | Controlled pilot meets the agreed criteria; support and operations are ready. | 10 |

The phase numbers describe dependencies, not necessarily one person's calendar. Dataset preparation, rights review and customer research can begin early while development proceeds. Do not delay security fixes while waiting for business decisions.

## 2. Phase 0 — Record decisions and establish the baseline

**Goal:** remove ambiguity that would otherwise cause repeated redesign. **Dependencies:** existing audit. **Suggested owner:** technical lead, with product and ML input.

- [ ] **P0-01:** Save the current working baseline, including the intentional PostgreSQL host-port change. Record what builds and what has not been tested; do not describe compilation as behavioral validation.
- [ ] **P0-02:** Define one-installation/one-organization ownership. Existing organization columns and checks remain valuable, even though public multi-organization enrollment will close.
- [ ] **P0-03:** Agree event terminology. Recommended: store machine reports using the existing Incident foundation, add a separate review state, and display them as unconfirmed detections until human review. Keep review state separate from response progress.
- [ ] **P0-04:** Specify the first supported hardware/HA OS test target and representative cameras. Record CPU, memory, storage, camera count, image sizes and expected sampling intervals. Hardware support is an outcome of testing, not a promise derived from the model's file size.
- [ ] **P0-05:** Define acceptance measures before tuning the detector: event-level recall for fire and smoke, false alerts per camera-hour, detection-to-alert delay, monitoring availability and maximum resource use. Agree numerical thresholds for the intended pilot; do not substitute model confidence or mAP for these measures.
- [ ] **P0-06:** Start code/model/dataset-rights review now. Record provenance, permissions and commercial distribution options. Do not distribute a proprietary build until the chosen licensing route is resolved. Ultralytics describes both AGPL and enterprise licensing; changing export format alone should not be assumed to remove obligations. [Official licensing source](https://www.ultralytics.com/license).
- [ ] **P0-07:** Create a short architecture decision log and an API/status vocabulary. Record changes with their reason rather than replacing earlier decisions silently.

**Decisions to close before their dependent phase:**

| Decision | Recommended starting position | Deadline |
|---|---|---|
| Local ownership | Authorized one-time organization/admin setup; controlled recovery. | Phase 1 bootstrap work |
| Review terminology | Unconfirmed / confirmed / dismissed, separate from unresolved / in progress / resolved. | Phase 4 schema work |
| PostgreSQL packaging | Preserve PostgreSQL; prove managed-in-package operation versus an explicit supported dependency. | Phase 2 feasibility gate |
| Initial hardware | One available reference target first; expand only after benchmarks. | Phase 2 |
| Detection acceptance thresholds | Written per-class, event-level and false-alert/latency targets. | Before Phase 6 evaluation |
| Evidence retention | Configurable retention and disk quota with a clear deletion policy. | Phase 4 storage design |
| License outage, expiry and grace behavior | Explicit separate states; no silent monitoring shutdown. | Phase 7 |
| Plans and limits | Installation/camera limits first; operator limits only if commercially justified. | Phase 7 contracts |
| Selling entity, markets and payment provider | Verify support for the actual entity/country before selecting the provider. | Phase 8 |
| Model/code/data rights | Document the selected compliance or commercial agreement route. | Before external distribution |

**FILES TO MODIFY:** [PROJECT_SCOPE.md](/Users/esanduepa/Desktop/Projects/FiremeX/PROJECT_SCOPE.md) for approved scope and terminology; [README.md](/Users/esanduepa/Desktop/Projects/FiremeX/README.md) to describe the real repository.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/architecture-decisions.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/product-acceptance-criteria.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/dependency-and-model-rights.md`

**Completion gate:** decisions that block the next phase are recorded; unresolved later business choices have a named responsible role and deadline. This does not require settling all future pricing before fixing the application.

## 3. Phase 1 — Secure and stabilize existing functionality

**Goal:** make current account and camera functionality safe to build on. **Dependencies:** current code; P0-02 for ownership changes. **Suggested owner:** backend developer, with frontend and QA review.

- [ ] **P1-01 — Safe route IDs:** parse positive integer IDs for approve/deny/revoke and camera deletion; reject malformed, negative, zero and overflowing values; bind ID and organization parameters. Return 404 for another organization's numeric ID. Add parser and endpoint regression tests. [GORM documents why unvalidated string IDs are unsafe](https://gorm.io/docs/security.html).
- [ ] **P1-02 — Active sessions:** load and require an active, organization-linked user centrally on every protected route, including camera images and health/profile endpoints. Cache invalidation must actually lead to refusal. Define revocation latency for existing MJPEG streams; close or periodically reauthorize them. Enforce the documented bound in tests.
- [ ] **P1-03 — Authorized installation bootstrap:** replace unrestricted organization creation with a one-time owner-authorized setup flow, using a credential established through the trusted installation interface. Merely letting the first internet/LAN visitor claim the server is insufficient. Atomically establish one owner and close bootstrap after success; concurrent setup attempts must not create two owners. Keep approved operator onboarding.
- [ ] **P1-04 — Account durability:** hash passwords before database writes; create organization/admin in one transaction; check Save/Delete/Find errors and affected rows. Use bounded retries and stronger random organization join codes. Preserve existing accounts during any migration; inventory legacy multi-organization installations before enforcing single-owner policy.
- [ ] **P1-05 — Session hardening:** allow the exact JWT signing algorithm, require expiry and valid identity, and define token invalidation on password change and administrator recovery. Keep camera-cookie authentication working. Prefer same-origin delivery; use secure cookies under HTTPS and an explicit CSRF/origin strategy for cookie-authenticated mutations. Remove redundant browser-token exposure only with a tested migration of all callers.
- [ ] **P1-06 — Abuse controls and secrets:** throttle login/registration and bound request sizes; reject known example secrets in production; generate persistent random installation secrets; use a least-privilege runtime DB account. Bind development DB ports to loopback unless explicitly needed elsewhere. Test approved proxy handling so client-IP controls cannot be spoofed.
- [ ] **P1-07 — Honest UI:** replace unconditional Online/AI monitoring indicators with camera and detector state. Treat untested or disconnected detection as unavailable, never Normal. Display API failures; remove a camera from the UI only after successful deletion.
- [ ] **P1-08 — Recovery and documentation:** define authenticated admin replacement/recovery without a public bypass. Correct README/setup/user-management claims, preserve the user's port mapping, and remove misleading setup instructions.

**FILES TO MODIFY:**

| Existing file | Required work |
|---|---|
| [user.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go) | Safe IDs, checked mutations, reliable revocation. |
| [camera.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go) | Safe deletion, authorization and stream cleanup. |
| [helpers.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/helpers.go) | Shared ID parsing and consistent authorized-user access. |
| [authMiddleware.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/middleware/authMiddleware.go) and [adminMiddleware.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/middleware/adminMiddleware.go) | Central identity/status checks and role enforcement. |
| [organization.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/organization.go) | Authorized setup, transaction and join codes. |
| [auth.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/auth.go), [me.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/me.go), [user model](/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/user.go) | Session lifecycle and recovery support. |
| [main.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go), [config.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/config/config.go), [example environment](/Users/esanduepa/Desktop/Projects/FiremeX/backend/.env.example) | Protected route wiring, settings and secret validation. |
| [session.ts](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/session.ts), [registration page](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/auth/RegisterGateway.tsx), [Livefeed.tsx](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Livefeed.tsx) | Session/setup changes, accurate state and mutation failures. |
| [docker-compose.yml](/Users/esanduepa/Desktop/Projects/FiremeX/docker-compose.yml) | Development exposure and credentials, preserving intentional port changes. |

**FILES TO CREATE, as needed:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/id_test.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/access_regression_test.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/auth/session.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/installation.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/setup.go`

Introduce the shared auth package only if needed to avoid a middleware/controller import cycle. Do not perform an unrelated authentication rewrite.

**Completion gate:** invalid IDs cannot change SQL structure; cross-organization requests fail; revoked sessions fail within the documented bound; a second public organization/admin cannot be enrolled; concurrent setup is safe; legitimate login, approval, profile edits and camera viewing still pass. Regression tests must use disposable data, never existing development/customer records.

## 4. Phase 2 — Reproducible runtime and early Home Assistant packaging

**Goal:** prove that the chosen stack can actually run and persist inside the intended product environment. **Dependencies:** Phase 1 for shared deployment. **Suggested owner:** deployment developer and backend developer.

- [ ] **P2-01:** Containerize backend and Python; serve built Preact assets through a production same-origin HTTP entry point. Provide a documented development profile with all dependencies and a separate disposable test profile. Vite development/preview servers are not the product hosting plan.
- [ ] **P2-02:** Select a Python/base-image combination compatible with the pinned ML packages on the reference hardware. Test wheel availability and libc/architecture compatibility; do not assume an Alpine-based image can install all Torch/OpenCV wheels. Separate build tooling from runtime artifacts and pin verified versions/digests.
- [ ] **P2-03:** Make model delivery deterministic: verify checksum/provenance, record model version, package it or fetch it during the controlled build. First-run inference must not silently depend on a public download. Missing/corrupt weights must produce an explicit readiness failure.
- [ ] **P2-04:** Build a minimal HA add-on/app manifest and image. Prove install, start, UI ingress, camera API access, stop and restart on HA OS. Use the Core proxy with `homeassistant_api: true` and `SUPERVISOR_TOKEN`, retaining manual URL/token settings for development. [HA communication contract](https://developers.home-assistant.io/docs/apps/communication/).
- [ ] **P2-05:** Resolve the database packaging decision with an actual prototype. Preferred single-install candidate: managed local PostgreSQL plus Go/Python processes, using a supervisor and persistent storage. Measure memory and backup/startup complexity. If unsuitable, document an explicit PostgreSQL dependency and installation procedure rather than silently replacing the database or assuming HA provides PostgreSQL.
- [ ] **P2-06:** Support ingress prefixes for assets, navigation, API calls and cookies. Keep FireMeX roles separate from HA ingress authentication. Use only required capabilities and private service ports. Persist credentials, installation identity, license state, database and evidence appropriately; HA provides `/data` for persistent app storage. [HA package configuration](https://developers.home-assistant.io/docs/apps/configuration/).
- [ ] **P2-07:** Add process supervision, startup ordering, dependency retries, readiness/liveness checks and graceful shutdown. A live process is not necessarily a ready detector. Report failures separately.
- [ ] **P2-08:** Establish versioned database migrations before expanding incident/commercial schemas. Capture a baseline for existing data; test migrations against fresh and existing-schema databases. Add an isolated test fixture, then move the shell integration checks into that environment. CI must run behavioral tests, not only compile.

**FILES TO MODIFY:** [Compose](/Users/esanduepa/Desktop/Projects/FiremeX/docker-compose.yml), [backend startup](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go), [database setup](/Users/esanduepa/Desktop/Projects/FiremeX/backend/database/db.go), [frontend API paths](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/api.ts), [router](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/routes/index.tsx), [Vite settings](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/vite.config.ts), [ML requirements](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/requirements.txt), [CI](/Users/esanduepa/Desktop/Projects/FiremeX/.github/workflows/ci-cd.yml), and the three existing scripts under [scripts](/Users/esanduepa/Desktop/Projects/FiremeX/scripts).

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/Dockerfile`
- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/Dockerfile`
- `/Users/esanduepa/Desktop/Projects/FiremeX/compose.test.yml`
- `/Users/esanduepa/Desktop/Projects/FiremeX/.dockerignore`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/config.yaml`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/Dockerfile`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/run.sh`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/ingress.conf` if using an HTTP proxy
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/migrations/0001_baseline.sql`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/development-and-testing.md`

The HA distribution/build arrangement must make backend/frontend/model artifacts available to the add-on image build. Prove the build context or publish a prebuilt image; do not write a Dockerfile that assumes parent directories are accessible from an add-on-only context.

**Completion gate:** a clean machine can reproduce the stack from instructions; test data is isolated; HA installation and restart work; persisted identity/data survive recreation; no source credentials or private HA runtime files enter images; one agreed database packaging route is demonstrated.

## 5. Phase 3 — Complete camera management and a shared frame service

**Goal:** provide a reliable source of images and truthful camera state for both viewers and the detector. **Dependencies:** Phase 1; Phase 2 configuration contract. **Suggested owner:** backend developer with frontend support.

- [ ] **P3-01:** Extract HA client/snapshot/cache behavior from the camera controller into a shared service. Retain one in-flight fetch per entity and bounded cache retention. Browser viewing and detection must not independently overwhelm HA.
- [ ] **P3-02:** Validate camera-domain/entity syntax and existence; allow only the installation's authorized selection. Prevent duplicate active camera records with a database constraint that accounts for soft deletion and re-adding.
- [ ] **P3-03:** Add an admin camera update endpoint for display name, zone and AI preference. Validate all settings server-side. Define what happens to pending samples when a camera is disabled or deleted.
- [ ] **P3-04:** Provide an admin-only preview of an authorized discoverable camera before enrollment. Preserve ownership checks on ordinary operator image routes.
- [ ] **P3-05:** Track acquisition success, last successful retrieval, last error and monitoring configuration. Display unavailable/disabled/warming-up states explicitly. A successful retrieval timestamp is not necessarily the camera's capture timestamp; label it honestly.
- [ ] **P3-06:** Bound image bytes and decoded pixel dimensions; reject oversized or non-image responses rather than silently truncating them. Propagate cancellation, use upstream timeouts and backoff, and avoid rapid retry storms on outages.
- [ ] **P3-07:** Distinguish acquisition freshness from stale upstream content when the integration supplies timestamps. Repeated identical pixels alone do not prove a frozen camera: a static scene can be legitimate.

**FILES TO MODIFY:** [camera controller](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go), [camera model](/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/camera.go), [configuration](/Users/esanduepa/Desktop/Projects/FiremeX/backend/config/config.go), [route registration](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go), [AddDevice](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/AddDevice.tsx), [Livefeed](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Livefeed.tsx), [CameraFrame](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/components/common/CameraFrame.tsx).

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/camera/client.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/camera/snapshots.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/camera/client_test.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/camera/snapshots_test.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/migrations/0002_camera_constraints.sql`

**Completion gate:** an admin can discover, preview, add, edit, disable and remove a camera; an operator cannot change it; multiple viewers share upstream acquisition; disconnection produces an accurate degraded state and reconnection recovers. Camera compatibility claims are limited to tested integrations.

## 6. Phase 4 — Connect inference to persistent detection events

**Goal:** complete the first useful camera → model → event → dashboard path. **Dependencies:** Phases 2–3 and agreed review terminology. **Suggested owner:** backend and ML developers.

- [ ] **P4-01:** Define an inference response contract retaining labels, confidence and boxes, and adding model version, input dimensions and processing time. Validate finite confidence values, allowed classes and bounding boxes. Use the requested validated threshold during prediction rather than only filtering already-discarded predictions afterward.
- [ ] **P4-02:** Protect Python service access, set byte/pixel limits and readiness behavior, and move blocking inference off the async request loop into a bounded execution arrangement. Start conservatively with serialized model access; benchmark before adding workers that duplicate memory or share unsafe state.
- [ ] **P4-03:** Create a Go inference client with cancellation, deadlines, bounded response decoding and clear error categories. Do not return “no hazard” when the model is unreachable or its response is invalid.
- [ ] **P4-04:** Start a background scheduler from the backend lifecycle. Sample enabled cameras fairly, limit work in flight, discard obsolete queued frames, and keep the dashboard independent. Reload changed camera preferences and stop cleanly on shutdown. Development bypasses must not accidentally enable unlicensed production monitoring when Phase 7 arrives.
- [ ] **P4-05:** Add temporal confirmation and deduplication with a configurable policy. Keep class, severity, system health and human review separate. Track smoke-to-fire escalation so a smoke cooldown does not suppress a new fire warning. Persist enough event/cooldown state to prevent restart storms.
- [ ] **P4-06:** Extend the existing Incident model only where needed: sample/detection time, model/policy version, review state, first/last seen and event identity. Preserve historical camera/zone labels and resolver details. Use UTC storage and local display.
- [ ] **P4-07:** Persist event metadata and evidence securely. Define crash behavior around file writes and DB commits: database/file operations are not one atomic transaction. Use temporary files plus atomic rename and reconciliation, or another documented recoverable sequence. If evidence saving fails, retain the detection with an explicit evidence error and degraded health rather than silently losing the warning.
- [ ] **P4-08:** Add organization-scoped event list/detail/evidence APIs with pagination and server-side filters. Never return server paths; authorize every evidence request and prevent path traversal. Render actual records in the Incidents page and remove its fixtures only once real loading, empty and error states work.
- [ ] **P4-09:** Replace the hardcoded detector-health response with model readiness, last attempt/success and monitored-camera coverage. Define a visible degraded state for DB failures or inability to persist events.

**FILES TO MODIFY:** [detect_service.py](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/detect_service.py), [annotate.py](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/annotate.py), [incident model](/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/incident.go), [main.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go), [config.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/config/config.go), [system.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/system.go), [Incidents.tsx](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Incidents.tsx), [Settings.tsx](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Settings.tsx).

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/monitoring/inference_client.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/monitoring/worker.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/monitoring/policy.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/incidents/service.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/incidents/evidence.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/incident.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/migrations/0003_detection_events.sql`
- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/tests/test_detect_service.py`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/monitoring/worker_test.go`

**Completion gate:** controlled sample sequences produce the expected single event, quiet sequences do not, and fire escalation is preserved. Events survive restart and remain isolated by organization. Inference continues with every browser closed. Disabled cameras stop sampling. Model/camera failures never appear as a healthy negative result. A real-camera integration demonstration and deterministic stub-based tests both pass; neither substitutes for the other.

## 7. Phase 5 — Complete incidents, operator alerts and the real dashboard

**Goal:** make detection actionable for multiple operators and retain a reliable response history. **Dependencies:** Phase 4. **Suggested owner:** backend and frontend developers, with QA.

- [ ] **P5-01:** Implement review/confirm/dismiss, acknowledge, assign if required, start response, resolve and blocker-note actions. Define a role/action matrix and validate transitions server-side. Dismissal needs a reason; acknowledgement means someone has seen the warning, not that the hazard is resolved.
- [ ] **P5-02:** Write actor/time/old-state/new-state audit entries transactionally with each transition. Use optimistic concurrency or conditional updates so simultaneous operators cannot silently overwrite each other. Resolve actions should record the authenticated actor, never trust an actor ID from the request.
- [ ] **P5-03:** Add notification and delivery-attempt models. Persist a notification outbox entry in the same DB transaction as the event that requires it. A separate worker reads this queue and retries failures. This is a local durable queue, not a requirement for Redis or a separate broker.
- [ ] **P5-04:** Deliver warnings to the local UI and Home Assistant notifications/events. Keep initial human warnings immediate under the chosen detection policy; do not wait for confirmation before notifying. Define and validate the user's requested siren-above-50% behavior as a separate work item once hardware, trigger/reset policy and model evaluation are available. Sprinklers and emergency calls remain outside automatic AI actions.
- [ ] **P5-05:** Use stable event/delivery IDs, bounded backoff and retry limits. Make reconciliation and visible failed deliveries possible. External channels may duplicate a message if they lack idempotency; do not claim exactly-once delivery merely because the local queue is transactional.
- [ ] **P5-06:** Replace Dashboard and Alerts fixtures with real aggregates and history. Add shared multi-user updates using short polling initially or SSE with reconnect/catch-up. Correct time filters, pagination, badges and unread counts. Give operators an accessible warning/acknowledgement route in their own navigation.
- [ ] **P5-07:** Distinguish connected cameras, actively analyzed cameras and degraded cameras. Show last sample/analysis times. Do not label a site “safe” because the latest sampled frame had no detections. Mark interrupted coverage visibly.
- [ ] **P5-08:** Add evidence retention/quota, export and controlled cleanup jobs. Record that evidence was removed under policy while preserving required event history. Stop generating unbounded files; test disk-full and permission errors.

**FILES TO MODIFY:** [incident model](/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/incident.go), [Dashboard](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Dashboard.tsx), [Incidents](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Incidents.tsx), [Alerts](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Alerts.tsx), [routes](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/routes/index.tsx), [operator navigation](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/components/sidebar/OperatorSidebar.tsx), and the incident service introduced in Phase 4.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/incident_action.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/models/notification.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/notifications/worker.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/notifications/homeassistant.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/alert.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/dashboard.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/migrations/0004_notifications_and_audit.sql`
- `/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/components/common/MonitoringStatus.tsx`

**Completion gate:** two operators see the same warning and acknowledgement history; transitions are validated and attributed; notifications survive worker restart; failed delivery is visible and retried; refreshed pages preserve state; all production-facing hazard/alert numbers have real data sources. SMS/email are not prerequisites for this local beta.

## 8. Phase 6 — Prove model quality and supported capacity

**Goal:** establish whether the product performs adequately in its intended conditions. **Dependencies:** evaluation criteria from Phase 0 and a working pipeline for system-level measurements. Data preparation and rights review should start earlier. **Suggested owner:** ML developer and QA, with product acceptance.

- [ ] **P6-01:** Recover or create training scripts, dataset manifests, label specifications, scene/site split definitions, random seeds and evaluation commands. Record provenance and permission for every dataset. Keep train/validation/test scenes separate and reserve an untouched final evaluation set; do not tune on the final test set.
- [ ] **P6-02:** Reconcile README and image metrics against a specific model hash, dataset version, threshold and evaluation run. Create a model card stating intended conditions, known failure cases and limitations.
- [ ] **P6-03:** Collect representative negative footage: steam, dust, glare, reflections, vehicle lights, orange/yellow objects, fog and routine movement. Include small/distant flames, early smoke, dim scenes, obstruction and different camera angles in positive evaluations. Use permissioned recordings and controlled fixtures; do not stage unsafe fires for testing.
- [ ] **P6-04:** Evaluate fire and smoke separately, then evaluate the full temporal policy. Report event recall, false alerts per camera-hour, detection delay distributions, scene counts and uncertainty/sample-size limitations. Separate “camera saw no hazard” from “camera/model was unavailable.”
- [ ] **P6-05:** Improve data and threshold/temporal policy before increasing model complexity. Retrain and compare on the fixed evaluation protocol. Consider a larger backbone or alternative runtime only when measured benefit, supported hardware and licensing justify it.
- [ ] **P6-06:** Benchmark cold startup, per-frame latency, throughput, CPU/RAM, image transfer and evidence disk growth. Test multiple viewers and cameras together with normal HA workloads. Derive the supported camera count from sustained load and alert-delay targets, not isolated inference speed.
- [ ] **P6-07:** Produce a camera/hardware compatibility matrix. Test at least the selected snapshot-providing integrations and a representative slow RTSP-through-HA path. Document image resolution, sampling rate and supported system configuration for each claim.
- [ ] **P6-08:** Version weights and policy together; verify model checksums at build/load; test a new model in evaluation/shadow mode before replacing the deployed one. Prevent feedback exports from silently uploading camera footage; obtain explicit customer consent and review exported data.

**FILES TO MODIFY:** [model README](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/README.md), [requirements](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/requirements.txt), [detection service](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/detect_service.py), [manual runner](/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/try_model.py), and the monitoring policy introduced in Phase 4.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/training/train.py`
- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/evaluation/evaluate.py`
- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/evaluation/dataset-manifest.json`
- `/Users/esanduepa/Desktop/Projects/FiremeX/firemex-model/MODEL_CARD.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/detection-validation-report.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/hardware-and-camera-support.md`

Dataset content should use controlled storage suited to its size and permissions; a manifest is not a request to commit customer footage to Git.

**Completion gate:** the pre-agreed measures pass on held-out representative data and the reference hardware, results are reproducible, model/code/data distribution rights are documented, and supported limits are explicit. If quality fails, continue model/data work; packaging or successful payment integration cannot compensate for this gate.

## 9. Phase 7 — Signed licensing and local activation

**Goal:** enforce purchased entitlement without putting the cloud into the per-frame detection path. **Dependencies:** persistent installation identity, agreed offline/expiry policy and packaging contract. **Suggested owner:** backend/cloud developer with security review.

- [ ] **P7-01:** Define separate entities for cloud customer, subscription, license, installation activation and local operator. Never reuse the local session JWT secret for commercial licenses. Draft the payload schema and activation/refresh API before building screens.
- [ ] **P7-02:** Build a small cloud license issuer using an established asymmetric signature library, for example Ed25519. Protect the private signing key in restricted cloud secret/key storage. Ship only verification public keys to the add-on. Include key ID, schema version, product/audience, license/customer IDs, plan limits, installation binding and signed time bounds.
- [ ] **P7-03:** Issue an unpredictable activation key and store a hash where possible. Exchange it over HTTPS for a signed installation entitlement. Rate-limit attempts, record activation audit events, and atomically enforce installation limits across concurrent requests. Redact keys/tokens from logs and support exports.
- [ ] **P7-04:** Generate/persist installation identity and an installation key pair where useful. Define reinstall, restore, transfer, deactivation and lost-device recovery. A cloned filesystem can copy an identity; periodic server checks can reduce abuse but do not make a customer-controlled machine tamper-proof.
- [ ] **P7-05:** Implement strict local verification of signature, algorithm, schema, audience, time window, installation ID and claims. Persist the last accepted entitlement atomically. Reject malformed/oversized payloads, tampered limits, wrong installation and unsupported keys. Use UTC and detect suspicious backward clock movement without treating ordinary time correction as automatic fraud.
- [ ] **P7-06:** Refresh periodically with jitter/backoff. Distinguish network failure from a signed/authoritative revoked status. Bound offline validity explicitly. Define renewal, payment failure, expired entitlement and revocation separately. Offline operation cannot provide immediate revocation while disconnected.
- [ ] **P7-07:** Enforce entitlement in APIs and the worker, not only the dashboard. Decide whether limits count saved cameras, enabled cameras or active analysis slots and apply one rule everywhere. Handle plan downgrade predictably by asking an admin to select cameras within the limit; never silently choose which site areas lose coverage.
- [ ] **P7-08:** Build activation/status/renewal UI with current entitlement, limits, last validation and offline deadline. Warn before coverage changes. Keep account access, historical incidents, open-warning review and activation/support routes usable under the published policy. If monitoring stops, surface that as a separate urgent system status; do not erase or auto-resolve open events.
- [ ] **P7-09:** Add signing-key rotation with overlapping verification keys, entitlement revision/replay rules and a recovery runbook. Test backup restoration, corrupted state, expired certificates/HTTPS failures, clock shifts and offline-to-online transitions.

**Proposed license behavior to finalize before implementation:**

| State | Required visible behavior | Monitoring rule |
|---|---|---|
| Unactivated | Setup and activation available; no suggestion of active coverage. | Paid monitoring unavailable unless a separately signed trial entitlement exists. |
| Active | Show entitlement and limits. | Allowed within licensed limits. |
| Cloud unreachable, entitlement still offline-valid | Show validation outage and remaining offline window. | Continue locally. |
| Renewal grace | Show reason, deadline and action required. | Follow the signed, published grace policy. |
| Expired or revoked | Prominent coverage status; retain incident review and support access. | Apply the agreed restriction policy, never silently stop or claim healthy coverage. |
| Invalid signature or wrong installation | Explain failed activation without displaying sensitive payload data. | Do not activate monitoring. |

Grace durations, refresh frequency and expiry behavior are product decisions to record, not settled facts in this plan. A signed pilot license is preferable to a hidden production bypass.

**FILES TO MODIFY:** [backend config](/Users/esanduepa/Desktop/Projects/FiremeX/backend/config/config.go), [main.go](/Users/esanduepa/Desktop/Projects/FiremeX/backend/main.go), [system status](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/system.go), [camera/user handlers](/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers), [Settings](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Settings.tsx), [routes](/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/routes/index.tsx), plus installation and monitoring modules introduced earlier.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/go.mod`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/cmd/server/main.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/licensing/issuer.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/licensing/activation.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/migrations/0001_customers_and_licenses.sql`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/licensing/verify.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/licensing/refresh.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/licensing/policy.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/internal/licensing/verify_test.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/license.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/frontend/src/pages/admin/Activation.tsx`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/license-lifecycle.md`

**Completion gate:** valid entitlement activates exactly the permitted installation/limits; tampering fails; concurrent activation cannot exceed limits; refresh/renewal/transfer work; temporary internet loss preserves permitted local monitoring; expiry/revocation produces the agreed explicit behavior; no signing private key is present in a client image.

## 10. Phase 8 — Customer website, billing and subscriptions

**Goal:** connect real purchase and renewal to the tested license lifecycle. **Dependencies:** Phase 7 contracts and a verified payment-provider choice. **Suggested owner:** frontend/cloud developer and product owner.

- [ ] **P8-01:** Select the payment provider only after verifying merchant-country/entity support, recurring billing, settlement, refunds and webhook capabilities. Document applicable commercial/tax/privacy requirements for the actual selling jurisdiction with appropriate professional input; do not infer these from the repository.
- [ ] **P8-02:** Build a public site explaining capabilities, tested hardware/cameras, plans, local operation, license offline limits, installation and support. Ensure claims match validation results. The local operations frontend should not become dependent on this website.
- [ ] **P8-03:** Add cloud customer identity with email verification and account recovery, using a maintained identity service or reviewed implementation. Keep cloud credentials/accounts separate from local operators. Protect cloud support/admin actions with stronger authentication and an audit trail.
- [ ] **P8-04:** Use provider-hosted checkout where suitable; avoid storing card details. Map stable plan IDs to server-controlled entitlements rather than trusting prices or limits sent by the browser.
- [ ] **P8-05:** Verify webhook signatures, persist provider event IDs, process idempotently and tolerate duplicate/out-of-order delivery. Reconcile missed events with provider state. Browser redirects are for user experience, not proof of payment.
- [ ] **P8-06:** Implement subscription states and license consequences for purchase, renewal, failed payment, upgrade, downgrade, cancellation at period end and refunds. Decide immediate versus next-period plan changes and prorations before coding. Do not revoke simply because an older delayed event arrived after a newer successful renewal.
- [ ] **P8-07:** Provide a customer portal for subscription status, invoices/provider links, license retrieval, allowed installations, transfer/deactivation and support. Send transactional license/recovery messages through a configured provider; do not expose customer or license records across accounts.
- [ ] **P8-08:** Deploy the cloud service with separate production/test databases and signing keys, HTTPS, least-privilege access, backups, health monitoring and a secret-rotation procedure. Define customer-data retention and support access. Default cloud telemetry should not include camera frames.

**FILES TO MODIFY:** the cloud licensing service, models and configuration introduced in Phase 7; the root README and release documentation when commerce is actually available.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/website/package.json`
- `/Users/esanduepa/Desktop/Projects/FiremeX/website/src/main.tsx`
- `/Users/esanduepa/Desktop/Projects/FiremeX/website/src/pages/Pricing.tsx`
- `/Users/esanduepa/Desktop/Projects/FiremeX/website/src/pages/CustomerPortal.tsx`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/billing/webhooks.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/billing/subscriptions.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/billing/reconcile.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/internal/accounts/service.go`
- `/Users/esanduepa/Desktop/Projects/FiremeX/cloud/migrations/0002_billing.sql`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/billing-operations.md`

These are proposed boundaries and filenames; the selected provider may require additional adapters, templates and tests. No vendor choice is implied.

**Completion gate:** sandbox purchase → license → install → activate succeeds; duplicate/out-of-order webhooks do not double-provision or incorrectly revoke; renewal/cancellation/refund/downgrade flows match policy; customers cannot access each other's portal data; cloud outage does not require local operators to sign into the cloud.

## 11. Phase 9 — Production reliability, security and release engineering

**Goal:** make a customer installation supportable and recoverable. **Dependencies:** working local beta; commercial phases for a paid release; Phase 6 acceptance. Reliability work starts earlier, but this phase qualifies the complete product. **Suggested owner:** deployment/QA lead with backend and ML review.

- [ ] **P9-01:** Finalize the HA distribution repository manifest, add-on image tags/architectures, documentation, icons, changelog and settings schema. Test on supported HA versions. Verify the image builds from its real release context and the manifest version matches the published image.
- [ ] **P9-02:** Use minimal privileges and documented persistent volumes; isolate database/inference ports; configure production HTTP timeouts and shutdown. Validate internal service credentials and ingress trust boundaries. Test weak/default credentials are rejected under production settings.
- [ ] **P9-03:** Build tested backups covering database, evidence, installation identity and entitlement state. Coordinate PostgreSQL backup consistency rather than copying active data files blindly. Encrypt/protect backups as appropriate, document retention and demonstrate restoration on a clean installation.
- [ ] **P9-04:** Add versioned upgrade prechecks and compatible migrations. Take backups before risky upgrades. Test restoring a previous image together with compatible database/model state; image rollback alone does not undo a schema migration. Handle disk-space and interrupted-upgrade failures.
- [ ] **P9-05:** Add structured redacted logs and useful health metrics: cameras due/sampled, sample age, inference latency, dropped work, event count, delivery backlog, failures, DB/storage availability and license state. Rate-limit repetitive logs and produce a diagnostic bundle without secrets or evidence images by default.
- [ ] **P9-06:** Test failure recovery: HA restart, unavailable camera, stale upstream image, Python crash, backend crash, DB outage, full disk, internet/license-cloud loss, clock correction and machine restart. Require visible degraded status and documented recovery; no restart loop may flood alerts.
- [ ] **P9-07:** Add scheduled dependency/security checks, current-tree and history secret scanning, dependency/model provenance and a software bill of materials. Treat findings by severity and exposure; do not blindly upgrade the ML stack without rerunning compatibility and model tests.
- [ ] **P9-08:** Expand CI to backend unit/integration tests, frontend type/build and key UI journeys, Python contract/annotation tests, isolated end-to-end tests, image build/scan and release artifact checks. Use stub models for deterministic logic tests and a separate real-model smoke/evaluation job.
- [ ] **P9-09:** Harden release publishing permissions and protect signing keys. Build once and promote immutable artifacts; record image/model digests and release notes. Validate release signatures where distributed. External QA dispatch must fail on HTTP rejection and report downstream success/failure, rather than treating dispatch as deployment completion.
- [ ] **P9-10:** Complete accessibility/responsive checks for real operator tasks, timezone handling, readable warning states, keyboard use and error recovery. Verify browser sound/notification limitations; a browser-only alert cannot be assumed to reach an unattended operator.
- [ ] **P9-11:** Publish installation, troubleshooting, compatibility, backup, recovery, license, upgrade and incident-response documentation. Set a vulnerability-reporting contact, support ownership and realistic response expectations.

**FILES TO MODIFY:** [CI workflow](/Users/esanduepa/Desktop/Projects/FiremeX/.github/workflows/ci-cd.yml), [README](/Users/esanduepa/Desktop/Projects/FiremeX/README.md), [HA setup guide](/Users/esanduepa/Desktop/Projects/FiremeX/HOME_ASSISTANT_SETUP.md), [camera guide](/Users/esanduepa/Desktop/Projects/FiremeX/CAMERA_SETUP.md), [user guide](/Users/esanduepa/Desktop/Projects/FiremeX/USER_MANAGEMENT.md), and the runtime/add-on/cloud modules created in earlier phases.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/repository.yaml`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/DOCS.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/addon/CHANGELOG.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/.github/workflows/release.yml`
- `/Users/esanduepa/Desktop/Projects/FiremeX/.github/workflows/security.yml`
- `/Users/esanduepa/Desktop/Projects/FiremeX/tests/e2e/monitoring.spec.ts`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/backup-and-restore.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/operations-runbook.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/release-checklist.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/SECURITY.md`

**Completion gate:** a clean installation, upgrade and restore succeed on reference hardware; all required checks pass; no unresolved critical/high exploitable defect is accepted for release; long-running load stays within the agreed resource and latency limits; recovery leaves accurate user-visible health; rollback and support instructions have been exercised.

## 12. Phase 10 — Controlled pilot and general release

**Goal:** validate the complete product in representative real environments before broader sale. **Dependencies:** release candidate, rights resolved and signed pilot entitlement. **Suggested owner:** product owner, QA and support lead.

- [ ] **P10-01:** Select a small set of representative, permissioned pilot sites and document cameras, network, hardware, operator availability and existing safety arrangements. Agree what the pilot measures and what customer data may be collected.
- [ ] **P10-02:** Perform installation acceptance: every enrolled camera has usable images; enabled cameras actually run inference; a safe prerecorded test event reaches intended operators; acknowledgement works; internet loss behaves as documented.
- [ ] **P10-03:** Train administrators and operators on unconfirmed versus confirmed events, outages, false positives, coverage limits and escalation procedures. Test support contact and administrator recovery.
- [ ] **P10-04:** Run sustained observation covering day/night and normal site activity. Compare measured false alerts, coverage, delay, failures and support effort with the criteria defined before the pilot. Record time actually monitored; a quiet unobserved site is not proof of high recall.
- [ ] **P10-05:** Triage pilot issues by impact. Revalidate model/policy changes on the held-out protocol and regression suite before deploying them. Pilot footage must not silently become training data.
- [ ] **P10-06:** Exercise renewal, controlled entitlement expiry, restoration and update procedures in an appropriate test/pilot arrangement. Do not intentionally interrupt a customer's monitoring without coordination.
- [ ] **P10-07:** Hold a release review covering engineering, model quality, commercial rights, billing, support and documented product claims. Publish only supported hardware/camera limits and tested behavior. Complete staged rollout with a rollback owner.

**FILES TO CREATE:**

- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/pilot-plan.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/site-acceptance-checklist.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/pilot-results.md`
- `/Users/esanduepa/Desktop/Projects/FiremeX/docs/release-acceptance.md`

**Completion gate:** pilot measures meet the pre-agreed criteria; operational issues have owners/resolutions; supported claims and limitations match evidence; onboarding/payment/support work; a staged paid release is authorized by the product owner. A demo alone does not satisfy this gate.

## 13. Work after release

These are ongoing operational responsibilities, not additional prerequisites to start Phase 1.

- [ ] Review reported missed events, false alarms, outages and failed deliveries; distinguish model errors from camera coverage failures.
- [ ] Triage security reports and dependency advisories; patch and retest supported release lines.
- [ ] Maintain HA-version compatibility and the tested hardware matrix.
- [ ] Monitor cloud billing reconciliation, failed license refreshes and transactional message delivery.
- [ ] Exercise backup restoration and signing-key rotation on a recurring schedule.
- [ ] Evaluate new models offline/shadowed before controlled rollout; maintain reproducible model/policy histories.
- [ ] Review support volume and customer feedback before adding new features.

Potential later features include additional notification providers, richer reports, enterprise identity and multi-site management. Choose them from demonstrated customer need. Keep raw video recording, PTZ, extra hazard classes and sensor fusion as separate product decisions rather than silently expanding this plan.

## 14. Proposed API and data contracts

These endpoints are future contracts to finalize during their phase. Existing account and camera routes should be preserved where safe; do not rename working routes merely for cosmetic consistency.

| Area | Proposed endpoints | Access and behavior |
|---|---|---|
| Setup | `GET /setup/status`, `POST /setup/complete` | Minimal public status; completion requires authorized bootstrap and atomic one-time ownership. |
| Cameras | Existing list/add/delete plus `PATCH /api/cameras/:id` | Operator read; admin validated changes. Admin-only discovery preview is a separate scoped route. |
| Monitoring | `GET /api/monitoring/status` | Authorized organization/site health; no HA tokens or sensitive configuration. |
| Incidents | `GET /api/incidents`, `GET /api/incidents/:id`, `GET /api/incidents/:id/snapshot` | Scoped, paginated, evidence-authorized. |
| Incident actions | `POST /api/incidents/:id/actions` | Validated review/response action, reason and concurrency version; actor comes from session. |
| Alerts | `GET /api/alerts`, `POST /api/alerts/:id/acknowledge` | Authorized users; persistent, attributable and idempotent acknowledgement. |
| Dashboard | `GET /api/dashboard` | Replace current placeholder with real authorized aggregates. |
| Local license | `GET /api/license`, `POST /api/license/activate`, `POST /api/license/refresh` | Status with appropriate role filtering; mutations admin-only and rate-limited. |
| Cloud licensing | Versioned activation/refresh/deactivation endpoints | Activation credential or installation authentication, ownership checks and atomic limits. |
| Cloud billing | Provider-specific webhook and portal APIs | Verified webhook signature; customer-authenticated portal. |

Use consistent DTOs for new APIs rather than returning raw ORM models. Keep IDs, timestamps, confidence scales, pagination and error formats explicit. Record event capture/retrieval/detection times separately where available. Store only necessary metadata, apply scoped indexes/constraints and keep cloud billing records in a different database from local surveillance records.

## 15. Test and acceptance matrix

| Test area | Minimum scenarios before the related milestone |
|---|---|
| Authorization | Unauthenticated, pending, revoked, operator/admin, orphaned user, expired token, malformed ID, other organization, duplicate/concurrent bootstrap and direct evidence access. |
| Cameras | Valid/invalid entity, duplicate add, preview before save, edit/disable/delete, slow upstream, disconnect/reconnect, malformed/oversized image and simultaneous viewers. |
| Inference | Missing/corrupt model, invalid image, oversized image, threshold boundaries, non-finite values, empty result, known fire/smoke fixtures, timeout and malformed response. |
| Detection policy | Quiet footage, repeated detections, cooldown, smoke-to-fire escalation, stale work, worker restart, disabled camera and fairness under load. |
| Incidents/evidence | Persistence, ownership, pagination/filtering, concurrent actions, audit attribution, deleted/renamed camera history, file/DB crash windows and quota cleanup. |
| Notifications | Duplicate job, worker restart, failed/retried channel, acknowledgement concurrency, reconnect/catch-up and visible permanent failure. |
| License | Valid/tampered/expired/wrong-install payload, unknown key/version, online/offline/grace transitions, replay, clock changes, key rotation, limits and backup/transfer behavior. |
| Payments | Invalid signature, duplicate/out-of-order/missed webhook, successful/failed renewal, cancellation, refund, plan change and customer ownership. |
| Deployment | Clean build/install, ingress paths, private service ports, persistent data, migration, update interruption, restore and resource exhaustion. |
| Model quality | Scene/site-independent evaluation, separate classes, hard negatives, false alerts per camera-hour, event recall and end-to-end delay. |

Use fast deterministic unit tests for rules, isolated integration tests for DB/auth/HTTP behavior, and a small set of browser journeys for real user flows. Run real-model and hardware tests separately where they are too expensive for every change. No test run may seed, delete or migrate customer data.

## 16. Execution and ownership

Treat the numbered tasks as backlog items. Before starting an item, reread the affected implementation and update this plan if the repository has changed. Choose one bounded item, define its acceptance tests, implement it, demonstrate it and then mark it complete with a commit/PR and test evidence. A checked box without evidence is not completion.

Suggested ownership is by role, not assigned people: backend owns access/domain logic; frontend owns usable and truthful screens; ML owns dataset/model evidence; deployment owns packaging/recovery; QA reviews negative scenarios; product owns business policy and acceptance. One person may hold several roles, but someone other than the author should review critical access/licensing/payment changes when the team can provide it.

Calendar dates should be set after confirming availability and measuring the first few completed items. Do not promise a production date from this document alone: model quality, hardware packaging and commercial rights are separate uncertainties. Plan a small iteration at a time, reserve capacity for integration/rework, and re-estimate at M2, M4 and M5. Allow useful independent work such as dataset preparation and business-policy research without expanding the active coding task.

**Definition of done for each change:**

- The described user behavior works, including relevant failure paths.
- Authorization, validation and persistence rules are enforced server-side.
- Appropriate automated checks pass and the key user flow is demonstrated.
- Configuration examples, migrations and documentation match the behavior.
- No real secrets, customer footage or private runtime state are added to source/artifacts.
- Remaining limitations are explicit; mocks are not presented as functioning monitoring.

## 17. Next work after the priority update

For the immediate supervisor demonstration, begin **D0 (model handoff/preflight) and D1 (camera ingestion proof)** in [the demo plan](FIREMEX_SUPERVISOR_DEMO_PLAN.md). The current request is planning only. The security task below remains the first task in the wider stabilization backlog; reuse its positive-ID validation for new demo endpoints and do not treat the demo as clearance for public deployment.

### First wider stabilization task

Start **P1-01: safe route-ID handling**, as recommended by the audit. It is the smallest confirmed security defect to close before new capabilities inherit the existing API layer.

**FILE TO MODIFY:** `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/helpers.go` — add shared positive-ID validation.

**FILE TO MODIFY:** `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/user.go` — apply it to approve/deny/revoke; bind ID plus organization and check mutations.

**FILE TO MODIFY:** `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/camera.go` — apply it to deletion while preserving ownership and soft-delete behavior.

**FILE TO CREATE:** `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/id_test.go` — boundary/invalid-ID cases.

**FILE TO CREATE:** `/Users/esanduepa/Desktop/Projects/FiremeX/backend/controllers/access_regression_test.go` — endpoint authorization and cross-organization regression cases using isolated data.

Finish when valid authorized operations work, all malformed IDs return 400 before a target-record database lookup, unknown/other-organization IDs return 404, SQL-like route input cannot change query structure, and tests prove those rules. Then continue with P1-02; do not start all phases at once.
