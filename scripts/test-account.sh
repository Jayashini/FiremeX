#!/usr/bin/env bash
# FiremeX - account, profile and organisation endpoint checks
#
# Covers the endpoints the Profile and Settings pages are built on.
# Usage, from the repo root:   bash scripts/test-account.sh
# Needs: Go, and docker compose up -d (Postgres).

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
PORT=8099
WORK="$(mktemp -d)"
BIN="$WORK/firemex-test"
STAMP="$(date +%s)"
PW="testpass123"
NEWPW="newpass456"

ADMIN="acct-admin-$STAMP@firemex.local"
OPER="acct-oper-$STAMP@firemex.local"

PASS=0; FAIL=0
ok()  { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
bad() { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
head_() { printf "\n\033[1m%s\033[0m\n" "$1"; }

cleanup() {
  if [ -n "${SRV_PID:-}" ]; then
    kill "$SRV_PID" 2>/dev/null; wait "$SRV_PID" 2>/dev/null; SRV_PID=""
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

req() { # req <method> <path> <token> [json] -> status code, body in $WORK/body
  if [ $# -ge 4 ]; then
    curl -s -o "$WORK/body" -w '%{http_code}' -X "$1" "http://localhost:$PORT$2" \
      -H "Authorization: Bearer $3" -H 'Content-Type: application/json' -d "$4"
  else
    curl -s -o "$WORK/body" -w '%{http_code}' -X "$1" "http://localhost:$PORT$2" \
      -H "Authorization: Bearer $3"
  fi
}
body() { cat "$WORK/body"; }

login() { curl -s -X POST "http://localhost:$PORT/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}"; }

head_ "Starting a test server on port $PORT"
(cd "$BACKEND" && go build -o "$BIN" .) || { echo "build failed"; exit 1; }
JWT_SECRET=account-test FIREMEX_DATA_DIR="$WORK" PORT="$PORT" "$BIN" > "$WORK/server.log" 2>&1 &
SRV_PID=$!
i=0; while [ $i -lt 30 ]; do curl -sf -m 1 "http://localhost:$PORT/ping" >/dev/null 2>&1 && break; sleep 0.5; i=$((i+1)); done
curl -sf -m 1 "http://localhost:$PORT/ping" >/dev/null 2>&1 || { echo "server did not start"; cat "$WORK/server.log"; exit 1; }
ok "server is up"

head_ "Setting up an organisation with one admin and one operator"
ORG_CODE=$(curl -s -X POST "http://localhost:$PORT/register/organization" -H 'Content-Type: application/json' \
  -d "{\"org_name\":\"Account Test Co\",\"sector\":\"Testing\",\"email\":\"$ADMIN\",\"phone\":\"0110000000\",\"admin_name\":\"Test Admin\",\"password\":\"$PW\"}" \
  | sed -n 's/.*"org_code":"\([^"]*\)".*/\1/p')
[ -n "$ORG_CODE" ] && ok "organisation created ($ORG_CODE)" || { bad "could not create organisation"; exit 1; }

curl -s -X POST "http://localhost:$PORT/register/operator" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test Operator\",\"email\":\"$OPER\",\"password\":\"$PW\",\"org_code\":\"$ORG_CODE\"}" >/dev/null

LOGIN_A=$(login "$ADMIN" "$PW")
TOKEN_A=$(printf '%s' "$LOGIN_A" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

req GET /api/users "$TOKEN_A" >/dev/null
OP_ID=$(body | sed -n 's/.*"pending":\[{"ID":\([0-9]\{1,\}\).*/\1/p')
CODE=$(req PATCH "/api/users/$OP_ID/approve" "$TOKEN_A")
[ "$CODE" = "200" ] && ok "operator approved" || bad "could not approve the operator ($CODE)"

LOGIN_O=$(login "$OPER" "$PW")
TOKEN_O=$(printf '%s' "$LOGIN_O" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN_O" ] && ok "operator logged in" || { bad "operator could not log in"; exit 1; }

head_ "LOGIN - does the response say who you are?"
case "$LOGIN_A" in *'"role":"admin"'*) ok "admin login returns role=admin" ;; *) bad "admin login did not return a role" ;; esac
case "$LOGIN_O" in *'"role":"operator"'*) ok "operator login returns role=operator" ;; *) bad "operator login did not return a role" ;; esac
case "$LOGIN_A" in *'"organization"'*) ok "login includes the organisation" ;; *) bad "login has no organisation" ;; esac

head_ "GET /api/me"
CODE=$(req GET /api/me "$TOKEN_A"); ME_A=$(body)
[ "$CODE" = "200" ] && ok "admin can read /api/me" || bad "admin /api/me returned $CODE"
CODE=$(req GET /api/me "$TOKEN_O"); ME_O=$(body)
[ "$CODE" = "200" ] && ok "operator can read /api/me" || bad "operator /api/me returned $CODE"
case "$ME_A" in *'"member_since"'*) ok "/api/me includes member_since" ;; *) bad "no member_since field" ;; esac

head_ "JOIN CODE - is it admin-only?"
case "$ME_A" in *"\"code\":\"$ORG_CODE\""*) ok "admin sees the join code" ;; *) bad "admin cannot see the join code" ;; esac
case "$ME_O" in *'"code"'*) bad "LEAK: operator can see the join code" ;; *) ok "operator cannot see the join code" ;; esac

CODE=$(req GET /api/organization "$TOKEN_O"); ORG_O=$(body)
[ "$CODE" = "200" ] && ok "operator can read organisation details" || bad "operator /api/organization returned $CODE"
case "$ORG_O" in *'"code"'*) bad "LEAK: join code exposed on /api/organization to operator" ;; *) ok "join code withheld on /api/organization for operator" ;; esac

head_ "PROFILE - changing your own name"
CODE=$(req PATCH /api/me "$TOKEN_O" '{"name":"Renamed Operator"}')
[ "$CODE" = "200" ] && ok "operator renamed themselves (200)" || bad "rename returned $CODE"
req GET /api/me "$TOKEN_O" >/dev/null
case "$(body)" in *'Renamed Operator'*) ok "the new name persisted" ;; *) bad "the new name did not persist" ;; esac

head_ "PROFILE - can an operator promote themselves?"
req PATCH /api/me "$TOKEN_O" '{"name":"Sneaky","role":"admin","status":"active"}' >/dev/null
req GET /api/me "$TOKEN_O" >/dev/null
case "$(body)" in
  *'"role":"admin"'*) bad "ESCALATION: operator became an admin via PATCH /api/me" ;;
  *'"role":"operator"'*) ok "role ignored on PATCH /api/me - still an operator" ;;
  *) bad "could not read the role back" ;;
esac
CODE=$(req GET /api/users "$TOKEN_O")
[ "$CODE" = "403" ] && ok "operator still blocked from admin routes (403)" || bad "operator got $CODE on /api/users, expected 403"

head_ "PASSWORD"
CODE=$(req POST /api/me/password "$TOKEN_O" "{\"current_password\":\"wrongpass\",\"new_password\":\"$NEWPW\"}")
[ "$CODE" = "401" ] && ok "wrong current password rejected (401)" || bad "wrong password returned $CODE, expected 401"

CODE=$(req POST /api/me/password "$TOKEN_O" "{\"current_password\":\"$PW\",\"new_password\":\"123\"}")
[ "$CODE" = "400" ] && ok "short new password rejected (400)" || bad "short password returned $CODE, expected 400"

CODE=$(req POST /api/me/password "$TOKEN_O" "{\"current_password\":\"$PW\",\"new_password\":\"$PW\"}")
[ "$CODE" = "400" ] && ok "reusing the same password rejected (400)" || bad "same password returned $CODE, expected 400"

CODE=$(req POST /api/me/password "$TOKEN_O" "{\"current_password\":\"$PW\",\"new_password\":\"$NEWPW\"}")
[ "$CODE" = "200" ] && ok "password changed (200)" || bad "password change returned $CODE"

case "$(login "$OPER" "$NEWPW")" in *'"token"'*) ok "can log in with the new password" ;; *) bad "new password does not work" ;; esac
case "$(login "$OPER" "$PW")" in *'"token"'*) bad "the OLD password still works" ;; *) ok "the old password no longer works" ;; esac

head_ "ORGANISATION - who may edit it?"
CODE=$(req PATCH /api/organization "$TOKEN_O" '{"name":"Hijacked","sector":"x","email":"a@b.com","phone":"1"}')
[ "$CODE" = "403" ] && ok "operator cannot edit the organisation (403)" || bad "operator editing org returned $CODE, expected 403"

CODE=$(req PATCH /api/organization "$TOKEN_A" '{"name":"Renamed Co","sector":"Warehousing","email":"ops@renamed.lk","phone":"0119999999"}')
[ "$CODE" = "200" ] && ok "admin can edit their organisation (200)" || bad "admin editing org returned $CODE"
req GET /api/organization "$TOKEN_A" >/dev/null
case "$(body)" in *'Renamed Co'*) ok "organisation change persisted" ;; *) bad "organisation change did not persist" ;; esac
case "$(body)" in *"\"code\":\"$ORG_CODE\""*) ok "join code unchanged by the edit" ;; *) bad "the join code changed - operators could no longer join" ;; esac

head_ "SYSTEM STATUS"
CODE=$(req GET /api/system/status "$TOKEN_A"); ST=$(body)
[ "$CODE" = "200" ] && ok "admin can read system status" || bad "system status returned $CODE"
case "$ST" in *'"database"'*'"ok":true'*) ok "database reported as connected" ;; *) bad "database not reported connected: $ST" ;; esac
case "$ST" in *'"home_assistant"'*) ok "home assistant status reported" ;; *) bad "no home assistant status" ;; esac
CODE=$(req GET /api/system/status "$TOKEN_O")
[ "$CODE" = "403" ] && ok "operator cannot read system status (403)" || bad "operator got $CODE, expected 403"

head_ "RESULT"
printf "  passed: %s   failed: %s\n" "$PASS" "$FAIL"
printf "\n  Test data was created in your dev database. Remove it by running:\n\n"
printf "docker compose exec -T db psql -U admin -d firemex <<'SQL'\n"
printf "DELETE FROM users WHERE email IN ('%s',\n" "$ADMIN"
printf "  '%s');\n" "$OPER"
printf "DELETE FROM organizations WHERE code = '%s';\n" "$ORG_CODE"
printf "SQL\n\n"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
