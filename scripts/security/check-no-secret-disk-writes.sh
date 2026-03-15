#!/usr/bin/env bash
set -euo pipefail

# Enforce immutable policy:
# Secrets must not be materialized to disk in this repository's runtime scripts.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TMP_OUT="/tmp/shadowcheck-secret-policy-violations.txt"
: > "$TMP_OUT"

# Scan tracked source/config files (exclude docs and markdown prose).
while IFS= read -r file; do
  case "$file" in
    docs/* | *.md | *.txt | .gitignore | .dockerignore | scripts/security/check-no-secret-disk-writes.sh) continue ;;
  esac

  if [ ! -f "$file" ]; then
    continue
  fi

  # Block known secret-on-disk modalities:
  # - Writing .env files
  # - Copying .env.example to .env
  # - Any .pgpass materialization or usage
  # - pgAdmin PassFile auth
  # - password files under secrets/
  if grep -nHE \
    '(cat[[:space:]]*>+[[:space:]]*\.env([[:space:]]|$)|>[[:space:]]*\.env([[:space:]]|$)|>>[[:space:]]*\.env([[:space:]]|$)|cp[[:space:]]+\.env\.example[[:space:]]+\.env([[:space:]]|$)|\.pgpass\b|PassFile[[:space:]]*[:=]|secrets/[^[:space:]]*password[^[:space:]]*\.txt)' \
    "$file" >> "$TMP_OUT"; then
    :
  fi
done < <(git ls-files)

if [ -s "$TMP_OUT" ]; then
  echo "Secret policy violation: detected secret-to-disk pattern(s):"
  cat "$TMP_OUT"
  echo
  echo "Policy: secrets must remain in AWS Secrets Manager and process memory only."
  exit 1
fi

echo "Secret policy check passed."
