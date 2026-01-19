-- Threat Scoring Algorithm v2.0 - Forensic Intelligence Scoring
-- Purpose: Enhanced threat detection with geographical impossibility, multi-radio correlation, and temporal analysis
-- Author: ShadowCheck Threat Intelligence System
-- Version: 2.0

CREATE OR REPLACE FUNCTION calculate_threat_score_v2(p_bssid TEXT)
RETURNS TABLE (
  bssid TEXT,
  threat_score_v2 NUMERIC,
  threat_factors JSONB,
  threat_level TEXT
) AS $$
WITH base_stats AS (
  -- Gather all observation statistics for this BSSID
  SELECT
    $1 as bssid,
    COUNT(*) as total_observations,
    COUNT(DISTINCT ST_SnapToGrid(geom, 0.001)) as unique_locations,
    MIN(time) as first_seen,
    MAX(time) as last_seen,
    EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 86400.0 as days_span,
    ST_Distance(
      ST_Point(MIN(lon), MIN(lat))::geography,
      ST_Point(MAX(lon), MAX(lat))::geography
    ) as geographic_spread_meters,
    COUNT(DISTINCT radio_type) as unique_radio_types
  FROM observations
  WHERE bssid = $1
),
multi_radio AS (
  -- Count different radio types observed within 50m and 60 seconds of this BSSID
  -- This indicates coordinated multi-radio surveillance platforms
  SELECT COUNT(DISTINCT o2.radio_type) as correlated_types
  FROM observations o1
  JOIN observations o2 ON 
    ST_DWithin(o1.geom::geography, o2.geom::geography, 50)
    AND ABS(EXTRACT(EPOCH FROM (o1.time - o2.time))) < 60
    AND o1.bssid = $1
    AND o2.bssid != $1  -- Different networks
    AND o1.radio_type != o2.radio_type  -- Different radio types
),
factor_scores AS (
  SELECT
    bs.bssid,
    bs.total_observations,
    bs.unique_locations,
    bs.days_span,
    bs.geographic_spread_meters,
    bs.unique_radio_types,
    COALESCE(mr.correlated_types, 0) as correlated_radio_types,
    
    -- FACTOR 1: Geographical Impossibility (35% weight)
    -- Logic: Radio-type aware impossibility detection
    -- WiFi/BLE: ~100m expected range, suspicious if >1km in <1 day
    -- GSM/LTE: ~35km legitimate range, only suspicious if >100km in <1 hour
    -- Ethernet: Should be stationary, any movement suspicious
    CASE 
      WHEN bs.days_span <= 0 THEN 0
      -- WiFi/Bluetooth: Short range radios
      WHEN bs.unique_radio_types = 1 AND EXISTS(SELECT 1 FROM observations WHERE bssid = $1 AND radio_type IN ('W', 'B')) THEN
        CASE 
          WHEN (bs.geographic_spread_meters / 1000.0) > (bs.days_span * 0.1 + 0.1) THEN
            LEAST(100, ((bs.geographic_spread_meters / 1000.0) / (bs.days_span * 0.1 + 0.1)) * 75)
          ELSE 0
        END
      -- Cellular: Long range legitimate, only flag extreme cases
      WHEN bs.unique_radio_types = 1 AND EXISTS(SELECT 1 FROM observations WHERE bssid = $1 AND radio_type IN ('G', 'L')) THEN
        CASE 
          WHEN (bs.geographic_spread_meters / 1000.0) > 100 AND bs.days_span < 0.04 THEN -- >100km in <1 hour
            LEAST(100, ((bs.geographic_spread_meters / 1000.0) / 100.0) * 50)
          ELSE 0
        END
      -- Ethernet: Should be stationary
      WHEN bs.unique_radio_types = 1 AND EXISTS(SELECT 1 FROM observations WHERE bssid = $1 AND radio_type = 'E') THEN
        CASE 
          WHEN bs.geographic_spread_meters > 100 THEN -- Any movement >100m suspicious for Ethernet
            LEAST(100, (bs.geographic_spread_meters / 100.0) * 60)
          ELSE 0
        END
      -- Mixed radio types: Use WiFi/BLE rules (most restrictive)
      ELSE
        CASE 
          WHEN (bs.geographic_spread_meters / 1000.0) > (bs.days_span * 0.1 + 0.1) THEN
            LEAST(100, ((bs.geographic_spread_meters / 1000.0) / (bs.days_span * 0.1 + 0.1)) * 50)
          ELSE 0
        END
    END as impossibility_score,
    
    -- FACTOR 2: Temporal Clustering (25% weight)  
    -- Logic: Suspicious if MANY locations over SHORT time (stalking pattern)
    -- NOT suspicious: Few locations over long time (normal mobile device)
    CASE
      WHEN bs.days_span <= 0 OR bs.unique_locations <= 1 THEN 0
      -- Only suspicious if >20 locations in <30 days (active stalking)
      WHEN bs.unique_locations > 20 AND bs.days_span < 30 THEN
        LEAST(100, (bs.unique_locations / 20.0) * (30.0 / bs.days_span) * 100)
      -- Or >50 locations in <90 days  
      WHEN bs.unique_locations > 50 AND bs.days_span < 90 THEN
        LEAST(100, (bs.unique_locations / 50.0) * (90.0 / bs.days_span) * 80)
      ELSE 0
    END as temporal_score,
    
    -- FACTOR 3: Multi-Band Correlation (20% weight)
    -- Logic: Suspicious if CONSISTENTLY observed with multiple radio types
    -- Cars/phones naturally have multiple radios - only flag if unusual pattern
    CASE 
      -- Only suspicious if 3+ different radio types AND high consistency
      WHEN COALESCE(mr.correlated_types, 0) >= 3 AND bs.total_observations > 10 THEN 40
      WHEN COALESCE(mr.correlated_types, 0) = 2 AND bs.total_observations > 20 THEN 20
      ELSE 0
    END as correlation_score,
    
    -- FACTOR 4: Observation Density (15% weight)
    -- Logic: Suspicious if VERY high observation frequency (active tracking)
    -- Normal mobile devices: 1-50 observations over months = not suspicious
    -- Surveillance devices: 200+ observations in short time = suspicious
    CASE
      WHEN bs.total_observations < 50 THEN 0
      WHEN bs.total_observations >= 500 THEN 
        LEAST(100, (bs.total_observations / 500.0) * 80)
      WHEN bs.total_observations >= 200 AND bs.days_span < 30 THEN
        LEAST(100, (bs.total_observations / 200.0) * (30.0 / bs.days_span) * 60)
      ELSE 0
    END as density_score,
    
    -- FACTOR 5: Co-location Patterns (5% weight)
    -- Placeholder for now - requires separate analysis
    0 as colocation_score
    
  FROM base_stats bs
  CROSS JOIN multi_radio mr
),
final_score AS (
  SELECT
    bssid,
    (
      (impossibility_score * 0.35) +
      (temporal_score * 0.25) +
      (correlation_score * 0.20) +
      (density_score * 0.15) +
      (colocation_score * 0.05)
    )::NUMERIC(5,1) as composite_score,
    impossibility_score,
    temporal_score,
    correlation_score,
    density_score,
    colocation_score,
    unique_radio_types,
    correlated_radio_types,
    total_observations,
    unique_locations,
    days_span,
    geographic_spread_meters
  FROM factor_scores
)
SELECT
  bssid,
  composite_score,
  jsonb_build_object(
    'impossibility', impossibility_score::NUMERIC(5,1),
    'temporal', temporal_score::NUMERIC(5,1),
    'correlation', correlation_score::NUMERIC(5,1),
    'density', density_score::NUMERIC(5,1),
    'colocation', colocation_score::NUMERIC(5,1),
    'total', composite_score,
    'radio_types_unique', unique_radio_types,
    'radio_types_correlated', correlated_radio_types,
    'observations_total', total_observations,
    'locations_unique', unique_locations,
    'days_observed', days_span::NUMERIC(8,1),
    'geographic_spread_km', (geographic_spread_meters / 1000.0)::NUMERIC(8,2),
    'version', 'v2.0'
  ),
  CASE
    WHEN composite_score > 80 THEN 'CRITICAL'
    WHEN composite_score > 60 THEN 'HIGH'
    WHEN composite_score > 40 THEN 'MEDIUM'
    WHEN composite_score > 20 THEN 'LOW'
    ELSE 'MINIMAL'
  END as threat_level
FROM final_score;
$$ LANGUAGE SQL;
