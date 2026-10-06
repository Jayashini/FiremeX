"""Draw detection boxes onto a frame.

Kept in its own file, separate from detect_service.py, for one practical
reason: this module imports nothing but Pillow. detect_service.py pulls in
PyTorch and Ultralytics, which take several seconds and ~2 GB to load, so
testing the drawing through it would mean loading a neural network to check
that a rectangle is red.

    python -c "import annotate; annotate.self_test()"

runs in under a second and writes a sample image you can look at.
"""
import io

from PIL import Image, ImageDraw, ImageFont

# Box colours match the FiremeX dashboard, so what an operator sees on the
# photo is the same language as the row it sits next to: fire is red, smoke is
# amber. Anything the model reports that is neither is drawn red, because an
# unrecognised hazard should look serious, not decorative.
BOX_COLOURS = {
    "fire": (220, 38, 38),
    "smoke": (245, 158, 11),
}
UNKNOWN_COLOUR = (220, 38, 38)

_font = None


def label_font(size: int = 16):
    """Return a font for the labels, working on whatever machine this runs on.

    Pillow's built-in font is a fixed tiny bitmap, unreadable on a 1080p CCTV
    frame. So we look for a real font first and only fall back if none is
    found. The result is cached because loading a font per frame is wasteful.
    """
    global _font
    if _font is not None:
        return _font

    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",   # macOS
        "/System/Library/Fonts/Supplemental/Arial.ttf",        # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            _font = ImageFont.truetype(path, size)
            return _font
        except OSError:
            continue

    # Nothing found. Pillow 10.1+ can at least scale its built-in font;
    # older versions cannot, hence the TypeError branch.
    try:
        _font = ImageFont.load_default(size=size)
    except TypeError:
        _font = ImageFont.load_default()
    return _font


def draw_boxes(frame: Image.Image, detections: list) -> bytes:
    """Return JPEG bytes of `frame` with one labelled box per detection.

    `detections` is the list this service already returns: each item has
    "label", "confidence" (0.0-1.0) and "box" with x1/y1/x2/y2.

    The frame is copied rather than drawn on, so the caller's image is never
    altered underneath it.
    """
    canvas = frame.copy()
    draw = ImageDraw.Draw(canvas)
    font = label_font()

    # Line thickness scales with the picture. A 2px box is invisible on a 4K
    # frame and a 10px box swallows a small one.
    thickness = max(2, round(min(canvas.size) / 250))

    for detection in detections:
        box = detection["box"]
        x1, y1 = box["x1"], box["y1"]
        x2, y2 = box["x2"], box["y2"]
        colour = BOX_COLOURS.get(detection["label"], UNKNOWN_COLOUR)

        draw.rectangle([x1, y1, x2, y2], outline=colour, width=thickness)

        caption = f"{detection['label']} {detection['confidence']:.0%}"
        left, top, right, bottom = draw.textbbox((0, 0), caption, font=font)
        text_w, text_h = right - left, bottom - top

        # The label sits above the box. When the box is already at the top of
        # the frame there is no room, so it drops inside instead of being
        # drawn off-screen where nobody sees it.
        label_y = y1 - text_h - 6
        if label_y < 0:
            label_y = y1 + 2

        draw.rectangle(
            [x1, label_y, x1 + text_w + 8, label_y + text_h + 6],
            fill=colour,
        )
        draw.text((x1 + 4, label_y + 3), caption, fill=(255, 255, 255), font=font)

    buffer = io.BytesIO()
    # 85 is the usual "you cannot see the difference" quality. These frames are
    # kept on disk for months, so halving the file size is worth having.
    canvas.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def self_test(path: str = "annotate_sample.jpg") -> str:
    """Draw two boxes on a blank frame and save it. No model needed."""
    frame = Image.new("RGB", (640, 480), (30, 35, 40))
    data = draw_boxes(frame, [
        {"label": "fire", "confidence": 0.71,
         "box": {"x1": 310, "y1": 300, "x2": 420, "y2": 400}},
        {"label": "smoke", "confidence": 0.58,
         "box": {"x1": 60, "y1": 0, "x2": 220, "y2": 150}},
    ])
    with open(path, "wb") as handle:
        handle.write(data)
    return f"{path}  ({len(data)} bytes)"


if __name__ == "__main__":
    print(self_test())
