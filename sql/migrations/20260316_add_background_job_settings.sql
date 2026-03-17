-- Migration: Add background job settings
-- Date: 2026-03-16
-- Purpose: Store background job configuration in app.settings for frontend control

-- Backup Job Config
INSERT INTO app.settings (key, value, description)
VALUES (
    'backup_job_config',
    '{"enabled": false, "cron": "0 3 * * *", "uploadToS3": true}'::jsonb,
    'Configuration for automated database backups'
) ON CONFLICT (key) DO NOTHING;

-- ML Scoring Job Config
INSERT INTO app.settings (key, value, description)
VALUES (
    'ml_scoring_job_config',
    '{"enabled": true, "cron": "0 */4 * * *", "limit": 10000}'::jsonb,
    'Configuration for behavioral threat scoring'
) ON CONFLICT (key) DO NOTHING;

-- Materialized View Refresh Job Config
INSERT INTO app.settings (key, value, description)
VALUES (
    'mv_refresh_job_config',
    '{"enabled": true, "cron": "30 4 * * *"}'::jsonb,
    'Configuration for daily materialized view refreshes'
) ON CONFLICT (key) DO NOTHING;
