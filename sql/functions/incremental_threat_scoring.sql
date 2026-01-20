-- Incremental Threat Score Computation Function
-- Purpose: Compute threat scores in batches for performance using cache table

CREATE OR REPLACE FUNCTION refresh_threat_scores_incremental(
  batch_size INTEGER DEFAULT 1000,
  max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  processed_count INTEGER,
  updated_count INTEGER,
  execution_time_ms INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  start_time TIMESTAMPTZ := clock_timestamp();
  processed INTEGER := 0;
  updated INTEGER := 0;
  batch_record RECORD;
BEGIN
  -- Process networks that need recomputation in batches
  FOR batch_record IN
    WITH networks_to_process AS (
      SELECT mv.bssid, mv.max_distance_meters, mv.unique_locations, mv.unique_days, mv.type, 
             COALESCE(tsc.computed_at, '1970-01-01'::timestamptz) as sort_time
      FROM public.api_network_explorer_mv mv
      LEFT JOIN public.threat_scores_cache tsc ON tsc.bssid = mv.bssid
      WHERE tsc.needs_recompute = TRUE 
         OR tsc.computed_at IS NULL
         OR tsc.computed_at < (NOW() - INTERVAL '1 hour' * max_age_hours)
         OR tsc.bssid IS NULL
      ORDER BY sort_time ASC
      LIMIT batch_size
    )
    SELECT bssid, max_distance_meters, unique_locations, unique_days, type FROM networks_to_process
  LOOP
    DECLARE
      computed_score NUMERIC(5,1);
      computed_level TEXT;
      computed_summary TEXT;
      computed_flags TEXT[];
      mobility_class TEXT;
    BEGIN
      -- Determine mobility class based on distance
      mobility_class := CASE
        WHEN batch_record.type IN ('L', 'G', 'N') THEN 'CELLULAR'
        WHEN batch_record.type IN ('W', 'E', 'B') THEN
          CASE
            WHEN COALESCE(batch_record.max_distance_meters, 0) > 2000 THEN 'MOBILE_HIGH'
            WHEN COALESCE(batch_record.max_distance_meters, 0) > 500 AND COALESCE(batch_record.unique_locations, 0) >= 3 THEN 'MOBILE_MEDIUM'
            WHEN COALESCE(batch_record.max_distance_meters, 0) > 100 AND COALESCE(batch_record.unique_days, 0) >= 2 THEN 'MOBILE_LOW'
            ELSE 'STATIONARY'
          END
        ELSE
          CASE
            WHEN COALESCE(batch_record.max_distance_meters, 0) > 5000 THEN 'MOBILE_HIGH'
            WHEN COALESCE(batch_record.max_distance_meters, 0) > 1000 AND COALESCE(batch_record.unique_locations, 0) >= 5 THEN 'MOBILE_MEDIUM'
            ELSE 'STATIONARY'
          END
      END;

      -- Calculate threat score based on mobility
      CASE mobility_class
        WHEN 'CELLULAR' THEN
          computed_score := 0;
          computed_level := 'NONE';
          computed_summary := 'Cellular network excluded from threat analysis';
          computed_flags := ARRAY['CELLULAR_EXCLUDED'];
        
        WHEN 'MOBILE_HIGH' THEN
          computed_score := LEAST(100, 50 + (COALESCE(batch_record.max_distance_meters, 0) / 1000.0) * 10);
          computed_level := 'HIGH';
          computed_summary := 'High mobility device: ' || ROUND(COALESCE(batch_record.max_distance_meters, 0)::numeric / 1000.0, 1) || 'km movement detected';
          computed_flags := ARRAY['MOBILE_HIGH', 'EXTREME_RANGE'];
        
        WHEN 'MOBILE_MEDIUM' THEN
          computed_score := LEAST(80, 30 + (COALESCE(batch_record.max_distance_meters, 0) / 100.0) * 2);
          computed_level := 'MED';
          computed_summary := 'Medium mobility device: ' || ROUND(COALESCE(batch_record.max_distance_meters, 0)::numeric, 0) || 'm across ' || COALESCE(batch_record.unique_locations, 0) || ' locations';
          computed_flags := ARRAY['MOBILE_MEDIUM', 'MULTI_LOCATION'];
        
        WHEN 'MOBILE_LOW' THEN
          computed_score := LEAST(50, 15 + (COALESCE(batch_record.max_distance_meters, 0) / 50.0));
          computed_level := 'LOW';
          computed_summary := 'Low mobility device: ' || ROUND(COALESCE(batch_record.max_distance_meters, 0)::numeric, 0) || 'm over ' || COALESCE(batch_record.unique_days, 0) || ' days';
          computed_flags := ARRAY['MOBILE_LOW', 'MULTI_DAY'];
        
        ELSE -- STATIONARY
          computed_score := 0;
          computed_level := 'NONE';
          computed_summary := 'Stationary device: <100m movement';
          computed_flags := ARRAY['STATIONARY'];
      END CASE;

      -- Upsert the computed values into cache table
      INSERT INTO public.threat_scores_cache (
        bssid, threat_score, threat_level, threat_summary, threat_flags, computed_at, needs_recompute
      ) VALUES (
        batch_record.bssid, computed_score, computed_level, computed_summary, computed_flags, NOW(), FALSE
      )
      ON CONFLICT (bssid) DO UPDATE SET
        threat_score = EXCLUDED.threat_score,
        threat_level = EXCLUDED.threat_level,
        threat_summary = EXCLUDED.threat_summary,
        threat_flags = EXCLUDED.threat_flags,
        computed_at = EXCLUDED.computed_at,
        needs_recompute = EXCLUDED.needs_recompute;

      processed := processed + 1;
      updated := updated + 1;
    END;
  END LOOP;

  -- Return results
  RETURN QUERY SELECT 
    processed,
    updated,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - start_time))::INTEGER;
END;
$$;

COMMENT ON FUNCTION refresh_threat_scores_incremental IS 
'Incrementally compute threat scores for networks that need updates using cache table. 
Processes in batches for performance and tracks execution metrics.';

-- Create function to mark networks for recomputation when observations change
CREATE OR REPLACE FUNCTION mark_network_for_threat_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark network for recomputation when new observations are added
  INSERT INTO public.threat_scores_cache (bssid, needs_recompute)
  VALUES (NEW.bssid, TRUE)
  ON CONFLICT (bssid) DO UPDATE SET needs_recompute = TRUE;
  
  RETURN NEW;
END;
$$;

-- Create trigger on observations table (if it doesn't exist)
DROP TRIGGER IF EXISTS trigger_mark_threat_recompute ON public.observations;
CREATE TRIGGER trigger_mark_threat_recompute
  AFTER INSERT ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION mark_network_for_threat_recompute();
