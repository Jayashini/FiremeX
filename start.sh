#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME="$ROOT/.firemex-runtime"
mkdir -p "$RUNTIME"
cd "$ROOT"

for command_name in docker curl go npm; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Missing required command: $command_name"
        exit 1
    fi
done

if docker inspect homeassistant >/dev/null 2>&1; then
    export HOMEASSISTANT_IMAGE="$(docker inspect --format='{{.Config.Image}}' homeassistant)"
else
    export HOMEASSISTANT_IMAGE="$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | awk '/home-assistant/ { print; exit }')"
    export HOMEASSISTANT_IMAGE="${HOMEASSISTANT_IMAGE:-ghcr.io/home-assistant/home-assistant:stable}"
fi

echo "Starting PostgreSQL and Home Assistant..."
docker compose up -d

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 60); do
    if docker exec firemex_db pg_isready -U admin -d firemex >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
if ! docker exec firemex_db pg_isready -U admin -d firemex >/dev/null 2>&1; then
    echo "PostgreSQL did not become ready. Run: docker compose logs db"
    exit 1
fi

if [ ! -x "$ROOT/firemex-model/.venv/bin/python" ]; then
    command -v python3 >/dev/null 2>&1 || { echo "Missing required command: python3"; exit 1; }
    echo "Creating the AI model environment..."
    python3 -m venv "$ROOT/firemex-model/.venv"
    "$ROOT/firemex-model/.venv/bin/pip" install -r "$ROOT/firemex-model/requirements.txt"
fi

if [ ! -x "$ROOT/frontend/node_modules/.bin/vite" ]; then
    echo "Installing frontend dependencies..."
    npm --prefix "$ROOT/frontend" ci
fi

is_ready() {
    curl --fail --silent --show-error --max-time 2 "$1" >/dev/null 2>&1
}

wait_for() {
    local name="$1"
    local url="$2"
    local seconds="$3"
    local pid_file="$4"
    local log_file="$5"
    for _ in $(seq 1 "$seconds"); do
        if is_ready "$url"; then
            echo "$name is ready."
            return 0
        fi
        if [ -f "$pid_file" ] && ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            echo "$name stopped during startup. Last log lines:"
            tail -n 20 "$log_file" || true
            return 1
        fi
        sleep 1
    done
    echo "$name did not become ready. Last log lines:"
    tail -n 20 "$log_file" || true
    return 1
}

start_model() {
    local pid_file="$RUNTIME/model.pid"
    local log_file="$RUNTIME/model.log"
    if is_ready "http://127.0.0.1:8100/health"; then
        echo "AI model is already running."
        return
    fi
    echo "Starting AI model..."
    (
        cd "$ROOT/firemex-model"
        exec nohup env MPLCONFIGDIR="$RUNTIME/matplotlib" YOLO_CONFIG_DIR="$RUNTIME/yolo" .venv/bin/python detect_service.py
    ) >"$log_file" 2>&1 </dev/null &
    echo $! >"$pid_file"
    wait_for "AI model" "http://127.0.0.1:8100/health" 180 "$pid_file" "$log_file"
}

start_backend() {
    local pid_file="$RUNTIME/backend.pid"
    local log_file="$RUNTIME/backend.log"
    if is_ready "http://127.0.0.1:8080/ping"; then
        echo "FireMeX backend is already running."
        return
    fi
    echo "Building and starting FireMeX backend..."
    (cd "$ROOT/backend" && env GOCACHE="${GOCACHE:-$RUNTIME/go-cache}" go build -o "$RUNTIME/firemex-backend" .)
    (
        cd "$ROOT/backend"
        exec nohup "$RUNTIME/firemex-backend"
    ) >"$log_file" 2>&1 </dev/null &
    echo $! >"$pid_file"
    wait_for "FireMeX backend" "http://127.0.0.1:8080/ping" 60 "$pid_file" "$log_file"
}

start_frontend() {
    local pid_file="$RUNTIME/frontend.pid"
    local log_file="$RUNTIME/frontend.log"
    if is_ready "http://127.0.0.1:5173"; then
        echo "FireMeX frontend is already running."
        return
    fi
    echo "Starting FireMeX frontend..."
    (
        cd "$ROOT/frontend"
        exec nohup ./node_modules/.bin/vite --host 127.0.0.1
    ) >"$log_file" 2>&1 </dev/null &
    echo $! >"$pid_file"
    wait_for "FireMeX frontend" "http://127.0.0.1:5173" 60 "$pid_file" "$log_file"
}

start_model
start_backend
start_frontend

echo
echo "FireMeX is running: http://localhost:5173/FiremeX/login"
echo "Services continue running after this terminal closes."
echo "Logs: $RUNTIME"
echo "Stop the app with: ./stop.sh"
