"""Benchmark real /detect on supplied frames; never silently relabel misses."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import time
import requests

parser = argparse.ArgumentParser()
parser.add_argument('images', nargs='+', type=Path)
parser.add_argument('--url', default='http://127.0.0.1:8100')
parser.add_argument('--threshold', type=float, default=.5)
parser.add_argument('--expected', choices=['fire', 'smoke', 'none', 'unknown'], default='unknown')
parser.add_argument('--out', type=Path, default=Path('.demo-runtime/model-results.jsonl'))
args = parser.parse_args()
args.out.parent.mkdir(parents=True, exist_ok=True)
health = requests.get(args.url + '/health', timeout=10); health.raise_for_status()
print(json.dumps({'health': health.json()}))
for path in args.images:
    raw = path.read_bytes()
    for run in range(3):
        start = time.monotonic()
        response = requests.post(args.url + '/detect', files={'image': (path.name, raw)}, data={'annotate': 'true', 'threshold': args.threshold}, timeout=30)
        response.raise_for_status()
        result = response.json()
        annotation = result.pop('annotated_image', None)
        labels = {d['label'] for d in result['detections']}
        outcome = 'unscored' if args.expected == 'unknown' else ('pass' if (not labels if args.expected == 'none' else args.expected in labels) else 'miss_or_false_positive')
        record = {'sample': path.name, 'sha256': hashlib.sha256(raw).hexdigest(), 'run': run, 'seconds': round(time.monotonic() - start, 3), 'threshold': args.threshold, 'expected': args.expected, 'outcome': outcome, **result}
        if annotation:
            (args.out.parent / (path.stem + '-annotated.jpg')).write_bytes(base64.b64decode(annotation))
        with args.out.open('a') as output:
            output.write(json.dumps(record) + '\n')
        print(json.dumps(record))
