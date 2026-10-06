#!/usr/bin/env bash
set -euo pipefail
# The first argument is a permissioned local clip. Enroll it as Recorded replay.
exec python3 "$(dirname "$0")/publisher.py" replay "$@"
