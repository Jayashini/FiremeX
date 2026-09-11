# Project Scope: FiremeX

> **Supersedes the earlier cloud-relay scope.** The previous version described
> an AI agent pushing alerts to a cloud endpoint and a backend "completely
> independent of Home Assistant". That is no longer the direction. FiremeX is
> now **local-first**: detection and monitoring run inside the customer's own
> environment, and the Internet is used only for subscription, licensing and
> updates.

---

## 1. What FiremeX is

FiremeX turns an organisation's **existing CCTV cameras** into an early fire
and smoke warning system. Cameras are connected to Home Assistant; FiremeX
reads them from there, shows them on one local dashboard, and continuously
analyses the feeds for smoke and fire. When something is detected it raises an
alarm for the operators on duty.

```
Cameras  →  Home Assistant  →  FiremeX  →  Local users
                                  ↑
                        AI detection runs here,
                        inside the organisation
```

It is sold to **organisations**, not individuals: one installation serves the
whole site, with one administrator and multiple operators sharing it over the
local network.

**Positioning.** FiremeX is an early-warning and monitoring layer that works
alongside an organisation's existing fire-safety arrangements. It is not
presented as a replacement for certified fire-alarm systems.

---

## 2. Architecture

| Part | What it does | Runs on |
|---|---|---|
| Home Assistant | Owns the cameras and exposes them over its API | Customer site |
| Go backend (Gin + GORM) | Accounts, organisations, cameras, camera stream proxy | Customer site |
| Preact frontend | The dashboard operators and admins use | Browser, local network |
| Detection service (Python) | YOLOv8 fire/smoke model behind an HTTP endpoint | Customer site |
| PostgreSQL | Users, organisations, cameras | Customer site |

Everything runs locally. The browser never talks to Home Assistant directly —
the Go backend proxies camera streams so the HA token never leaves the server.

---

## 3. What is built

### Working end to end
- Organisation registration, which creates the organisation and its first admin
- Operator self-registration using the organisation's join code, gated by admin approval
- Login with JWT; approve, deny and revoke operator accounts
- Camera discovery from Home Assistant and per-organisation camera records
- Live camera streaming through the backend proxy
- Admin and operator roles with separate navigation and permissions
- Profile page (rename, change password) and Settings page (organisation details, join code, team and camera counts, dependency status)
- All settings read from configuration; per-installation signing key
- Every user and camera endpoint scoped to the caller's organisation

### Built but not connected
- **Detection model** (`firemex-model/`) — trained YOLOv8n for `fire` and `smoke`, with an HTTP service on port 8100. It works standalone. **Nothing calls it yet.**

### Designed, showing sample data
- Dashboard, Incidents and Alerts. These pages carry a visible "Preview" banner until real detections exist.

### Not started
- The detection loop that connects cameras to the model
- Incident records in the database
- Alarm delivery and notifications
- Subscription, licensing and activation
- Packaging as a Home Assistant add-on

---

## 4. The next milestone

The three parts above — cameras, dashboard, detection model — all work, but
nothing joins them. The next piece of work is that connection:

```
every N seconds, for each camera with AI enabled:
    grab a still from Home Assistant
    POST it to the detection service
    if a hazard is found → save an Incident → alert the operators on screen
```

This turns the sample pages into real ones and is the single highest-value
piece of work remaining.

**Detection is advisory, not automatic.** A detection becomes an alert; a
person confirms it; only then is it an incident. Nothing physical is ever
triggered directly by the model.

---

## 5. Out of scope

- **Continuous video recording or storage.** FiremeX views live streams and, later, saves detection snapshots. It is not an NVR.
- **Camera and network configuration.** Adding or configuring cameras happens in Home Assistant or on the NVR.
- **PTZ control.** Operators cannot pan, tilt or zoom cameras from FiremeX.
- **Password reset by email.** Users change their own password from the Profile page; there is no email delivery.
- **Multi-site management.** One installation serves one organisation at one site.

---

## 6. Known constraints

These are real limits the team should keep in view.

- **Model accuracy.** The current model is v1: precision 0.53, recall 0.35, and `fire` recall around 0.22. It is usable for demonstration and development, not for a safety guarantee. See `firemex-model/README.md`.
- **Licensing.** Ultralytics YOLO is AGPL-3.0, and Ultralytics states that trained models fall under it too. That is fine for coursework, but a commercial FiremeX would need an Ultralytics Enterprise Licence or a different runtime. This must be settled before the product is sold.
- **Add-on packaging.** The development environment runs the `homeassistant/home-assistant` Docker image, which does **not** support add-ons. Shipping FiremeX as a true Home Assistant add-on requires Home Assistant OS or Supervised; otherwise it ships as a docker-compose bundle and the wording "plugin" should be softened.

---

## 7. Documentation

| File | Contents |
|---|---|
| `README.md` | Frontend overview and how to run it |
| `HOME_ASSISTANT_SETUP.md` | Getting Home Assistant running |
| `CAMERA_SETUP.md` | Connecting cameras to Home Assistant |
| `USER_MANAGEMENT.md` | Organisations, roles and approval flow |
| `firemex-model/README.md` | The model, its accuracy, and how to call it |
| `FiremeX_Business_Direction_Document.docx` | Business, market and commercial direction |
| `scripts/test-*.sh` | Automated checks for config, organisation isolation and accounts |
