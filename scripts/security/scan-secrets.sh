#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:---staged}"
if [[ "$MODE" != "--staged" && "$MODE" != "--repo" ]]; then
  echo "Usage: $0 [--staged|--repo]" >&2
  exit 2
fi

run_gitleaks() {
  local scanner=("$@")
  if [[ "$MODE" == "--repo" ]]; then
    "${scanner[@]}" detect --source . --config .gitleaks.toml --no-banner --redact
  else
    "${scanner[@]}" protect --staged --config .gitleaks.toml --no-banner --redact
  fi
}

if command -v gitleaks >/dev/null 2>&1; then
  echo "[secret-scan] Running gitleaks (${MODE#--})"
  run_gitleaks gitleaks
  exit 0
fi

if command -v docker >/dev/null 2>&1 && docker images --format '{{.Repository}}:{{.Tag}}' | grep -qx 'docker.io/zricethezav/gitleaks:latest'; then
  echo "[secret-scan] Running gitleaks via Docker (${MODE#--})"
  run_gitleaks docker run --rm -v "$ROOT_DIR:/repo" -w /repo docker.io/zricethezav/gitleaks:latest
  exit 0
fi

echo "[secret-scan] gitleaks not found locally; running fallback pattern scan (${MODE#--})"

TMP_SCAN="$(mktemp)"
cleanup() {
  rm -f "$TMP_SCAN"
}
trap cleanup EXIT

if [[ "$MODE" == "--repo" ]]; then
  while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue
    case "$file" in
      *.js|*.jsx|*.ts|*.tsx|*.sh|*.yml|*.yaml|*.json|*.env|*.sql) ;;
      *) continue ;;
    esac
    awk 'FNR==1 {print "FILE " FILENAME} {print}' "$file"
  done < <(git ls-files -z) > "$TMP_SCAN"
else
  git diff --cached --no-color --unified=0 | grep '^+' | grep -v '^+++ ' > "$TMP_SCAN" || true
fi

if [[ ! -s "$TMP_SCAN" ]]; then
  exit 0
fi

PATTERN_1="(password|db_password|db_admin_password)[[:space:]]*[:=][[:space:]]*['\"]{1}[^$<'\"][^'\"]{7,}['\"]{1}"
PATTERN_2="postgres(ql)?://[^[:space:]'\"]+:[^$<@[:space:]'\"][^@[:space:]'\"]{7,}@"
ALLOWLIST="(test(_|-)?password|example|placeholder|changeme|dummy|sample|your(_|-)?password|your(_|-)?db(_|-)?password|your(_|-)?secure(_|-)?password|password|new(_|-)?password|admin|dev(_|-)?password|dev(_|-)?admin(_|-)?password|aws(_|-)?password|env(_|-)?password|local(_|-)?dev(_|-)?nopass|\$\{|\$[A-Za-z_][A-Za-z0-9_]*|<[^>]+>)"

MATCHES="$(grep -niE "$PATTERN_1|$PATTERN_2" "$TMP_SCAN" | grep -viE "$ALLOWLIST" || true)"

if [[ -n "$MATCHES" ]]; then
  echo "Potential hard-coded secret detected:"
  echo "$MATCHES"
  exit 1
fi
