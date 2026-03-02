-- Mark observations with quality issues
-- Run after ETL imports to flag bad data before MV refresh

CREATE OR REPLACE FUNCTION app.mark_quality_filtered_observations()
RETURNS TABLE(
  temporal_clusters bigint,
  extreme_signals bigint,
  duplicate_coords bigint,
  total_marked bigint,
  execution_time_ms bigint
) AS $$
DECLARE
  start_time timestamptz;
  temporal_count bigint;
  extreme_count bigint;
  duplicate_count bigint;
  total_count bigint;
BEGIN
  start_time := clock_timestamp();
  
  -- Mark temporal clusters (>50 obs at same time/location)
  WITH temporal_bad AS (
    SELECT time, lat, lon
    FROM app.observations
    WHERE time IS NOT NULL AND lat IS NOT NULL AND lon IS NOT NULL
    GROUP BY time, lat, lon
    HAVING COUNT(*) > 50
  )
  UPDATE app.observations o
  SET is_temporal_cluster = true
  FROM temporal_bad t
  WHERE o.time = t.time AND o.lat = t.lat AND o.lon = t.lon
    AND o.is_temporal_cluster = false;
  
  GET DIAGNOSTICS temporal_count = ROW_COUNT;
  
  -- Mark extreme signals (outside -120 to 0 dBm range)
  UPDATE app.observations
  SET is_extreme_signal = true
  WHERE (level < -120 OR level > 0)
    AND is_extreme_signal = false;
  
  GET DIAGNOSTICS extreme_count = ROW_COUNT;
  
  -- Mark duplicate coordinates (>1000 obs at same location)
  WITH duplicate_bad AS (
    SELECT lat, lon
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    GROUP BY lat, lon
    HAVING COUNT(*) > 1000
  )
  UPDATE app.observations o
  SET is_duplicate_coord = true
  FROM duplicate_bad d
  WHERE o.lat = d.lat AND o.lon = d.lon
    AND o.is_duplicate_coord = false;
  
  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  
  -- Set is_quality_filtered flag for any observation with quality issues
  UPDATE app.observations
  SET 
    is_quality_filtered = true,
    quality_filter_applied_at = NOW()
  WHERE (is_temporal_cluster = true OR is_extreme_signal = true OR is_duplicate_coord = true)
    AND (is_quality_filtered = false OR is_quality_filtered IS NULL);
  
  GET DIAGNOSTICS total_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    temporal_count,
    extreme_count,
    duplicate_count,
    total_count,
    EXTRACT(EPOCH FROM (clock_timestamp() - start_time) * 1000)::bigint;
END;
$$ LANGUAGE plpgsql;
