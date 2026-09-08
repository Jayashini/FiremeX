#!/usr/bin/env bash
# FiremeX - config cleanup verification
#
# Runs every check for the "settings out of source code" work.
# Usage, from the repo root:   bash scripts/test-config.sh
#
# Needs: Go, Node, and the docker-compose services running (docker compose up -d).
# It starts its own copy of the backend on a spare port and stops it again;
# your normal dev server is never touched.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

PORT=8099                       # spare port, so a running dev server is untouched
WORK="$(mktemp -d)"             # throwaway data dir for generated secrets
BIN="$WORK/firemex-test"
STAMP="$(date +%s)"
EMAIL="cfgtest-$STAMP@firemex.local"
PASSWORD="testpass123"

PASS=0; FAIL=0; SKIP=0
ok()   { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
bad()  { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
skip() { printf "  \033[33mSKIP\033[0m  %s\n" "$1"; SKIP=$((SKIP+1)); }
head_() { printf "\n\033[1m%s\033[0m\n" "$1"; }

cleanup() {
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

# start_server <data-dir> [JWT_SECRET]
# Launches the test binary and waits for /ping to answer.
start_server() {
  local datadir="$1" secret="${2:-}"
  JWT_SECRET="$secret" FIREMEX_DATA_DIR="$datadir" PORT="$PORT" \
    "$BIN" > "$WORK/server.log" 2>&1 &
  SRV_PID=$!
  local i=0
  while [ $i -lt 30 ]; do
    if curl -sf -m 1 "http://localhost:$PORT/ping" > /dev/null 2>&1; then return 0; fi
    sleep 0.5; i=$((i+1))
  done
  return 1
}

stop_server() {
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  wait "$SRV_PID" 2>/dev/null
  SRV_PID=""
}

# ---------------------------------------------------------------- TEST 0
head_ "TEST 0  Backend compiles"
if (cd "$BACKEND" && go build ./... 2>"$WORK/build.log"); then
  ok "go build ./..."
else
  bad "go build ./... - see below"; cat "$WORK/build.log"
  echo; echo "Compilation failed, stopping here."; exit 1
fi

# ---------------------------------------------------------------- TEST 5
head_ "TEST 5  No hardcoded values left in the source"
grep -rn "localhost" "$BACKEND" --include=*.go | grep -v "config/config.go" > "$WORK/g1"
[ -s "$WORK/g1" ] && { bad "no 'localhost' in backend .go outside config.go"; sed 's/^/        /' "$WORK/g1"; } || ok "no 'localhost' in backend .go outside config.go"

grep -rn "localhost:8080" "$FRONTEND/src" > "$WORK/g2" 2>/dev/null
[ -s "$WORK/g2" ] && { bad "no 'localhost:8080' in frontend/src"; sed 's/^/        /' "$WORK/g2"; } || ok "no 'localhost:8080' in frontend/src"

grep -rn "super_secret" "$BACKEND" --include=*.go > "$WORK/g3" 2>/dev/null
[ -s "$WORK/g3" ] && { bad "no hardcoded secret left"; sed 's/^/        /' "$WORK/g3"; } || ok "no hardcoded secret left"

grep -rn "os.Getenv" "$BACKEND" --include=*.go | grep -v "config/config.go" > "$WORK/g4"
[ -s "$WORK/g4" ] && { bad "os.Getenv only inside config.go"; sed 's/^/        /' "$WORK/g4"; } || ok "os.Getenv only inside config.go"

# ---------------------------------------------------------------- TEST 6
head_ "TEST 6  Frontend typechecks"
if (cd "$FRONTEND" && npx tsc -b --force > "$WORK/tsc.log" 2>&1); then
  ok "tsc -b"
else
  bad "tsc -b"; sed 's/^/        /' "$WORK/tsc.log"
fi

# ------------------------------------------------ runtime tests need the DB
head_ "Checking prerequisites for the runtime tests"
if nc -z localhost 5432 2>/dev/null; then
  ok "Postgres is reachable on port 5432"
  DB_UP=1
else
  skip "Postgres is not running - start it with: docker compose up -d"
  DB_UP=0
fi

if [ "$DB_UP" = "0" ]; then
  head_ "RESULT"
  printf "  passed: %s   failed: %s   skipped: %s\n\n" "$PASS" "$FAIL" "$SKIP"
  [ "$FAIL" -eq 0 ] && echo "Static checks passed. Run 'docker compose up -d' and try again for the runtime tests."
  exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
fi

(cd "$BACKEND" && go build -o "$BIN" .) || { bad "could not build test binary"; exit 1; }

# ---------------------------------------------------------------- TEST 1+2
head_ "TEST 1 & 2  Server starts, and PORT really comes from config"
mkdir -p "$WORK/data1"
if start_server "$WORK/data1" "test-secret-aaa"; then
  ok "server answered /ping on port $PORT (PORT setting is being read)"
  if grep -q "port $PORT" "$WORK/server.log"; then
    ok "startup log reports port $PORT"
  else
    bad "startup log does not mention port $PORT"; sed 's/^/        /' "$WORK/server.log"
  fi
else
  bad "server did not start on port $PORT"; sed 's/^/        /' "$WORK/server.log"; exit 1
fi

# ---------------------------------------------------------------- TEST 3
head_ "TEST 3  Changing JWT_SECRET invalidates existing tokens"
REG=$(curl -s -X POST "http://localhost:$PORT/register/organization" \
  -H 'Content-Type: application/json' \
  -d "{\"org_name\":\"Config Test Org $STAMP\",\"sector\":\"Testing\",\"email\":\"$EMAIL\",\"phone\":\"000\",\"admin_name\":\"Config Tester\",\"password\":\"$PASSWORD\"}")
ORG_CODE=$(printf '%s' "$REG" | sed -n 's/.*"org_code":"\([^"]*\)".*/\1/p')
if [ -n "$ORG_CODE" ]; then
  ok "created test organisation $ORG_CODE"
else
  bad "could not create a test organisation"; echo "        $REG"
fi

TOKEN=$(curl -s -X POST "http://localhost:$PORT/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then ok "logged in and received a token"; else bad "login did not return a token"; fi

CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/users" -H "Authorization: Bearer $TOKEN")
[ "$CODE" = "200" ] && ok "token works against /api/users (HTTP 200)" || bad "token rejected by /api/users (HTTP $CODE)"

stop_server
start_server "$WORK/data1" "test-secret-bbb" || bad "server did not restart"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/users" -H "Authorization: Bearer $TOKEN")
if [ "$CODE" = "401" ]; then
  ok "after changing the secret the old token is rejected (HTTP 401)"
else
  bad "old token should have been rejected, got HTTP $CODE - the secret is not being read from config"
fi
stop_server

# ---------------------------------------------------------------- TEST 4
head_ "TEST 4  With no JWT_SECRET, FiremeX generates and reuses its own"
mkdir -p "$WORK/data2"
start_server "$WORK/data2" "" || bad "server did not start without JWT_SECRET"

if [ -f "$WORK/data2/.firemex_secret" ]; then
  ok "generated .firemex_secret automatically"
else
  bad "no .firemex_secret was created"
fi
grep -q "generated a new signing secret" "$WORK/server.log" \
  && ok "logged that it generated a secret" \
  || bad "did not log the generated secret"

TOKEN2=$(curl -s -X POST "http://localhost:$PORT/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN2" ] && ok "logged in using the generated secret" || bad "login failed with the generated secret"

stop_server
start_server "$WORK/data2" "" || bad "server did not restart"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/users" -H "Authorization: Bearer $TOKEN2")
if [ "$CODE" = "200" ]; then
  ok "secret is reused across restarts, operators stay logged in (HTTP 200)"
else
  bad "token stopped working after restart (HTTP $CODE) - the secret is not being reused"
fi

stop_server
rm -f "$WORK/data2/.firemex_secret"
start_server "$WORK/data2" "" || bad "server did not restart"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/users" -H "Authorization: Bearer $TOKEN2")
if [ "$CODE" = "401" ]; then
  ok "deleting the secret file invalidates old tokens (HTTP 401)"
else
  bad "expected 401 after deleting the secret file, got HTTP $CODE"
fi
stop_server

# ---------------------------------------------------------------- RESULT
head_ "RESULT"
printf "  passed: %s   failed: %s   skipped: %s\n" "$PASS" "$FAIL" "$SKIP"
printf "\n  Note: a test organisation (%s, %s) was created in your dev database.\n" "$ORG_CODE" "$EMAIL"
printf "  Remove it with:\n"
printf "    docker compose exec -T db psql -U admin -d firemex -c \"DELETE FROM users WHERE email='%s'; DELETE FROM organizations WHERE code='%s';\"\n\n" "$EMAIL" "$ORG_CODE"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
