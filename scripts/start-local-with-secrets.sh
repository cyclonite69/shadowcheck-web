#!/bin/bash
set -euo pipefail

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -z "${AWS_PROFILE:-}" ]; then
  echo "AWS credentials not set. Run 'aws sso login' or export AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY manually." >&2
  exit 1
fi

echo "Restarting API to reload secrets..."
docker compose restart api >/dev/null

echo "Reloading frontend nginx so it sees the new API address..."
docker compose exec frontend nginx -s reload >/dev/null

echo "Local stack ready with fresh secrets. Hit http://localhost:8080 to continue."
