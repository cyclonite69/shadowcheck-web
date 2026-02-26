#!/bin/bash
# Apply quality filters to observations table
# Run this after data imports to mark bad observations before MV refresh

set -e

echo "=== Applying Quality Filters ==="

SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query SecretString --output text)
PGPASS=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))")

docker exec shadowcheck_postgres bash -c "PGPASSWORD='$PGPASS' psql -U shadowcheck_user -d shadowcheck_db" <<'SQL'
-- Mark temporal clusters (batch imports)
UPDATE observations o
SET 
  is_temporal_cluster = true,
  is_quality_filtered = true,
  quality_filter_applied_at = NOW()
WHERE (time, lat, lon) IN (
  SELECT time, lat, lon 
  FROM observations 
  GROUP BY time, lat, lon 
  HAVING COUNT(*) > 50
);

-- Mark duplicate coordinates
UPDATE observations o
SET 
  is_duplicate_coord = true,
  is_quality_filtered = true,
  quality_filter_applied_at = NOW()
WHERE (lat, lon) IN (
  SELECT lat, lon 
  FROM observations 
  GROUP BY lat, lon 
  HAVING COUNT(*) > 1000
);

-- Mark extreme signals
UPDATE observations
SET 
  is_extreme_signal = true,
  is_quality_filtered = true,
  quality_filter_applied_at = NOW()
WHERE level NOT BETWEEN -120 AND 0;

-- Show stats
SELECT 
  COUNT(*) as total_observations,
  COUNT(*) FILTER (WHERE is_temporal_cluster = true) as temporal_clusters,
  COUNT(*) FILTER (WHERE is_duplicate_coord = true) as duplicate_coords,
  COUNT(*) FILTER (WHERE is_extreme_signal = true) as extreme_signals,
  COUNT(*) FILTER (WHERE is_quality_filtered = true) as total_filtered
FROM observations;
SQL

echo ""
echo "=== Refreshing Materialized View ==="
docker exec shadowcheck_postgres bash -c "PGPASSWORD='$PGPASS' psql -U shadowcheck_user -d shadowcheck_db -c 'REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;'"

echo ""
echo "✅ Quality filters applied and MV refreshed"
