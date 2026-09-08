#!/usr/bin/env bash
# FiremeX - organisation isolation checks
#
# Proves that an administrator of one organisation cannot see or change
# anything belonging to another organisation.
#
# Usage, from the repo root:   bash scripts/test-org-isolation.sh
# Needs: Go, and docker compose up -d (Postgres).

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
PORT=8099
WORK="$(mktemp -d)"
BIN="$WORK/firemex-test"
STAMP="$(date +%s)"
PW="testpass123"

A_EMAIL="orgA-$STAMP@firemex.local"
B_EMAIL="orgB-$STAMP@firemex.local"
B_OP_EMAIL="orgB-op-$STAMP@firemex.local"

PASS=0; FAIL=0
ok()  { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
bad() { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
head_() { printf "\n\033[1m%s\033[0m\n" "$1"; }

cleanup() {
  if [ -n "${SRV_PID:-}" ]; then
    kill "$SRV_PID" 2>/dev/null
    wait "$SRV_PID" 2>/dev/null      # without this bash prints "Terminated: 15"
    SRV_PID=""
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

api() { # api <method> <path> <token> -> prints HTTP status
  curl -s -o "$WORK/body" -w '%{http_code}' -X "$1" "http://localhost:$PORT$2" \
    -H "Authorization: Bearer $3"
}

register_org() { # register_org <email> <name> -> prints org code
  curl -s -X POST "http://localhost:$PORT/register/organization" \
    -H 'Content-Type: application/json' \
    -d "{\"org_name\":\"$2\",\"sector\":\"Testing\",\"email\":\"$1\",\"phone\":\"000\",\"admin_name\":\"$2 Admin\",\"password\":\"$PW\"}" \
    | sed -n 's/.*"org_code":"\([^"]*\)".*/\1/p'
}

login() { # login <email> -> prints token
  curl -s -X POST "http://localhost:$PORT/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$PW\"}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

head_ "Building and starting a test server on port $PORT"
(cd "$BACKEND" && go build -o "$BIN" .) || { echo "build failed"; exit 1; }
JWT_SECRET=isolation-test FIREMEX_DATA_DIR="$WORK" PORT="$PORT" "$BIN" > "$WORK/server.log" 2>&1 &
SRV_PID=$!
i=0; while [ $i -lt 30 ]; do curl -sf -m 1 "http://localhost:$PORT/ping" >/dev/null 2>&1 && break; sleep 0.5; i=$((i+1)); done
curl -sf -m 1 "http://localhost:$PORT/ping" >/dev/null 2>&1 || { echo "server did not start"; cat "$WORK/server.log"; exit 1; }
ok "server is up"

head_ "Creating two separate organisations"
A_CODE=$(register_org "$A_EMAIL" "Alpha")
B_CODE=$(register_org "$B_EMAIL" "Bravo")
[ -n "$A_CODE" ] && ok "organisation A created ($A_CODE)" || bad "could not create organisation A"
[ -n "$B_CODE" ] && ok "organisation B created ($B_CODE)" || bad "could not create organisation B"

curl -s -X POST "http://localhost:$PORT/register/operator" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Bravo Operator\",\"email\":\"$B_OP_EMAIL\",\"password\":\"$PW\",\"org_code\":\"$B_CODE\"}" >/dev/null
ok "operator registered into organisation B (pending)"

TOKEN_A=$(login "$A_EMAIL")
TOKEN_B=$(login "$B_EMAIL")
[ -n "$TOKEN_A" ] && [ -n "$TOKEN_B" ] && ok "both admins logged in" || { bad "login failed"; exit 1; }

head_ "USERS - can admin A see organisation B?"
api GET /api/users "$TOKEN_A" >/dev/null; USERS_A=$(cat "$WORK/body")
api GET /api/users "$TOKEN_B" >/dev/null; USERS_B=$(cat "$WORK/body")

case "$USERS_A" in
  *"$A_EMAIL"*) ok "admin A sees their own account" ;;
  *) bad "admin A cannot see their own account" ;;
esac
case "$USERS_A" in
  *"$B_EMAIL"*)    bad "LEAK: admin A can see organisation B's admin" ;;
  *"$B_OP_EMAIL"*) bad "LEAK: admin A can see organisation B's operator" ;;
  *) ok "admin A cannot see any of organisation B's users" ;;
esac
case "$USERS_B" in
  *"$B_OP_EMAIL"*) ok "admin B can see their own pending operator" ;;
  *) bad "admin B cannot see their own pending operator" ;;
esac

head_ "USERS - can admin A change organisation B's people?"
B_OP_ID=$(printf '%s' "$USERS_B" | sed -n 's/.*"pending":\[{"ID":\([0-9]\{1,\}\).*/\1/p')
B_ADMIN_ID=$(printf '%s' "$USERS_B" | sed -n 's/.*"active":\[{"ID":\([0-9]\{1,\}\).*/\1/p')

if [ -n "$B_OP_ID" ]; then
  CODE=$(api PATCH "/api/users/$B_OP_ID/approve" "$TOKEN_A")
  [ "$CODE" = "404" ] && ok "admin A cannot approve B's operator (404)" || bad "admin A approving B's operator returned $CODE, expected 404"

  CODE=$(api DELETE "/api/users/$B_OP_ID/deny" "$TOKEN_A")
  [ "$CODE" = "404" ] && ok "admin A cannot deny B's operator (404)" || bad "admin A denying B's operator returned $CODE, expected 404"

  CODE=$(api PATCH "/api/users/$B_OP_ID/approve" "$TOKEN_B")
  [ "$CODE" = "200" ] && ok "admin B CAN approve their own operator (200)" || bad "admin B approving own operator returned $CODE, expected 200"
else
  bad "could not read B's pending operator id from the response"
fi

if [ -n "$B_ADMIN_ID" ]; then
  CODE=$(api PATCH "/api/users/$B_ADMIN_ID/revoke" "$TOKEN_A")
  [ "$CODE" = "404" ] && ok "admin A cannot revoke B's admin (404)" || bad "admin A revoking B's admin returned $CODE, expected 404"
fi

head_ "CAMERAS - is one organisation's camera visible to another?"
ENTITY="camera.isolation_test_$STAMP"
CAM=$(curl -s -X POST "http://localhost:$PORT/api/cameras" \
  -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: application/json' \
  -d "{\"entity_id\":\"$ENTITY\",\"display_name\":\"Alpha Cam\",\"zone\":\"Zone A\",\"ai_enabled\":true}")
CAM_ID=$(printf '%s' "$CAM" | sed -n 's/.*"camera":{"ID":\([0-9]\{1,\}\).*/\1/p')
[ -n "$CAM_ID" ] && ok "admin A added a camera (id $CAM_ID)" || bad "admin A could not add a camera: $CAM"

api GET /api/cameras "$TOKEN_A" >/dev/null; CAMS_A=$(cat "$WORK/body")
api GET /api/cameras "$TOKEN_B" >/dev/null; CAMS_B=$(cat "$WORK/body")

case "$CAMS_A" in *"$ENTITY"*) ok "admin A sees their own camera" ;; *) bad "admin A cannot see their own camera" ;; esac
case "$CAMS_B" in *"$ENTITY"*) bad "LEAK: admin B can see organisation A's camera" ;; *) ok "admin B cannot see organisation A's camera" ;; esac

if [ -n "$CAM_ID" ]; then
  CODE=$(api DELETE "/api/cameras/$CAM_ID" "$TOKEN_B")
  [ "$CODE" = "404" ] && ok "admin B cannot delete A's camera (404)" || bad "admin B deleting A's camera returned $CODE, expected 404"
fi

CODE=$(api GET "/api/cameras/stream/$ENTITY" "$TOKEN_B")
[ "$CODE" = "404" ] && ok "admin B cannot stream A's camera (404)" || bad "admin B streaming A's camera returned $CODE, expected 404"

head_ "RESULT"
printf "  passed: %s   failed: %s\n" "$PASS" "$FAIL"
printf "\n  Test data was created in your dev database. Remove it by running:\n\n"
printf "docker compose exec -T db psql -U admin -d firemex <<'SQL'\n"
printf "DELETE FROM cameras WHERE entity_id = '%s';\n" "$ENTITY"
printf "DELETE FROM users WHERE email IN ('%s',\n" "$A_EMAIL"
printf "  '%s',\n" "$B_EMAIL"
printf "  '%s');\n" "$B_OP_EMAIL"
printf "DELETE FROM organizations WHERE code IN ('%s','%s');\n" "$A_CODE" "$B_CODE"
printf "SQL\n\n"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
