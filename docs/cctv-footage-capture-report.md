# Report: How CCTV Footage Is Taken From a Camera — and How We Took It From Our EZVIZ Camera

**Author:** Malika Nishnatha
**Project:** FiremeX — AI fire and smoke detection for CCTV
**Date:** November 2026

---

## 1. Purpose

FiremeX needs pictures from real CCTV cameras for two jobs:

1. **Live detection** — the model checks the camera's picture a few times a second.
2. **Training data** — recorded clips of real fire, smoke and "nothing wrong" scenes,
   taken from the same kind of camera the model will later watch.

This report explains the usual ways footage is taken from a CCTV camera, and then
the exact steps we followed to get footage out of our own camera, an
**EZVIZ TY1 Pro**, including the problems we hit and how we solved them.

---

## 2. How footage is usually taken from a CCTV camera

A modern IP camera offers its picture in several ways. Most professional systems
use the first two.

| Method | What it gives | Typical address | Used for |
|---|---|---|---|
| **RTSP stream** | Continuous video (H.264 / H.265) | `rtsp://user:pass@<camera-ip>:554/<path>` | Live viewing, recording, AI analysis |
| **ONVIF** | A standard way to *find* the camera's streams, snapshots and settings | `http://<camera-ip>:80/onvif/device_service` | Adding a camera to any NVR or Home Assistant without knowing the brand |
| **HTTP snapshot** | One JPEG picture per request | e.g. `http://<camera-ip>/onvif/snapshot?Profile_1` | Low-rate checks, thumbnails |
| **MJPEG over HTTP** | A stream of JPEG pictures | `http://<host>/stream.mjpg` | Simple browser / Home Assistant viewing |
| **NVR / DVR** | The recorder re-publishes every camera's stream | RTSP from the recorder, per channel | Sites with many cameras |
| **Vendor cloud / P2P app** | Video through the manufacturer's servers | EZVIZ, Hik-Connect, Tapo apps | Home users; often the *only* method enabled by default |
| **SD card / app export** | Saved recordings as files | Download from the app or card | Evidence after an event |

### 2.1 RTSP in more detail

RTSP (Real Time Streaming Protocol) is the standard CCTV video link.

- **Channels.** Most cameras give a high-quality *main stream* and a smaller
  *sub stream*. On Hikvision-family cameras (EZVIZ is a Hikvision brand) these are
  `/Streaming/Channels/101` (main) and `/Streaming/Channels/102` (sub).
- **Codec.** Video is compressed as H.264 or H.265. H.265 is smaller but needs a
  newer decoder (FFmpeg/OpenCV handle both).
- **Sign-in.** The camera asks for a username and password using **Basic** or
  **Digest** authentication.
- **Transport.** RTSP can carry video over UDP or TCP. Over Wi-Fi, **TCP** is far
  more reliable — UDP loses packets and produces grey, smeared frames.

### 2.2 How a program reads it

In Python, OpenCV opens an RTSP address directly (it uses FFmpeg underneath):

```python
import os, cv2
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"   # TCP, not UDP
cap = cv2.VideoCapture("rtsp://admin:<password>@<camera-ip>:554/Streaming/Channels/101")
ok, frame = cap.read()        # one decoded picture (a NumPy array)
```

Every frame read this way is exactly what the camera produces — no screen glare,
no phone tilt — which is what both live detection and training need.

---

## 3. Our camera

| Item | Value |
|---|---|
| Camera | EZVIZ TY1 Pro (model CS-TY1-R105-1L2WF), firmware V5.3.8 |
| Connection | Wi-Fi, home network |
| Main stream | 1920 × 1080, H.265 |
| Frame rate | Reports 15 fps; actually delivered about 18–22 fps |

EZVIZ is a consumer brand. Out of the box it is designed to be watched **only
through the EZVIZ app and EZVIZ's cloud**, not over the local network.

---

## 4. How we took the footage — step by step

### Step 0 — First attempt: filming the screen with a phone (not good enough)

Our first clip was a phone recording of the EZVIZ app on a laptop screen
(21 seconds, 464 × 832 portrait). The camera's picture filled only about
400 × 230 pixels of it, with glare and a tilted image. The model could still see
smoke blown straight at the lens, but this footage looks nothing like what the
system sees in real use, so it is unsuitable for training. We needed the camera's
own stream.

### Step 1 — Find out what the camera allows on the network

We checked the camera on the local network. **Port 554 (RTSP) was closed**:
by default the camera offered no local video at all, only the cloud app.

That left two possible routes:

- **Route A — turn on local access** in the EZVIZ app, so the camera serves RTSP/ONVIF
  on the home network.
- **Route B — use EZVIZ's cloud player** for cameras that can only be watched
  through EZVIZ (see section 5).

Route A worked for our camera, so it is what we used.

### Step 2 — Enable local access in the EZVIZ app

In the EZVIZ app, in the camera's settings, we turned on **local network access**
(the LAN live view / local service option) and **set our own local password**.

Two things we learned here:

- The username is **`admin`**.
- The password is the **custom local password set in the app — not the
  six-letter verification code on the camera's sticker.** Using the sticker code
  gave `401 Not Authorized` every time.

After this, the camera opened:

| Service | Address (camera IP shown as a placeholder) |
|---|---|
| RTSP main stream | `rtsp://admin:<password>@<camera-ip>:554/Streaming/Channels/101` |
| ONVIF | `http://<camera-ip>:80/` |
| Snapshot | `http://<camera-ip>/onvif/snapshot?Profile_1` (Digest sign-in) |

### Step 3 — Solve the sign-in problem (Digest vs Basic)

With the correct password, OpenCV/FFmpeg **still** got `401`. Testing by hand showed
why:

- The camera offers both **Digest** and **Basic** sign-in for RTSP.
- It **rejects a correct Digest answer**, but accepts **Basic**.
- FFmpeg always prefers Digest when it is offered, so it could never get in.

**Fix:** our recorder starts a tiny relay on `127.0.0.1` (this computer only) that
passes the RTSP connection through to the camera but removes the line in which the
camera offers Digest. FFmpeg then falls back to Basic and connects. The video
itself passes through untouched, and nothing new is exposed on the network.

### Step 4 — Record clips straight from the camera

We wrote a recording script (`ml/record_camera.py` in the FiremeX add-on repository)
that:

1. reads the RTSP stream **over TCP** (Wi-Fi safe),
2. records a set of fixed-length clips for one **labelled session**
   (for example `smoke_2m_day`, or `no_smoke_walk_past`),
3. waits a few seconds between clips so we can reset the scene,
4. reconnects automatically when the Wi-Fi drops,
5. writes every clip to a list (`clips.csv`) with label, time, frame count, fps
   and resolution,
6. never prints the password (it is masked in all output).

Example:

```bash
export CAMERA_URL='rtsp://admin:<password>@<camera-ip>:554/Streaming/Channels/101'
python ml/record_camera.py --label smoke_2m_day --clips 5 --seconds 30 --gap 10 --basic-auth
```

A clip must be stopped with **Ctrl-C (SIGINT)**, not by killing the process:
otherwise the MP4 file is never finalised and cannot be opened. We lost one clip
(`take2_02`) this way before we learned it.

### Step 5 — What we recorded (26 October 2026)

| Session | Scene | Clips | Length | Resolution | Delivered fps |
|---|---|---|---|---|---|
| `lighter_1m` | Lighter flame about 1 m from the camera | 3 | 30 s each | 1920 × 1080 | ~18–22 |
| `take2` | Burning paper in a metal bowl | 1 usable | 30 s | 1920 × 1080 | ~22 |
| `take3` | Burning paper in a metal bowl | 3 | 30 s each | 1920 × 1080 | ~22 |

About 4,200 frames in total. Clips are kept out of Git (they are large and show
the inside of a home) and indexed in `clips.csv`.

### Step 6 — Put the camera into Home Assistant for live detection

For live monitoring, FiremeX does not open the camera itself — Home Assistant does
(see `CAMERA_SETUP.md`). We added the camera to Home Assistant as a
**Generic Camera** using the RTSP main stream and the snapshot address above.
FiremeX then found it automatically as a `camera.*` entity and began checking it.

---

## 5. Route B — EZVIZ cameras that only work through the cloud

Some EZVIZ cameras have **Video Encryption** turned on and no local access option.
Their video can only be decoded by EZVIZ's own player. For these we built an
**EZVIZ bridge** into the FiremeX add-on:

1. The owner creates keys on the **EZVIZ Open Platform** (App Key and App Secret).
2. The bridge asks EZVIZ for an access token and opens EZVIZ's official web player
   (EZUIKit) in a headless Chromium browser, with the camera's serial number and
   verification code.
3. It captures about 2 pictures per second from the player and serves them as an
   **MJPEG stream and snapshot**, protected by a username and password.
4. FiremeX adds that stream to Home Assistant, and from then on it is watched like
   any other camera.

Security: the browser runs as a separate unprivileged user and never sees Home
Assistant's credentials.

**Status:** the bridge was tested with a simulated player. Our own TY1 Pro did not
need it, because local access (Route A) worked, so it has **not yet been proven on
a real encrypted camera**.

---

## 6. What the footage taught us

- **Footage from the camera itself matters.** Our camera shows burning paper as
  **pink/purple**, not orange. A model trained only on public datasets scored this
  real fire low; after training with our own clips, fire was caught in about
  **94% of frames** of the held-out clip (model-v4).
- **A lighter flame is a tiny white spot** (about 20 × 30 pixels at 1 m). It is now
  labelled as `small_flame` and never raises a fire alarm.
- **Split by session, not by frame.** Neighbouring frames of one clip are almost
  identical. One whole clip (`take3_02`) and one lighter clip were kept back as the
  test set, so the score is honest.
- **Missing data is visible in the results.** We have no smoke clips from this
  camera yet, and smoke detection on it is the weakest part. Next recordings:
  cigarette and incense smoke at 1, 2 and 4 m, day and night, plus people walking
  past with no smoke.

---

## 7. Security and privacy notes

- Change the camera's local password from any default, and never use the sticker
  code as the network password.
- Camera addresses with passwords are kept in local files with owner-only
  permission, never in Git, and are masked in every log.
- Recorded clips stay on the project machine; they are not committed.
- RTSP and ONVIF should only be reachable on the home/site network, never
  forwarded to the internet.

---

## 8. Quick checklist for the next camera

1. Check whether port 554 (RTSP) is open. If not, look for a local access / RTSP
   option in the manufacturer's app.
2. Set a local password; sign in as `admin` with it.
3. Try `rtsp://…/Streaming/Channels/101` (main) and `/102` (sub) for Hikvision/EZVIZ;
   otherwise use ONVIF discovery to find the address.
4. Read over **TCP**. If you get `401` with the right password, try Basic sign-in.
5. Record labelled sessions straight from the stream; stop with Ctrl-C.
6. Add the camera to Home Assistant (Generic Camera or ONVIF) for live detection.
7. If the camera only works through the vendor's cloud, use the EZVIZ bridge route.
