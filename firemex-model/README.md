# FiremeX fire & smoke detection model

The trained FiremeX fire and smoke model, packaged so you can use it without
setting up any training yourself.

```
fire_model.pt          the weights (5.2 MB) — model-v4, YOLO26n
detect_service.py      HTTP service — call it from your Go backend
try_model.py           run it on one image or video, see what it does
requirements.txt       what to pip install
```

sha256 of `fire_model.pt`:
`c29a62d0a76735165da5bc44b4a2c1737c33eb8191898aa8f533b5dbdf321396`

The same file (and an ONNX export) is published as GitHub Release
[model-v4](https://github.com/malika1234m/Firemax/releases/tag/model-v4).

---

## What it is

| | |
|---|---|
| Architecture | YOLO26n (Ultralytics 8.4), detection task — no NMS step |
| Classes | `0: smoke`, `1: fire` — **only these two** (always use the names, not the numbers) |
| Input | any resolution; Ultralytics letterboxes internally (trained at 640) |
| Size | 5.2 MB, about 35 ms per 1080p frame on an Apple M1 CPU |
| Trained on | all of [D-Fire](https://github.com/gaiasd/DFireDataset) (real fire/smoke photos, ~45% with neither), the [Home Fire Dataset](https://github.com/PengBo0/Home-fire-dataset) (indoor rooms, CC BY-NC 4.0) and our own EZVIZ CCTV recordings |
| Training | Google Colab T4, 60 epochs from YOLO26n COCO weights |

Needs **Ultralytics 8.4 or newer** — 8.2 cannot load YOLO26.

---

## Start here

```bash
pip install -r requirements.txt
python try_model.py /path/to/some_fire_photo.jpg
```

It prints what it found and writes `some_fire_photo_detected.jpg` with boxes
drawn on it. Works on video too (`.mp4`, `.mov`), sampling about one frame per
second and saving the strongest frame.

---

## Using it from your Go backend

Your backend is Go and this model is a PyTorch checkpoint, so they can't share a
process. Run the model as a small service beside your API and call it over HTTP:

```bash
python detect_service.py          # listens on :8100
```

```
POST http://localhost:8100/detect
  multipart form, field "image" = JPEG/PNG bytes

200 OK
{
  "hazard": true,
  "detections": [
    {"label": "fire", "confidence": 0.64,
     "box": {"x1": 310, "y1": 300, "x2": 340, "y2": 355}}
  ]
}
```

`GET /health` returns whether the model loaded, plus its classes and threshold —
useful as a startup check.

Two things worth knowing:

- **The model loads once at startup**, not per request. Loading takes a few
  seconds; doing it per frame would make the service unusable.
- **Don't send every frame.** 1–5 frames per second per camera is plenty. Fire
  does not appear and vanish in 200 ms, and you'll just burn CPU.

Configure with env vars: `MODEL_PATH`, `CONFIDENCE_THRESHOLD`, `PORT`.

---

## How well it actually works

Scores on held-out test pictures the model never trained on, against the
previous model (model-v3, YOLOv8n):

| Test set | mAP@50 v3 | mAP@50 **v4** | fire recall v4 | smoke recall v4 |
|---|---|---|---|---|
| Home Fire test (indoor) | 0.858 | **0.893** | 0.807 | 0.814 |
| Our camera test | 0.786 | **0.867** | 0.830 | — (no smoke in it) |
| D-Fire test | 0.743 | **0.773** | 0.655 | 0.795 |
| **Average** | 0.796 | **0.844** | | |

On our own camera videos (threshold 0.50, CPU):

- burning paper: fire caught in **94%** of checked frames (v3: 85%)
- a lighter held 1 m away: **no false alarms**
- smoke blown at the lens: detected (0.56)

Known weaknesses:

- **Thin or distant smoke** is still the weak spot — a cigarette puff across the
  room scores below 0.50.
- `fire` on D-Fire's outdoor/far shots has the lowest recall (0.66).
- Tested on one room and one camera; other scenes need their own check.

### The design consequence

Because the model is this uncertain, don't wire a detection straight to a
siren, a sprinkler, or an emergency call. The pattern that works is:

```
detection  →  ALERT  →  a human confirms  →  INCIDENT  →  automations fire
```

A detection is the machine's opinion. A person turns it into an incident, and
only that triggers anything physical. A false sprinkler discharge is its own
emergency, and a system that cries wolf gets ignored — which is how the real
alert gets missed.

---

## Notes

- `fire_model.pt` is a 5 MB binary. **Don't commit it to git** — it'll bloat the
  repo permanently, and every clone pays for it. Attach it to a GitHub Release
  and download it at build/run time, or keep this folder outside the repo.
- Ultralytics is AGPL-3.0. That has licensing implications if you ever
  distribute this commercially; fine for coursework, worth knowing about.
- The model is loaded with `torch.load`, which executes pickled code. Only ever
  load weights files you trust the origin of — verify the sha256 above.
