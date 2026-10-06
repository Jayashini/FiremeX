# Supervisor demo: remaining checkpoints

Baseline: commit `1f28876` (6 October 2026). The implementation is committed; supervisor acceptance is still pending. Complete these checkpoints in order, recording evidence rather than treating code completion as a successful demonstration.

| Step | Work | Completion evidence | Status |
|---|---|---|---|
| 1 | Repair webcam → MediaMTX → Home Assistant snapshots; improve preflight diagnostics | Valid successive webcam images, verified changing visual element, repeatable startup | Complete for the MacBook webcam |
| 2 | Exercise the real model through HTTP and the Go client | Model identity, thresholds, timings, positive/negative results and misses | Preflight complete; ML handoff/held-out samples pending |
| 3 | Verify backend persistence and the real UI | Correct camera/class/evidence, automatic refresh, reload/restart and browser-independent detection | Live webcam smoke incident and evidence passed; webcam fire trials failed correct-fire detection |
| 4 | Verify recorded replay and failure cases | Clearly labeled replay through the same path; disable/delete, dependency recovery, access and retention checks | Replay, AI disable and publisher outage/recovery passed; remaining cases covered by automated tests or pending live acceptance |
| 5 | Deliver runbook and acceptance log | Reproducible commands, measured latency, limitations, remaining acceptance blockers | Runbook and observed trial log delivered; precise fire event-onset latency unavailable because no fire detection |

Already verified in the previous implementation session: Go race/integration tests using disposable PostgreSQL schemas, four-source scheduler/outage recovery, Python HTTP contract tests with a stub, and frontend production build. These checks establish application behavior, not real-model detection quality.

The previous webcam publisher successfully sent H.264 to MediaMTX and Home Assistant's container decoded it at 1280×720, but the Home Assistant camera proxy returned HTTP 500. The authenticated JPEG bridge and Home Assistant Still Image URL now resolve that path. A final fire video → webcam trial was performed last; it produced smoke-labeled incidents, not a correct fire incident.

## Step 2 results (6 October 2026)

Actual model: `sha256:2ab009042ba04827ee1cd1ccb0648832577677334c5fe4927e7c7950f7406c89`, classes `fire` and `smoke`, CPU, requested threshold 0.50. Python 3.11.17 with `firemex-model/requirements.txt` on an 8 GiB Apple M2 Mac. The model teammate has not confirmed intended weights/version, training overlap, calibrated thresholds or known limitations beyond the repository README.

| Input | Source / provenance | Expected | Real HTTP result (3 runs) | Warm latency |
|---|---|---|---|---|
| Uniform dark image | Locally generated synthetic negative; no training provenance issue | No hazard | No detections, 3/3 | 0.054–0.083 s |
| Flame photo | [Fire.jpg, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Fire.jpg), public domain; training overlap unknown | Fire | **Missed**, 0/3 fire detections | 0.091–0.351 s |
| Smoke photo | [Smoke billows from 1988 Yellowstone fires.jpg, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Smoke_billows_from_1988_Yellowstone_fires.jpg), NPS public domain; training overlap unknown | Smoke | Smoke 0.6197, 3/3 | 0.174–0.228 s |

The first inference after model process startup took **23.585 s** on the synthetic image, exceeding the backend's 15 s model timeout. The Python service now warms CPU inference before reporting healthy. The first Go-client request after restart completed in **0.667 s** and validated the annotated smoke image. This is a small preflight, not recall or false-alert-rate evidence. Photos are not CCTV footage or agreed held-out demo clips. Full JSON records and annotations are under ignored `.demo-runtime/`.

An exploratory run of that same fire reference at threshold 0.10 exposed two `fire` boxes scored 0.3408 and 0.2353. This explains its miss at the configured 0.50 threshold; it does not justify changing the operational threshold without broader positive and negative validation. The repository's illustrative `warehouse_fire.png` returned a `smoke` box at 0.7379, so it is not evidence of a correct fire label.

Python contract tests (5) and Go camera/inference client tests passed after the warmup change.

## Step 3 results (6 October 2026)

An isolated backend used disposable PostgreSQL schema `demo_rehearsal_1791269873`, the actual model service, and a loopback-only test Home Assistant endpoint serving the public-domain smoke photo as `camera.smoke_photo_replay`. The source was labeled **“Recorded smoke photo (test source)”** throughout; it was a static photo, not a live or prerecorded video stream. The existing user accounts, cameras and default schema were untouched.

- The first real-model smoke incident, `INC-0001`, appeared in the authenticated API **2.09 seconds after camera enrollment**. This is enrollment-to-visibility timing for a static test photo, not event-onset latency for a camera. It reported smoke at 0.6197, `unconfirmed` review and `unresolved` response.
- The server saved a **292,946-byte annotated JPEG** and returned it through `/api/incidents/1/snapshot`. The same request without authentication returned HTTP 401. A signed-in Firefox tab opened the image directly using the session cookie.
- After stopping and restarting the Go backend, `INC-0001` and its saved evidence remained readable. No FireMeX browser tab was needed to create the initial incident.
- Firefox's Incidents page showed the correct test source, zone, smoke label, 62.0% display score, review/response states and evidence link. The detail panel showed the actual annotated image and model trace. A page reload retained the rows. A later row appeared automatically on the open page with the **“New detections received”** banner.
- The ongoing static hazard produced a new row after each configured 60-second suppression window. This is the documented simple cooldown policy, not episode tracking. AI was disabled on the disposable camera after the check; detector status became `monitoring disabled`.

This validated model → backend → PostgreSQL → authenticated API → browser for a static test source. It did not validate a webcam or recorded video source, the provisional 30-second visible-event bound, or detector quality on held-out clips. Later sections record the subsequent camera and replay checks.

## Step 1 camera results (6 October 2026)

The MacBook FaceTime HD Camera published H.264 through the authenticated `webcam` MediaMTX path. Home Assistant's Generic Camera now has the authenticated JPEG bridge as its Still Image URL, `http://host.docker.internal:8765/webcam.jpg`. The bridge uses one FFmpeg RTSP decoder, serves only authenticated JPEGs, and returns 503 once its last frame is over five seconds old. Its URL and credentials are not logged. The repository's gitignored `mediamtx.yml` has separate `webcam` and `replay` paths; `scripts/demo/local-stream.py` reads its password privately for repeatable launch.

- Three successive JPEGs from the bridge were valid and had different hashes; a visual check confirmed the scene changed. An unauthenticated request returned 401.
- Home Assistant's container fetched an authenticated JPEG (HTTP 200). After the Generic Camera options flow update, two successive `GET /api/camera_proxy/camera.laptop_webcam` responses were HTTP 200 JPEGs with different SHA-256 hashes. The FireMeX Live Feed displayed the enrolled webcam image in the disposable organization.
- An initial FFmpeg webcam publisher exited after an RTSP disconnect. It was restarted successfully. The publisher now retries after an FFmpeg child exit; sustained unattended stability has not yet been measured.

## Step 4 recorded-source and recovery results (6 October 2026)

An eight-second H.264 video was made from the public-domain Yellowstone smoke photo, preserving its source resolution. This was explicitly labeled **“Recorded smoke-photo video (test source)”** in the disposable FireMeX organization; it was not a field clip or live smoke. The `replay` MediaMTX path, separate authenticated JPEG bridge and a separate Home Assistant Generic Camera were used. The real model reported smoke at **0.6111** on the replay JPEG at threshold 0.50.

With the browser open, enabling AI on only this replay source created `INC-0010` in the disposable schema. The Incidents page showed the recorded-source label, smoke, 61.1%, unconfirmed/unresolved, and loaded the annotated JPEG with model hash and threshold. AI was then disabled. This is video transport through the same worker/API path, but no event-onset latency can be inferred from an already-looping static-image video.

The replay evidence endpoint returned HTTP 401 without a session and HTTP 200 with a valid disposable-account session, yielding a 206,985-byte JPEG. A direct preflight on one current non-fire webcam view returned no fire or smoke detections at threshold 0.50; this is one negative frame, not a false-alert-rate measurement.

Stopping the replay publisher made its JPEG bridge return HTTP 503 with zero image bytes after the five-second freshness limit. Restarting the publisher restored HTTP 200 and a valid JPEG without restarting Home Assistant or FireMeX. The older static-photo source was soft-deleted from the disposable schema after its test; its incidents and evidence remain.

Go tests, five Python model-service contract tests and the frontend production build passed after these changes. The tests cover scheduler, retry, access, retention and persistence behavior with isolated fixtures; they do not measure actual fire recall. A final user-presented fire-video webcam trial was run; correct fire detection, precise positive event-onset latency and ML teammate handoff remain acceptance items. The reproducible setup and presentation sequence are in [supervisor-demo-runbook.md](supervisor-demo-runbook.md).

## Final webcam video trial (6 October 2026)

At approximately **08:15:17 UTC**, the user confirmed a prerecorded fireplace fire video was visible to the MacBook webcam. The webcam AI switch was enabled at the configured 0.50 fire/smoke thresholds in the disposable organization. A diagnostic webcam frame confirmed the phone screen and flames filled most of the webcam image; Home Assistant returned valid JPEGs and the worker reported recent image receipt and inference completion.

The real model produced **no `fire` incident** during the trial. It created `INC-0012` at **08:16:00 UTC** as `smoke` 0.5506 and `INC-0013` at **08:17:43 UTC** as `smoke` 0.5017, each with saved evidence. This is a **fire-class miss and smoke misclassification** on the presented video, not a successful fire detection. The first smoke row was about 43 seconds after the recorded trial-start check, but the precise visible-flame onset was not externally timed; there is no fire-row latency to report. The provisional 30-second positive-case criterion was not met.

On one captured webcam frame, direct model calls returned no detections at 0.50 and only weak `smoke` scores at 0.10 (top score 0.2824). Diagnostic phone-only and flame-only crops still returned `smoke` boxes, with no `fire` boxes; cropping the flame region gave a top smoke score 0.5611. These diagnostics were not wired into the product and cannot justify relabeling smoke as fire. The temporary diagnostic frame was removed. AI was disabled after the test to prevent repeated misleading incidents. The user was asked whether another prerecorded, wider CCTV-style fire clip is available. The model repository itself reports fire recall around 0.22 on its validation data; this test reinforces the need for an ML handoff and stronger fire validation.

### Second user-presented fire video

At approximately **08:21:45 UTC**, the user presented a different prerecorded video showing a building fire and smoke on the phone screen. A webcam frame confirmed that the video occupied nearly the full image. Webcam AI was re-enabled at threshold 0.50. Through at least **08:23:43 UTC**, the detector stayed in `monitoring` with recent successful inference, zero lost results and **no new incidents** beyond the first clip's smoke reports (`INC-0012`/`INC-0013`). On a diagnostic frame from the second clip the real model returned **no fire or smoke boxes even at threshold 0.10**. The temporary frame was removed and AI disabled again.

Both real webcam fire-video trials therefore **failed the correct-fire acceptance criterion**. Transport, fresh snapshots, worker scheduling, incident persistence and UI evidence have been shown to work; model quality on these videos is the remaining blocker. Lowering the threshold cannot rescue the second diagnostic frame and would increase false-alarm risk. The original videos or permissioned representative clips, their provenance, and an ML-reviewed replacement model are needed to make a credible fire-detection claim.

## User-presented smoke video (6 October 2026)

The user then presented a prerecorded smoke video to the same MacBook webcam. The local model, MediaMTX, JPEG bridge and Home Assistant camera proxy were restarted, and a fresh JPEG was verified before AI was enabled. The user confirmed the video was visible at approximately **08:28:08 UTC**. The webcam AI toggle completed at **08:28:40.576 UTC**; the real model's `smoke` incident `INC-0014` was observed at **08:28:49.162 UTC** and inserted at **08:28:49.645 UTC**. That is **9.1 seconds from AI enable to database row**, not an event-onset-to-UI latency measurement because the manual browser setup took about 32 seconds after the user confirmation.

`INC-0014` reported **smoke 0.6593 at threshold 0.50**, with evidence status `available`. The Incidents page showed the webcam name, Main Entrance zone, smoke label, 65.9% score, unconfirmed/unresolved state, model hash and saved annotated JPEG. Visual inspection of the saved evidence confirmed the model's box was on the smoke in the displayed video. A later `smoke` row, `INC-0015` at about 54%, appeared after the cooldown and the open Incidents page showed the “New detections received” banner. Webcam AI was then disabled and the camera publisher/bridge stopped. The Go backend and isolated UI remain available for reviewing incidents; the MacBook camera is no longer being captured.

This **passes the webcam smoke detection and evidence path** with the actual model. It does not change the two failed fire-video results or prove the 30-second visible-onset-to-UI criterion. The smoke and fire trials used videos displayed on a phone to the webcam; the original video files were not available on the Mac for independent source-file testing or training evaluation.
