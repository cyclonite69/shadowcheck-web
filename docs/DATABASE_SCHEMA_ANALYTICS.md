# Materialized Views and Analytics Schema

## Purpose

Pre-computed aggregations for dashboard and analytics pages. Refresh on schedule or trigger.

## 1. Network Statistics MV

```sql
CREATE MATERIALIZED VIEW analytics.network_stats AS
SELECT
    n.bssid,
    n.ssid,
    n.manufacturer,
    n.device_type,
    n.encryption_summary,

    -- Observation stats
    COUNT(o.id) as total_observations,
    COUNT(DISTINCT DATE(o.observed_at)) as observation_days,
    MIN(o.observed_at) as first_seen,
    MAX(o.observed_at) as last_seen,

    -- Signal stats
    AVG(o.signal_dbm) as avg_signal,
    MIN(o.signal_dbm) as min_signal,
    MAX(o.signal_dbm) as max_signal,
    STDDEV(o.signal_dbm) as signal_stddev,

    -- Location stats
    COUNT(DISTINCT ST_SnapToGrid(o.location::geometry, 0.001)) as unique_locations,
    ST_Centroid(ST_Collect(o.location::geometry))::geography as centroid_location,

    -- Threat info
    nt.tag_type,
    nt.threat_score,

    -- Freshness
    NOW() as refreshed_at
FROM app.networks n
LEFT JOIN app.observations o ON n.bssid = o.bssid
LEFT JOIN app.network_tags nt ON n.bssid = nt.bssid
GROUP BY n.bssid, n.ssid, n.manufacturer, n.device_type,
         n.encryption_summary, nt.tag_type, nt.threat_score;

CREATE UNIQUE INDEX idx_network_stats_bssid ON analytics.network_stats(bssid);
CREATE INDEX idx_network_stats_threat ON analytics.network_stats(threat_score DESC NULLS LAST);
CREATE INDEX idx_network_stats_manufacturer ON analytics.network_stats(manufacturer);
```

## 2. Daily Activity MV

```sql
CREATE MATERIALIZED VIEW analytics.daily_activity AS
SELECT
    DATE(observed_at) as observation_date,
    source_type,

    -- Counts
    COUNT(DISTINCT bssid) as unique_networks,
    COUNT(*) as total_observations,

    -- Signal
    AVG(signal_dbm) as avg_signal,

    -- Spatial
    ST_Extent(location::geometry) as bounding_box,

    NOW() as refreshed_at
FROM app.observations
GROUP BY DATE(observed_at), source_type
ORDER BY observation_date DESC;

CREATE UNIQUE INDEX idx_daily_activity_date_source
    ON analytics.daily_activity(observation_date, source_type);
```

## 3. Threat Dashboard MV

```sql
CREATE MATERIALIZED VIEW analytics.threat_dashboard AS
SELECT
    nt.tag_type,
    COUNT(*) as network_count,
    AVG(nt.threat_score) as avg_threat_score,

    -- Recent activity
    COUNT(*) FILTER (WHERE n.last_seen_at > NOW() - INTERVAL '24 hours') as active_24h,
    COUNT(*) FILTER (WHERE n.last_seen_at > NOW() - INTERVAL '7 days') as active_7d,

    -- Top threats
    ARRAY_AGG(
        jsonb_build_object(
            'bssid', n.bssid::text,
            'ssid', n.ssid,
            'threat_score', nt.threat_score,
            'last_seen', n.last_seen_at
        ) ORDER BY nt.threat_score DESC LIMIT 10
    ) as top_threats,

    NOW() as refreshed_at
FROM app.network_tags nt
JOIN app.networks n ON nt.bssid = n.bssid
GROUP BY nt.tag_type;

CREATE UNIQUE INDEX idx_threat_dashboard_type ON analytics.threat_dashboard(tag_type);
```

## 4. Manufacturer Statistics MV

```sql
CREATE MATERIALIZED VIEW analytics.manufacturer_stats AS
SELECT
    manufacturer,
    COUNT(DISTINCT bssid) as network_count,
    COUNT(DISTINCT device_type) as device_types,
    ARRAY_AGG(DISTINCT device_type) as device_type_list,

    -- Threat analysis
    COUNT(*) FILTER (WHERE nt.tag_type = 'THREAT') as threat_count,
    AVG(nt.threat_score) as avg_threat_score,

    NOW() as refreshed_at
FROM app.networks n
LEFT JOIN app.network_tags nt ON n.bssid = nt.bssid
WHERE manufacturer IS NOT NULL
GROUP BY manufacturer
ORDER BY network_count DESC;

CREATE UNIQUE INDEX idx_manufacturer_stats_name ON analytics.manufacturer_stats(manufacturer);
```

## 5. Geospatial Heatmap MV

```sql
CREATE MATERIALIZED VIEW analytics.geospatial_heatmap AS
SELECT
    ST_SnapToGrid(location::geometry, 0.01) as grid_cell,  -- ~1km grid
    COUNT(DISTINCT bssid) as network_count,
    COUNT(*) as observation_count,
    AVG(signal_dbm) as avg_signal,

    -- Threat density
    COUNT(*) FILTER (WHERE nt.tag_type = 'THREAT') as threat_count,

    -- Time range
    MIN(observed_at) as first_seen,
    MAX(observed_at) as last_seen,

    NOW() as refreshed_at
FROM app.observations o
LEFT JOIN app.network_tags nt ON o.bssid = nt.bssid
GROUP BY grid_cell;

CREATE INDEX idx_geospatial_heatmap_cell ON analytics.geospatial_heatmap USING gist(grid_cell);
CREATE INDEX idx_geospatial_heatmap_threats ON analytics.geospatial_heatmap(threat_count DESC);
```

## 6. Enrichment Coverage MV

```sql
CREATE MATERIALIZED VIEW analytics.enrichment_coverage AS
SELECT
    COUNT(DISTINCT n.bssid) as total_networks,
    COUNT(DISTINCT e.bssid) as enriched_networks,
    ROUND(COUNT(DISTINCT e.bssid)::numeric / NULLIF(COUNT(DISTINCT n.bssid), 0) * 100, 2) as coverage_pct,

    -- By API source
    jsonb_object_agg(
        COALESCE(e.api_source, 'not_enriched'),
        COUNT(DISTINCT e.bssid)
    ) as by_source,

    -- Venue types
    COUNT(DISTINCT e.bssid) FILTER (WHERE e.is_government) as government_count,
    COUNT(DISTINCT e.bssid) FILTER (WHERE e.is_education) as education_count,
    COUNT(DISTINCT e.bssid) FILTER (WHERE e.is_commercial) as commercial_count,

    NOW() as refreshed_at
FROM app.networks n
LEFT JOIN app.enrichments e ON n.bssid = e.bssid;
```

## Refresh Strategy

```sql
-- Function to refresh all MVs
CREATE OR REPLACE FUNCTION analytics.refresh_all_mvs()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.network_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_activity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.threat_dashboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.manufacturer_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.geospatial_heatmap;
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.enrichment_coverage;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if installed)
-- SELECT cron.schedule('refresh-mvs', '*/15 * * * *', 'SELECT analytics.refresh_all_mvs()');
```
