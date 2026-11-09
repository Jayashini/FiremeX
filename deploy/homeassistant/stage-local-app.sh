#!/usr/bin/env bash
set -euo pipefail

app_source=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$app_source" rev-parse --show-toplevel)
bundle=$(mktemp -d "${TMPDIR:-/tmp}/firemex-haos.XXXXXXXX")
app="$bundle/firemex"

mkdir -p "$app/deploy/homeassistant"
git -C "$repo" archive HEAD backend frontend firemex-model | tar -xf - -C "$app"
cp "$app_source/Dockerfile" "$app_source/Dockerfile.dockerignore" \
    "$app_source/config.yaml" "$app_source/DOCS.md" "$app/"
cp -R "$app_source/translations" "$app/"
cp -R "$app_source/rootfs" "$app/deploy/homeassistant/"
printf '%s\n' "$app"
