"""FiremeX fire/smoke detection service.

A small HTTP wrapper around the YOLOv8 model. It exists because the model is a
PyTorch checkpoint and your backend is Go — rather than trying to run PyTorch
from Go, run this alongside it and call it over HTTP.

    pip install -r requirements.txt
    python detect_service.py                  # listens on :8100

Then from Go (or anything else):

    POST http://localhost:8100/detect
      multipart form field "image"     = a JPEG/PNG        (required)
      multipart form field "annotate"  = true              (optional)
      multipart form field "threshold" = 0.55              (optional)
    ->
    {
      "hazard": true,
      "detections": [
        {"label": "fire", "confidence": 0.64,
         "box": {"x1": 310, "y1": 300, "x2": 340, "y2": 355}}
      ],
      "annotated_image": "<base64 JPEG>"   # only when annotate=true and
    }                                      # something was detected

Send only "image" and the response is exactly what it has always been - the
two extra fields are additive and default to off.

The model is loaded ONCE at startup, not per request — loading it takes a few
seconds and doing that per frame would make the service unusable.
"""
import base64
import io
import logging
import os

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image
from ultralytics import YOLO

from annotate import draw_boxes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("firemex.detect")

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "fire_model.pt"))

# Minimum confidence for a detection to be reported. 0.50 is the value the
# original project ships with; see README for why you may want it higher.
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.50"))

PORT = int(os.environ.get("PORT", "8100"))

app = FastAPI(title="FiremeX detection service")
model: YOLO | None = None


@app.on_event("startup")
def load_model():
    global model
    if not os.path.exists(MODEL_PATH):
        raise SystemExit(f"Model not found at {MODEL_PATH}. Set MODEL_PATH or put "
                         f"fire_model.pt next to this file.")
    logger.info(f"loading model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    logger.info(f"ready — classes: {model.names}  threshold: {CONFIDENCE_THRESHOLD}")


@app.get("/health")
def health():
    """Cheap liveness check — use this from docker-compose or your Go startup."""
    return {"ok": model is not None,
            "classes": model.names if model else None,
            "threshold": CONFIDENCE_THRESHOLD}


@app.post("/detect")
async def detect(
    image: UploadFile = File(...),
    annotate: bool = Form(False),
    threshold: float | None = Form(None),
):
    """Run the model on one frame and return every detection above threshold.

    Both extra form fields are OPTIONAL, and sending neither gives exactly the
    behaviour this endpoint has always had.

        annotate=true       also return the frame with the boxes drawn on it,
                            base64-encoded, as "annotated_image". Only present
                            when something was actually detected.

        threshold=0.55      use this cut-off for this one request instead of
                            CONFIDENCE_THRESHOLD. This lets the caller own the
                            sensitivity setting, so it can be tuned in one
                            place without restarting this service.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="model not loaded")

    # Clamped, because a caller sending 1.5 should get "nothing matches", not
    # an exception, and -1 should not turn every pixel into a fire.
    cutoff = CONFIDENCE_THRESHOLD if threshold is None else min(max(threshold, 0.0), 1.0)

    raw = await image.read()
    try:
        frame = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="could not decode image")

    results = model(frame, verbose=False)[0]

    detections = []
    for box in results.boxes:
        confidence = float(box.conf[0])
        if confidence < cutoff:
            continue
        x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])
        detections.append({
            "label": results.names[int(box.cls[0])],
            "confidence": round(confidence, 4),
            "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })

    response = {"hazard": bool(detections), "detections": detections}

    # Drawing costs a decode and re-encode, so it is only done when asked for
    # AND when there is something to draw. A quiet frame stays cheap.
    if annotate and detections:
        response["annotated_image"] = base64.b64encode(
            draw_boxes(frame, detections)
        ).decode("ascii")

    return response


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
