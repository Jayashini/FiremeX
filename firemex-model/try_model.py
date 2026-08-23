"""Run the model on one image or video and save an annotated copy.

The quickest way to see what the model does before wiring anything up.

    python try_model.py some_photo.jpg
    python try_model.py some_clip.mp4          # samples 1 frame per second

Writes <name>_detected.jpg next to the input, with boxes drawn on it.
"""
import os
import sys

import cv2
from ultralytics import YOLO

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.path.dirname(__file__), "fire_model.pt"))
THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.50"))

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}


def annotate(model, frame):
    """Draw every detection above threshold. Returns (frame, hits)."""
    results = model(frame, verbose=False)[0]
    hits = []
    for box in results.boxes:
        confidence = float(box.conf[0])
        if confidence < THRESHOLD:
            continue
        label = results.names[int(box.cls[0])]
        x1, y1, x2, y2 = (int(v) for v in box.xyxy[0])
        hits.append((label, confidence))
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(frame, f"{label} {confidence:.0%}", (x1, max(y1 - 6, 12)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    return frame, hits


def main(path: str):
    if not os.path.exists(path):
        raise SystemExit(f"No such file: {path}")

    model = YOLO(MODEL_PATH)
    print(f"model classes: {model.names}   threshold: {THRESHOLD}")

    stem, ext = os.path.splitext(path)
    out = f"{stem}_detected.jpg"

    if ext.lower() in VIDEO_EXTS:
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        step = int(fps)                      # roughly one frame per second
        i, best_frame, best_hits = 0, None, []
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if i % step == 0:
                frame, hits = annotate(model, frame.copy())
                if hits:
                    print(f"  t={i/fps:5.1f}s  " +
                          ", ".join(f"{l} {c:.0%}" for l, c in hits))
                if len(hits) > len(best_hits):
                    best_frame, best_hits = frame, hits
            i += 1
        cap.release()
        if best_frame is None:
            print("no frames read")
            return
        cv2.imwrite(out, best_frame)
        print(f"\nstrongest frame written to {out}")
    else:
        frame = cv2.imread(path)
        if frame is None:
            raise SystemExit("Could not read that image")
        frame, hits = annotate(model, frame)
        for label, confidence in hits:
            print(f"  {label} {confidence:.0%}")
        if not hits:
            print("  (nothing above threshold)")
        cv2.imwrite(out, frame)
        print(f"written to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
