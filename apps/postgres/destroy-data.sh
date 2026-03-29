#!/usr/bin/env bash
set -euo pipefail

VOLUME="crypto-terminal-postgres-data"

if ! podman volume inspect "$VOLUME" &>/dev/null; then
  echo "Volume '${VOLUME}' does not exist. Nothing to remove."
  exit 0
fi

echo "WARNING: This will permanently delete all Postgres data in volume '${VOLUME}'."
read -r -p "Are you sure? [N/y] " confirmation

if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

podman volume rm "$VOLUME"
echo "Volume '${VOLUME}' removed."
