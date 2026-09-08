# FiremeX fire & smoke detection model

The trained YOLOv8 model from the FiremeX project, packaged so you can use it
without setting up any training yourself.

```
fire_model.pt          the weights (6.0 MB)
detect_service.py      HTTP service — call it from your Go backend
try_model.py           run it on one image or video, see what it does
requirements.txt       what to pip install
PR_curve.png           precision/recall curves from training
confusion_matrix.png   normalised confusion matrix
```

sha256 of `fire_model.pt`:
`2ab009042ba04827ee1cd1ccb0648832577677334c5fe4927e7c7950f7406c89`

---

## What it is

| | |
|---|---|
| Architecture | YOLOv8n (Ultralytics), detection task |
| Classes | `0: fire`, `1: smoke` — **only these two** |
| Input | any resolution; Ultralytics letterboxes internally |
| Size | 6.0 MB, runs on CPU |
| Trained on | [Simuletic CCTV-Smoke-Fire-Emergency-Detection-Dataset](https://huggingface.co/datasets/Simuletic/CCTV-Smoke-Fire-Emergency-Detection-Dataset) (Hugging Face) |

Trained on **CCTV-style footage** specifically, rather than the dramatic
close-up fire photos most public fire datasets use. That matters — a model
trained on close-ups tends to do poorly on a wide-angle camera looking down a
warehouse aisle, which is the actual use case.

The dataset was split **by scene group, not by frame.** The source has 48 scenes
of ~5 near-identical frames each; splitting per-image would put nearly identical
frames in both train and validation, and the reported accuracy would be
inflated by memorisation. If you retrain, keep that in mind — it's the easiest
way to accidentally report a great number that means nothing.

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

Being straight with you, because you'll build on top of this:

| Metric (best epoch, 17 of 27) | |
|---|---|
| Precision | 0.53 |
| Recall | 0.35 |
| mAP@50 | 0.27 |
| mAP@50-95 | 0.12 |

**This is a v1 model, and it is not production-accurate.** Specifically:

- **`fire` is the weak class** — recall around 0.22. Smoke is noticeably better.
  Counter-intuitive, but smoke is large and textured while flame is often small,
  bright and blown-out on CCTV.
- **False positives on orange/yellow vertical objects.** In our own testing it
  boxed yellow bollards as `fire 55%`. Anything amber and upright is a candidate.
- The default threshold of **0.50 is on the low side** given that. Try 0.60 if
  you're seeing too much noise — you'll lose some true positives, so decide
  deliberately which error you'd rather have.

Look at `PR_curve.png` and `confusion_matrix.png` before you trust any number
here.

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

## If you want to improve it

The honest paths, roughly in order of payoff:

1. **More real CCTV data.** 48 scenes is small. This is by far the biggest lever.
2. **Train longer with sensible early stopping.** Ours stopped at 27 epochs;
   `patience=10` triggered on noise rather than a real plateau.
3. **A bigger backbone.** YOLOv8n is the smallest. `yolov8s` costs more CPU and
   would likely help, if your target hardware can afford it.

Keep the scene-group split if you rebuild the dataset.

---

## Notes

- `fire_model.pt` is a 6 MB binary. **Don't commit it to git** — it'll bloat the
  repo permanently, and every clone pays for it. Attach it to a GitHub Release
  and download it at build/run time, or keep this folder outside the repo.
- Ultralytics is AGPL-3.0. That has licensing implications if you ever
  distribute this commercially; fine for coursework, worth knowing about.
- The model is loaded with `torch.load`, which executes pickled code. Only ever
  load weights files you trust the origin of — verify the sha256 above.
