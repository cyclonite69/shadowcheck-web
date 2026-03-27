#!/bin/bash

THRESHOLDS_FILE="scripts/doc-line-count-thresholds.json"
FAILED=0
declare -A CHECKED_FILES

echo "=== Documentation Line Count Drift Check ==="
echo "------------------------------------------------------------"
printf "%-50s | %-10s | %-10s\n" "File" "Current" "Threshold"
echo "------------------------------------------------------------"

check_file() {
  local file="$1"
  local threshold="$2"

  if [[ -n "${CHECKED_FILES[$file]}" ]]; then
    return
  fi
  CHECKED_FILES["$file"]=1

  if [ ! -f "$file" ]; then
    echo "ERROR: File $file not found!"
    FAILED=1
    return
  fi

  current=$(wc -l < "$file" | tr -d ' ')

  if [ "$current" -gt "$threshold" ]; then
    printf "%-50s | \e[31m%-10s\e[0m | %-10s (FAIL)\n" "$file" "$current" "$threshold"
    FAILED=1
  else
    printf "%-50s | \e[32m%-10s\e[0m | %-10s (OK)\n" "$file" "$current" "$threshold"
  fi
}

while IFS=$'\t' read -r file threshold; do
  [ -n "$file" ] || continue
  check_file "$file" "$threshold"
done < <(jq -r '.files | to_entries[] | "\(.key)\t\(.value)"' "$THRESHOLDS_FILE")

while IFS=$'\t' read -r pattern threshold; do
  [ -n "$pattern" ] || continue
  matches_found=0
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    matches_found=1
    check_file "$file" "$threshold"
  done < <(find . -path "./${pattern}" -type f | sed 's#^\./##' | sort)

  if [ "$matches_found" -eq 0 ]; then
    echo "ERROR: Pattern $pattern matched no files!"
    FAILED=1
  fi
done < <(jq -r '.globs[]? | "\(.pattern)\t\(.threshold)"' "$THRESHOLDS_FILE")

echo "------------------------------------------------------------"

if [ $FAILED -ne 0 ]; then
  echo "FAILURE: One or more files exceed their modularity line-count threshold."
  echo "Please refactor monolithic files into smaller hooks or sub-components."
  exit 1
else
  echo "SUCCESS: All files within modularity bounds."
  exit 0
fi
