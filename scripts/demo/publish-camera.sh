#!/usr/bin/env bash
set -euo pipefail
# --list enumerates devices; otherwise pass an explicitly selected device name/index.
exec python3 "$(dirname "$0")/publisher.py" camera "$@"
