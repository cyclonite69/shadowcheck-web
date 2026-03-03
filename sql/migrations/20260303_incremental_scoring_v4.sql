-- Incremental Threat Scoring v4 System
-- Purpose: Automatically mark networks for rescoring when observations change

-- Step 1: Trigger function to mark networks for rescoring
CREATE OR REPLACE FUNCTION app.mark_network_for_rescoring()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert or update the cache entry to mark for rescoring
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, true)
    ON CONFLICT (bssid) DO UPDATE
    SET needs_recompute = true;
    
    RETURN NEW;
END;
$$;

-- Step 2: Attach trigger to observations table
DROP TRIGGER IF EXISTS trigger_mark_for_rescoring ON app.observations;
CREATE TRIGGER trigger_mark_for_rescoring
    AFTER INSERT ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.mark_network_for_rescoring();

COMMENT ON FUNCTION app.mark_network_for_rescoring IS 
'Marks networks for rescoring when new observations are added';

-- Step 3: Populate cache with existing networks
INSERT INTO app.threat_scores_cache (bssid, threat_score, threat_level, computed_at, needs_recompute)
SELECT 
    nts.bssid,
    nts.final_threat_score,
    nts.final_threat_level,
    nts.updated_at,
    false  -- Already scored
FROM app.network_threat_scores nts
ON CONFLICT (bssid) DO UPDATE
SET 
    threat_score = EXCLUDED.threat_score,
    threat_level = EXCLUDED.threat_level,
    computed_at = EXCLUDED.computed_at,
    needs_recompute = false;

SELECT 'Incremental scoring system initialized' AS status;
SELECT 
    COUNT(*) AS total_cached,
    COUNT(*) FILTER (WHERE needs_recompute = true) AS needs_rescoring
FROM app.threat_scores_cache;
