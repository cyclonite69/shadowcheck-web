#!/bin/bash

# List of files that need export statements
files=(
  "server/src/api/routes/v1/admin/notes.ts"
  "server/src/api/routes/v1/admin/oui.ts"
  "server/src/api/routes/v1/admin/settings.ts"
  "server/src/api/routes/v1/admin/tags.ts"
  "server/src/api/routes/v1/analytics-public.ts"
  "server/src/api/routes/v1/analytics.ts"
  "server/src/api/routes/v1/auth.ts"
  "server/src/api/routes/v1/backup.ts"
  "server/src/api/routes/v1/dashboard.ts"
  "server/src/api/routes/v1/explorer.ts"
  "server/src/api/routes/v1/export.ts"
  "server/src/api/routes/v1/geospatial.ts"
  "server/src/api/routes/v1/health.ts"
  "server/src/api/routes/v1/home-location.ts"
  "server/src/api/routes/v1/kepler.ts"
  "server/src/api/routes/v1/location-markers.ts"
  "server/src/api/routes/v1/misc.ts"
  "server/src/api/routes/v1/ml.ts"
  "server/src/api/routes/v1/network-tags.ts"
  "server/src/api/routes/v1/networks.ts"
  "server/src/api/routes/v1/settings.ts"
  "server/src/api/routes/v1/threats.ts"
  "server/src/api/routes/v1/wigle.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ] && ! grep -q "export" "$file"; then
    # Find the first line that starts with 'const' or 'import' and insert export before it
    sed -i '/^const\|^import/i export {};' "$file"
    # Remove duplicate export statements
    awk '!seen[$0]++' "$file" > temp && mv temp "$file"
  fi
done
