#!/bin/bash
# Step 1: Load g63 only, verify it works

set -e
cd ~/ShadowCheckStatic

# Set PostgreSQL password
export PGPASSWORD='changeme'

echo "=== STEP 1: Verify device exists ==="
psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db << EOF
SELECT code FROM device_sources WHERE code = 'g63';
EOF

echo ""
echo "=== STEP 2: Clean staging ==="
psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db << EOF
TRUNCATE staging_networks;
EOF

echo ""
echo "=== STEP 3: Check CSV format ==="
echo "Header:"
head -1 g63_networks.csv

echo ""
echo "First data row (first 100 chars):"
head -2 g63_networks.csv | tail -1 | cut -c1-100

echo ""
echo "=== STEP 4: Import g63 ==="
psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db << EOF
\copy staging_networks (device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon, type, bestlevel, bestlat, bestlon, rcois, mfgrid, service) FROM 'g63_networks.csv' CSV HEADER
EOF

echo ""
echo "=== STEP 5: Verify import ==="
psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db << EOF
SELECT COUNT(*) as row_count FROM staging_networks;
SELECT device_id, COUNT(*) as count FROM staging_networks GROUP BY device_id;
SELECT bssid, ssid FROM staging_networks LIMIT 3;
EOF

echo ""
echo "✓ Done. If row_count > 0, we're ready to proceed."
