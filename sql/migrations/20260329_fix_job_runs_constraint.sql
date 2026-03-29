-- Migration: Add siblingDetection to background_job_runs check constraint
-- Date: 2026-03-29

BEGIN;

ALTER TABLE app.background_job_runs 
DROP CONSTRAINT IF EXISTS background_job_runs_job_name_check;

ALTER TABLE app.background_job_runs 
ADD CONSTRAINT background_job_runs_job_name_check 
CHECK (job_name IN ('backup', 'mlScoring', 'mvRefresh', 'siblingDetection'));

COMMIT;
