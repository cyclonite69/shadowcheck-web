#!/usr/bin/env bash
# Networks-only ETL Pipeline
# Loads network CSV files and promotes them to app.networks table

set -uo pipefail  # Removed -e to continue on errors

# Configuration
export PGPASSWORD='changeme'
PSQL="psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==================================================================="
echo "ShadowCheck Networks ETL Pipeline"
echo "==================================================================="
echo ""

# Step 1: Ensure schema is ready
echo "Step 1: Verifying database schema..."
$PSQL -f "$BASE_DIR/etl/01_schema/03_create_staging_tables.sql" > /dev/null
echo "✓ Staging tables ready"
echo ""

# Step 2: Load networks from available CSV files
echo "Step 2: Loading networks from CSV files..."
echo ""

# Define device-to-CSV mapping (device_id must match what's in the CSV)
declare -A DEVICE_FILES=(
  ["g63"]="g63_networks.csv"
  ["j24"]="j24_networks.csv"
  ["s22"]="s22_networks.csv"
  ["backup"]="backup_networks.csv"
)

LOADED_COUNT=0
cd "$BASE_DIR"  # Change to base directory so relative paths work in \copy

for device in "${!DEVICE_FILES[@]}"; do
  csv_file="${DEVICE_FILES[$device]}"

  if [[ -f "$csv_file" ]]; then
    echo "  Loading $device from $csv_file..."
    if $PSQL << EOF
-- Clean staging for this device
DELETE FROM staging_networks WHERE device_id = '$device';

-- Import networks CSV with header
\copy staging_networks (device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon, type, bestlevel, bestlat, bestlon, rcois, mfgrid, service) FROM '$csv_file' CSV HEADER

-- Report import statistics
SELECT
  '$device' AS device_loaded,
  COUNT(*) AS networks_imported,
  COUNT(DISTINCT type) AS network_types,
  COUNT(*) FILTER (WHERE ssid IS NULL) AS without_ssid
FROM staging_networks
WHERE device_id = '$device';
EOF
    then
      echo ""
      ((LOADED_COUNT++))
    else
      echo "  ✗ Error loading $device"
      echo ""
    fi
  else
    echo "  ⊘ Skipping $device (CSV not found: $csv_file)"
  fi
done

if [[ $LOADED_COUNT -eq 0 ]]; then
  echo "ERROR: No network CSV files found!"
  echo "Expected files: ${DEVICE_FILES[@]}"
  exit 1
fi

echo "✓ Loaded networks from $LOADED_COUNT device(s)"
echo ""

# Step 3: Verify staging data
echo "Step 3: Verifying staging data..."
$PSQL -c "
SELECT
  device_id,
  COUNT(*) AS networks,
  COUNT(DISTINCT type) AS types,
  COUNT(*) FILTER (WHERE ssid IS NULL) AS no_ssid
FROM staging_networks
GROUP BY device_id
ORDER BY device_id;
"
echo ""

# Step 4: Promote to final networks table
echo "Step 4: Promoting networks to app.networks..."
$PSQL -f "$BASE_DIR/etl/04_promote/04_insert_networks.sql"
echo ""

# Step 5: Report final statistics
echo "Step 5: Final statistics..."
$PSQL -c "
SELECT
  COUNT(*) AS total_networks,
  COUNT(DISTINCT type) AS network_types,
  COUNT(*) FILTER (WHERE type = 'W') AS wifi,
  COUNT(*) FILTER (WHERE type = 'E') AS ble,
  COUNT(*) FILTER (WHERE type = 'B') AS bluetooth,
  COUNT(*) FILTER (WHERE ssid IS NULL) AS without_ssid
FROM public.networks;
"
echo ""

echo "==================================================================="
echo "✓ Networks ETL Complete!"
echo "==================================================================="
