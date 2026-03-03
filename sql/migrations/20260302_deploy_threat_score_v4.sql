-- Migration: Deploy Threat Score v4.0
-- Date: 2026-03-02
-- Purpose: Replace v2/v3 with v4 scoring engine featuring individual behavior detection and fleet correlation
--
-- Changes:
-- - Removed v2 and v3 scoring functions (legacy)
-- - Added v4 with following pattern detection (35%)
-- - Added parked surveillance detection (20%)
-- - Added location correlation scoring (15%)
-- - Added equipment profile scoring (10%)
-- - Added temporal persistence scoring (5%)
-- - Added fleet correlation bonus (15%)
--
-- Total: 85% individual behavior + 15% fleet bonus = 100 max score
--
-- Note: Scores are computed on-demand by the API. No recomputation needed.

-- Drop legacy functions
DROP FUNCTION IF EXISTS calculate_threat_score_v2(TEXT);
DROP FUNCTION IF EXISTS calculate_threat_score_v3(TEXT);

-- Deploy v4 function
\i sql/functions/calculate_threat_score_v4.sql

-- Verify deployment
SELECT 'v4 function deployed successfully - scores will be computed on-demand' AS status;
