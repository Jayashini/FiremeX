# FiremeX Camera Setup Guide

This guide explains how the camera integration works in FiremeX, specifically how to bridge your physical MacBook webcam into the system via Home Assistant (HA).

## 🏗️ Architecture Overview

Home Assistant runs in a Docker container, which means it cannot directly access the hardware of the host machine (your Mac's built-in webcam). To solve this, we create a small network bridge using a Python server.

```mermaid
flowchart TD
    subgraph Host Machine (Mac)
        Cam[Built-in Webcam]
        Py[Python MJPEG Server\n:8090]
    end

    subgraph Docker
        HA[Home Assistant\n:8123]
    end
    
    subgraph FiremeX System
        Go[Go Backend\n:8080]
        React[Frontend App\n:5173]
    end

    Cam -->|Video Frames| Py
    Py -->|MJPEG Stream over HTTP| HA
    HA -->|Proxy Stream Request| Go
    Go -->|Proxied Stream| React
```

## 🛠️ Step-by-Step Setup

### Step 1: Install Python Dependencies on your Mac

You need a small Python script to capture webcam frames and serve them over HTTP as an MJPEG stream.

```bash
pip3 install opencv-python flask
```

### Step 2: Create the Webcam Server Script

Create a file named `webcam_server.py` on your Mac (e.g., on your Desktop or in the project root):

```python
import cv2
from flask import Flask, Response

app = Flask(__name__)

# 0 is usually the default built-in webcam
camera = cv2.VideoCapture(0)

def generate_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break

        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        # Yield as MJPEG stream
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        )

@app.route('/stream')
def stream():
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/')
def index():
    return '<h2>Webcam stream running at <a href="/stream">/stream</a></h2>'

if __name__ == '__main__':
    print("Webcam server starting on http://0.0.0.0:8090")
    app.run(host='0.0.0.0', port=8090, threaded=True)
```

### Step 3: Run the Server

Execute the script in your terminal:

```bash
python3 webcam_server.py
```
*(Your Mac may prompt you to grant the Terminal permission to access the camera).*

You can verify the stream is working by opening `http://localhost:8090/stream` in your browser.

### Step 4: Add the Camera to Home Assistant

Home Assistant is running inside Docker. To reach the Python server running on your Mac host, we use Docker's internal host DNS: `host.docker.internal`.

1. Go to your Home Assistant dashboard (`http://localhost:8123`).
2. Navigate to **Settings -> Devices & Services**.
3. Click **+ Add Integration** and search for **Generic Camera**.
4. Configure the integration with the following URLs:
    *   **Still Image URL:** `http://host.docker.internal:8090/stream`
    *   **Stream Source URL:** `http://host.docker.internal:8090/stream`
5. Submit the configuration. This creates an entity in HA, usually named `camera.webcam` or similar.

### Step 5: Add the Camera in FiremeX

Now that the camera is registered in Home Assistant, FiremeX can discover it.

1. Open the FiremeX Admin Dashboard (`http://localhost:5173/FiremeX/admin/livefeed`).
2. Click the **Add Camera** button.
3. The dropdown will securely fetch available cameras from Home Assistant using your Long-Lived Access Token. You should see `camera.webcam` in the list.
4. Select the camera, assign it a name and zone, and save.
5. The live feed will now appear on the dashboard!

---

## 🔍 How the Stream is Proxied

Because the FiremeX Frontend runs on `:5173` and Home Assistant runs on `:8123`, trying to load the stream directly from HA in the browser would result in CORS (Cross-Origin Resource Sharing) blocks.

To bypass this securely, the FiremeX Go backend (`:8080`) acts as a stream proxy:

1. The React frontend requests `GET /api/cameras/stream/:entity_id` from the Go backend.
2. The Go backend fetches the stream from Home Assistant using the `HA_TOKEN` defined in `.env`.
3. The Go backend continuously pipes the incoming bytes from Home Assistant directly back to the React frontend using a `multipart/x-mixed-replace` HTTP response.
4. The browser effortlessly renders the stream as a standard `<img src="..." />` without any CORS issues.
