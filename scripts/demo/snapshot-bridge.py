"""Authenticated, bounded JPEG stills from the local MediaMTX webcam stream.

Home Assistant Generic Camera can consume /webcam.jpg as its Still Image URL.
The bridge keeps one RTSP decoder, never starts one for each HTTP request.
"""
import base64
from datetime import datetime, timezone
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import subprocess
import threading
import time
from urllib.parse import quote, urlsplit

MAX_FRAME = 10 * 1024 * 1024
STALE_AFTER = 5.0
RTSP_USER = os.environ.get('RTSP_USER', 'firemex')
RTSP_PASSWORD = os.environ.get('RTSP_PASSWORD', '')
if not RTSP_PASSWORD:
    raise SystemExit('Set RTSP_PASSWORD privately before starting the bridge')
RTSP_HOST = os.environ.get('RTSP_HOST', '127.0.0.1:8554')
RTSP_PATH = os.environ.get('RTSP_PATH', 'webcam')
if not re.fullmatch(r'[A-Za-z0-9_-]+', RTSP_PATH):
    raise SystemExit('RTSP_PATH must be a simple named path')
PORT = int(os.environ.get('SNAPSHOT_BRIDGE_PORT', '8765'))
if not 1 <= PORT <= 65535:
    raise SystemExit('Invalid SNAPSHOT_BRIDGE_PORT')
STREAM_URL = f'rtsp://{quote(RTSP_USER, safe="")}:{quote(RTSP_PASSWORD, safe="")}@{RTSP_HOST}/{RTSP_PATH}'
STILL_PATH = f'/{RTSP_PATH}.jpg'

lock = threading.Lock()
latest = None
received_monotonic = 0.0
received_utc = ''
child = None
stop = threading.Event()


def decode_loop():
    global latest, received_monotonic, received_utc, child
    while not stop.is_set():
        args = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
                '-rtsp_transport', 'tcp', '-i', STREAM_URL,
                '-vf', 'fps=2', '-an', '-f', 'image2pipe', '-vcodec', 'mjpeg',
                '-q:v', '4', 'pipe:1']
        child = subprocess.Popen(args, stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL, bufsize=0)
        buffer = bytearray()
        try:
            while not stop.is_set():
                block = child.stdout.read(65536)
                if not block:
                    break
                buffer.extend(block)
                while True:
                    start = buffer.find(b'\xff\xd8')
                    if start < 0:
                        buffer.clear()
                        break
                    if start:
                        del buffer[:start]
                    end = buffer.find(b'\xff\xd9', 2)
                    if end < 0:
                        if len(buffer) > MAX_FRAME:
                            buffer.clear()
                        break
                    frame = bytes(buffer[:end + 2])
                    del buffer[:end + 2]
                    if len(frame) <= MAX_FRAME:
                        with lock:
                            latest = frame
                            received_monotonic = time.monotonic()
                            received_utc = datetime.now(timezone.utc).isoformat()
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
            child = None
        stop.wait(1)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # A camera frame must never be available to an unauthenticated LAN peer.
        expected = 'Basic ' + base64.b64encode(
            f'{RTSP_USER}:{RTSP_PASSWORD}'.encode()).decode()
        if not hmac.compare_digest(self.headers.get('Authorization', ''), expected):
            self.send_response(401)
            self.send_header('WWW-Authenticate', 'Basic realm="FireMeX demo camera"')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        if urlsplit(self.path).path != STILL_PATH:
            self.send_error(404)
            return
        with lock:
            frame = latest
            age = time.monotonic() - received_monotonic
            stamp = received_utc
        if frame is None or age > STALE_AFTER:
            self.send_response(503)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'image/jpeg')
        self.send_header('Content-Length', str(len(frame)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Frame-Received-At', stamp)
        self.end_headers()
        self.wfile.write(frame)

    def log_message(self, format, *args):
        pass  # URL, credentials and frames must not enter diagnostics.


threading.Thread(target=decode_loop, daemon=True).start()
server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
print(f'Authenticated {RTSP_PATH} JPEG bridge listening on port {PORT}', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    stop.set()
    server.server_close()
    if child and child.poll() is None:
        child.terminate()
