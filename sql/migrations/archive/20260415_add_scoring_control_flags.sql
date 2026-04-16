-- Migration: add scoring control feature flags
-- Adds score_debug_logging, auto_geocode_on_import, dedupe_on_scan to app.settings

INSERT INTO app.settings (key, value, description)
VALUES
    (
        'score_debug_logging',
        'false'::jsonb,
        'Emit per-network scoring debug output to the server log'
    ),
    (
        'auto_geocode_on_import',
        'true'::jsonb,
        'Automatically geocode networks when imported via the ETL pipeline'
    ),
    (
        'dedupe_on_scan',
        'true'::jsonb,
        'Deduplicate observation records during scan ingest'
    )
ON CONFLICT (key) DO NOTHING;
