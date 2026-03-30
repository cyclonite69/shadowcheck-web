-- Migration: Add missing columns to app.networks table to satisfy Universal Filter Query Builder expectations
-- Date: 2026-03-29

ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS min_altitude_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS max_altitude_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_span_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS last_altitude_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_accuracy_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_days integer DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_locations integer DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS is_sentinel boolean DEFAULT false;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS accuracy_meters double precision DEFAULT 0;

-- Optional: Populate is_sentinel from app.access_points if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'access_points') THEN
        UPDATE app.networks n
        SET is_sentinel = ap.is_sentinel
        FROM app.access_points ap
        WHERE n.bssid = ap.bssid;
    END IF;
END $$;
