#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUNTIME="$ROOT/.firemex-runtime"
cd "$ROOT"

stop_service() {
    local name="$1"
    local port="$2"
    local pid_file="$RUNTIME/$name.pid"
    local pids=""

    if [ -f "$pid_file" ]; then
        pids="$(cat "$pid_file")"
    fi
    if command -v lsof >/dev/null 2>&1; then
        local listeners
        listeners="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
        pids="$(printf '%s\n%s\n' "$pids" "$listeners" | awk 'NF && !seen[$0]++')"
    fi

    if [ -z "$pids" ]; then
        echo "$name is already stopped."
        rm -f "$pid_file"
        return
    fi

    while IFS= read -r pid; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    done <<<"$pids"

    for _ in $(seq 1 20); do
        local running=false
        while IFS= read -r pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                running=true
                break
            fi
        done <<<"$pids"
        if [ "$running" = false ]; then
            break
        fi
        sleep 0.25
    done

    rm -f "$pid_file"
    echo "Stopped $name."
}

stop_service "FireMeX frontend" 5173
stop_service "FireMeX backend" 8080
stop_service "AI model" 8100

echo "Stopping PostgreSQL and Home Assistant..."
docker compose stop

echo
echo "FireMeX is fully stopped."
echo "Start it again with: ./start.sh"
