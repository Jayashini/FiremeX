"""FiremeX fire/smoke detection service.

A small HTTP wrapper around the YOLOv8 model. It exists because the model is a
PyTorch checkpoint and your backend is Go — rather than trying to run PyTorch
from Go, run this alongside it and call it over HTTP.

    pip install -r requirements.txt
    python detect_service.py                  # listens on :8100

Then from Go (or anything else):

    POST http://localhost:8100/detect
      multipart form field "image" = a JPEG/PNG
    ->
    {
      "hazard": true,
      "detections": [
        {"label": "fire", "confidence": 0.64,
         "box": {"x1": 310, "y1": 300, "x2": 340, "y2": 355}}
      ]
    }

The model is loaded ONCE at startup, not per request — loading it takes a few
seconds and doing that per frame would make the service unusable.
"""
import io
import logging
import os

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from ultralytics import YOLO

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
async def detect(image: UploadFile = File(...)):
    """Run the model on one frame and return every detection above threshold."""
    if model is None:
        raise HTTPException(status_code=503, detail="model not loaded")

    raw = await image.read()
    try:
        frame = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="could not decode image")

    results = model(frame, verbose=False)[0]

    detections = []
    for box in results.boxes:
        confidence = float(box.conf[0])
        if confidence < CONFIDENCE_THRESHOLD:
            continue
        x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])
        detections.append({
            "label": results.names[int(box.cls[0])],
            "confidence": round(confidence, 4),
            "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        })

    return {"hazard": bool(detections), "detections": detections}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
