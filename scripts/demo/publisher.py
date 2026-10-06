"""Host publisher with credentials redacted from FFmpeg diagnostic output."""
import os
import re
import subprocess
import sys
from urllib.parse import quote

mode = sys.argv[1]
if len(sys.argv) < 3:
    sys.exit('Usage: publish-camera.sh --list | DEVICE, or publish-video.sh CLIP')
source = sys.argv[2]
if mode == 'camera' and source == '--list':
    subprocess.run(['ffmpeg', '-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''])
    sys.exit(0)  # FFmpeg exits nonzero after enumeration by design.
password = os.environ.get('RTSP_PASSWORD')
if not password:
    sys.exit('Set RTSP_PASSWORD privately; do not put credentials in scripts or commits.')
path = os.environ.get('RTSP_PATH', 'webcam' if mode == 'camera' else 'replay')
if not re.fullmatch(r'[A-Za-z0-9_-]+', path):
    sys.exit('RTSP_PATH must be a simple named path enabled in MediaMTX permissions.')
user = os.environ.get('RTSP_USER', 'firemex')
host = os.environ.get('RTSP_HOST', '127.0.0.1:8554')
url = f'rtsp://{quote(user, safe="")}:{quote(password, safe="")}@{host}/{path}'
command = ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-nostdin']
if mode == 'camera':
    command += ['-f', 'avfoundation', '-framerate', os.environ.get('CAMERA_FPS', '30'),
                '-video_size', os.environ.get('CAMERA_SIZE', '1280x720'), '-i', source + ':none']
else:
    if not os.path.isfile(source):
        sys.exit('Replay clip not found')
    command += ['-re', '-stream_loop', '-1', '-i', source]
command += ['-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
            '-pix_fmt', 'yuv420p', '-g', '30', '-rtsp_transport', 'tcp', '-f', 'rtsp', url]
print(f'Publishing {"Recorded replay" if mode == "replay" else "Selected camera"} to {path}. Ctrl-C stops capture.', flush=True)
process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
try:
    for line in process.stderr:
        print(line.replace(url, '[authenticated RTSP stream]').replace(quote(password, safe=''), '[redacted]').replace(password, '[redacted]'), end='', flush=True)
    code = process.wait()
    if code and mode == 'camera':
        print('Check macOS camera permission for this host app and device-supported size/FPS.', file=sys.stderr)
    sys.exit(code)
except KeyboardInterrupt:
    process.terminate()
    process.wait(timeout=10)
