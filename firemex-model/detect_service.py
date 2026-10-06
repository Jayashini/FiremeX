"""Bounded local CPU inference. Run exactly one Uvicorn worker."""
import asyncio
import base64
import hashlib
import io
import logging
import math
import os
import threading
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image
from starlette.concurrency import run_in_threadpool
from ultralytics import YOLO
from annotate import draw_boxes

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "fire_model.pt"))
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.50"))
PORT = int(os.environ.get("PORT", "8100"))
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
model = None
model_version = None
inference_lock = threading.Lock()
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app):
    global model, model_version
    if not math.isfinite(CONFIDENCE_THRESHOLD) or not 0 <= CONFIDENCE_THRESHOLD <= 1:
        raise ValueError("CONFIDENCE_THRESHOLD must be in [0,1]")
    with open(MODEL_PATH, "rb") as weights:
        model_version = "sha256:" + hashlib.file_digest(weights, "sha256").hexdigest()
    model = YOLO(MODEL_PATH)
    if set(model.names.values()) != {"fire", "smoke"}:
        raise ValueError("Model must have exactly fire and smoke classes")
    yield


app = FastAPI(title="FiremeX detection service", lifespan=lifespan)


class UploadLimit:
    """Bound the whole multipart request before Starlette parses/spools it."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") != "/detect":
            return await self.app(scope, receive, send)
        body = bytearray()
        try:
            while True:
                message = await asyncio.wait_for(receive(), timeout=15)
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > MAX_BYTES + 64 * 1024:
                    await send({"type": "http.response.start", "status": 413, "headers": []})
                    await send({"type": "http.response.body", "body": b"Upload too large"})
                    return
                if not message.get("more_body", False):
                    break
        except asyncio.TimeoutError:
            await send({"type": "http.response.start", "status": 408, "headers": []})
            await send({"type": "http.response.body", "body": b"Upload timed out"})
            return
        delivered = False
        async def bounded_receive():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}
        await self.app(scope, bounded_receive, send)


app.add_middleware(UploadLimit)


@app.get("/health")
async def health():
    return {"ok": model is not None, "classes": model.names if model else None,
            "threshold": CONFIDENCE_THRESHOLD, "model_version": model_version,
            "device": "cpu", "busy": inference_lock.locked()}


def infer(raw, annotate, cutoff):
    if not inference_lock.acquire(blocking=False):
        raise HTTPException(503, "inference busy; retry later")
    try:
        try:
            with Image.open(io.BytesIO(raw)) as source:
                if source.format not in {"JPEG", "PNG"} or source.width * source.height > MAX_PIXELS:
                    raise ValueError("image bounds")
                source.load()
                frame = source.convert("RGB")
        except Exception:
            raise HTTPException(400, "could not decode bounded JPEG/PNG")
        results = model(frame, conf=cutoff, device="cpu", verbose=False)[0]
        detections = []
        for box in results.boxes:
            confidence = float(box.conf[0])
            label = results.names[int(box.cls[0])]
            x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
            if (label not in {"fire", "smoke"} or not math.isfinite(confidence)
                    or not 0 <= confidence <= 1 or not all(map(math.isfinite, (x1, y1, x2, y2)))
                    or not 0 <= x1 < x2 <= frame.width or not 0 <= y1 < y2 <= frame.height):
                raise HTTPException(500, "invalid model output")
            if confidence < cutoff:
                continue
            detections.append({"label": label, "confidence": confidence,
                               "box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2}})
        response = {"hazard": bool(detections), "detections": detections, "model_version": model_version}
        if annotate and detections:
            response["annotated_image"] = base64.b64encode(draw_boxes(frame, detections)).decode("ascii")
        return response
    finally:
        inference_lock.release()


@app.post("/detect")
async def detect(image: UploadFile = File(...), annotate: bool = Form(False), threshold: float | None = Form(None)):
    if model is None:
        raise HTTPException(503, "model not loaded")
    cutoff = CONFIDENCE_THRESHOLD if threshold is None else threshold
    if not math.isfinite(cutoff) or not 0 <= cutoff <= 1:
        raise HTTPException(422, "threshold must be finite and in [0,1]")
    raw = await image.read(MAX_BYTES + 1)
    await image.close()
    if not raw or len(raw) > MAX_BYTES:
        raise HTTPException(413, "empty or oversized image")
    return await run_in_threadpool(infer, raw, annotate, cutoff)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, limit_concurrency=8)
