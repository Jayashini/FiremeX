"""Read-only local dependency checks. Saves a real HA frame without printing secrets."""
import hashlib
import json
from pathlib import Path
import time
import urllib.request

root = Path(__file__).resolve().parents[2]
settings = {}
for line in (root / 'backend/.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        settings[key.strip()] = value.strip().strip('\"\'')
url = settings.get('HA_URL', 'http://localhost:8123').rstrip('/')
def get(path):
    req = urllib.request.Request(url + path, headers={'Authorization': 'Bearer ' + settings.get('HA_TOKEN', '')})
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read(10 * 1024 * 1024 + 1)
try:
    states = json.loads(get('/api/states'))
    entities = [state for state in states if state['entity_id'].startswith('camera.')]
    print(json.dumps([{'entity_id': state['entity_id'], 'state': state['state'], 'name': state.get('attributes', {}).get('friendly_name')} for state in entities]))
    out = root / '.demo-runtime'; out.mkdir(exist_ok=True)
    for state in entities:
        entity = state['entity_id']
        try:
            first = get('/api/camera_proxy/' + entity)
        except Exception as exc:
            print(entity, 'snapshot failed:', type(exc).__name__, getattr(exc, 'code', '')); continue
        (out / (entity + '.jpg')).write_bytes(first)
        time.sleep(1)
        second = get('/api/camera_proxy/' + entity)
        print(json.dumps({'entity_id': entity, 'bytes': len(first), 'successive_bytes_changed': first != second, 'sha256': hashlib.sha256(first).hexdigest(), 'note': 'Changing bytes alone do not prove source freshness; observe a changing visual element.'}))
except Exception as exc:
    print('Preflight unavailable:', type(exc).__name__, getattr(exc, 'code', ''))
    raise SystemExit(1)
