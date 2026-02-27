-- Diagnose why radioTypes filter is timing out

-- Check if type column has an index
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('api_network_explorer_mv', 'networks', 'observations')
  AND indexdef LIKE '%type%'
ORDER BY tablename, indexname;

-- Check MV row count
SELECT 'MV row count' as metric, COUNT(*) as value FROM app.api_network_explorer_mv;

-- Check type distribution in MV
SELECT type, COUNT(*) as count
FROM app.api_network_explorer_mv
GROUP BY type
ORDER BY count DESC;

-- Test query performance with WiFi filter (should be fast)
EXPLAIN ANALYZE
SELECT bssid, ssid, type, signal
FROM app.api_network_explorer_mv
WHERE type = 'W'
LIMIT 10;

-- Check if MV is fresh
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
    (SELECT COUNT(*) FROM app.api_network_explorer_mv) as row_count
FROM pg_matviews
WHERE matviewname = 'api_network_explorer_mv';
