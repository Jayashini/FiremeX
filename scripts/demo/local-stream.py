"""Run a local demo publisher or JPEG bridge with gitignored MediaMTX auth.

Use firemex-model/.venv/bin/python so PyYAML is available. Credentials stay in
the process environment and are never printed by this launcher.
"""
import os
from pathlib import Path
import sys

import yaml

ROOT = Path(__file__).resolve().parents[2]
USAGE = 'Usage: local-stream.py camera DEVICE | replay VIDEO | bridge webcam|replay'

if len(sys.argv) < 3 or sys.argv[1] not in ('camera', 'replay', 'bridge'):
    raise SystemExit(USAGE)
mode = sys.argv[1]
if mode == 'bridge' and (len(sys.argv) != 3 or sys.argv[2] not in ('webcam', 'replay')):
    raise SystemExit(USAGE)
if mode in ('camera', 'replay') and len(sys.argv) != 3:
    raise SystemExit(USAGE)

config_path = ROOT / 'mediamtx.yml'
if not config_path.is_file():
    raise SystemExit('Create the gitignored mediamtx.yml from mediamtx.yml.example first')
config = yaml.safe_load(config_path.read_text())
user = next((item for item in config.get('authInternalUsers', [])
             if item.get('user') == 'firemex'), None)
if not user or not user.get('pass'):
    raise SystemExit('No firemex stream password in mediamtx.yml')
env = os.environ.copy()
env['RTSP_USER'] = 'firemex'
env['RTSP_PASSWORD'] = user['pass']
if mode == 'bridge':
    env['RTSP_PATH'] = sys.argv[2]
    env['SNAPSHOT_BRIDGE_PORT'] = '8765' if sys.argv[2] == 'webcam' else '8766'
    script = ROOT / 'scripts/demo/snapshot-bridge.py'
    args = [sys.executable, str(script)]
else:
    env['RTSP_PATH'] = 'webcam' if mode == 'camera' else 'replay'
    script = ROOT / 'scripts/demo/publisher.py'
    args = [sys.executable, str(script), mode, sys.argv[2]]
os.execve(sys.executable, args, env)
