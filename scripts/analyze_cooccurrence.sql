-- Co-occurrence Analysis
-- Purpose: Identify networks that frequently appear together (convoy/multi-device operations)
-- Usage: psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f scripts/analyze_cooccurrence.sql

\timing on

SELECT '=== Network Co-occurrence Analysis ===' AS report_section;
SELECT '';

-- Find network pairs that appear together frequently
SELECT '1. Top 20 Network Pairs (Appearing Together)' AS section;
WITH co_occurrences AS (
    SELECT
        o1.bssid AS network_1,
        o2.bssid AS network_2,
        COUNT(*) AS times_together,
        AVG(ST_Distance(
            ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
        )) AS avg_distance_m,
        AVG(ABS(EXTRACT(EPOCH FROM (o2.time - o1.time)))) AS avg_time_diff_sec
    FROM app.observations o1
    JOIN app.observations o2 ON o2.bssid > o1.bssid  -- Avoid duplicates
    WHERE o1.lat IS NOT NULL
        AND o1.lon IS NOT NULL
        AND o2.lat IS NOT NULL
        AND o2.lon IS NOT NULL
        AND ST_Distance(
            ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
        ) < 100  -- Within 100m
        AND ABS(EXTRACT(EPOCH FROM (o2.time - o1.time))) < 300  -- Within 5 minutes
    GROUP BY o1.bssid, o2.bssid
    HAVING COUNT(*) >= 5  -- Appeared together 5+ times
)
SELECT
    co.network_1,
    n1.ssid AS ssid_1,
    rm1.manufacturer AS manufacturer_1,
    co.network_2,
    n2.ssid AS ssid_2,
    rm2.manufacturer AS manufacturer_2,
    co.times_together,
    ROUND(co.avg_distance_m, 1) AS avg_distance_m,
    ROUND(co.avg_time_diff_sec, 1) AS avg_time_diff_sec
FROM co_occurrences co
LEFT JOIN app.networks n1 ON n1.bssid = co.network_1
LEFT JOIN app.networks n2 ON n2.bssid = co.network_2
LEFT JOIN app.radio_manufacturers rm1 ON rm1.prefix = UPPER(REPLACE(SUBSTRING(co.network_1, 1, 8), ':', ''))
LEFT JOIN app.radio_manufacturers rm2 ON rm2.prefix = UPPER(REPLACE(SUBSTRING(co.network_2, 1, 8), ':', ''))
ORDER BY co.times_together DESC
LIMIT 20;

SELECT '';

-- AirLink fleet co-occurrence
SELECT '2. AirLink Fleet Co-occurrence (PAS-### networks)' AS section;
WITH airlink_pairs AS (
    SELECT
        o1.bssid AS network_1,
        o2.bssid AS network_2,
        COUNT(*) AS times_together
    FROM app.observations o1
    JOIN app.observations o2 ON o2.bssid > o1.bssid
    JOIN app.networks n1 ON n1.bssid = o1.bssid
    JOIN app.networks n2 ON n2.bssid = o2.bssid
    JOIN app.radio_manufacturers rm1 ON rm1.prefix = UPPER(REPLACE(SUBSTRING(o1.bssid, 1, 8), ':', ''))
    JOIN app.radio_manufacturers rm2 ON rm2.prefix = UPPER(REPLACE(SUBSTRING(o2.bssid, 1, 8), ':', ''))
    WHERE o1.lat IS NOT NULL
        AND o1.lon IS NOT NULL
        AND o2.lat IS NOT NULL
        AND o2.lon IS NOT NULL
        AND rm1.manufacturer ILIKE '%AirLink%'
        AND rm2.manufacturer ILIKE '%AirLink%'
        AND ST_Distance(
            ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
        ) < 100
        AND ABS(EXTRACT(EPOCH FROM (o2.time - o1.time))) < 300
    GROUP BY o1.bssid, o2.bssid
    HAVING COUNT(*) >= 3
)
SELECT
    ap.network_1,
    n1.ssid AS ssid_1,
    ap.network_2,
    n2.ssid AS ssid_2,
    ap.times_together
FROM airlink_pairs ap
LEFT JOIN app.networks n1 ON n1.bssid = ap.network_1
LEFT JOIN app.networks n2 ON n2.bssid = ap.network_2
ORDER BY ap.times_together DESC;

SELECT '';

-- Networks with most co-occurrence partners
SELECT '3. Networks with Most Co-occurrence Partners (Convoy Leaders)' AS section;
WITH network_partners AS (
    SELECT
        o1.bssid,
        COUNT(DISTINCT o2.bssid) AS partner_count,
        SUM(CASE WHEN o2.bssid IS NOT NULL THEN 1 ELSE 0 END) AS total_co_occurrences
    FROM app.observations o1
    LEFT JOIN app.observations o2 ON o2.bssid != o1.bssid
        AND o2.lat IS NOT NULL
        AND o2.lon IS NOT NULL
        AND ST_Distance(
            ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
        ) < 100
        AND ABS(EXTRACT(EPOCH FROM (o2.time - o1.time))) < 300
    WHERE o1.lat IS NOT NULL
        AND o1.lon IS NOT NULL
    GROUP BY o1.bssid
    HAVING COUNT(DISTINCT o2.bssid) >= 3
)
SELECT
    np.bssid,
    n.ssid,
    rm.manufacturer AS manufacturer,
    np.partner_count,
    np.total_co_occurrences
FROM network_partners np
LEFT JOIN app.networks n ON n.bssid = np.bssid
LEFT JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(np.bssid, 1, 8), ':', ''))
ORDER BY np.partner_count DESC, np.total_co_occurrences DESC
LIMIT 20;

SELECT '';
SELECT '=== Analysis Complete ===' AS report_section;
