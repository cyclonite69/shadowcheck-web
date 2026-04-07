-- Migration: Create mobile_uploads table for full-fidelity device metadata tracking
-- Target: app.mobile_uploads

CREATE TABLE IF NOT EXISTS app.mobile_uploads (
    id SERIAL PRIMARY KEY,
    s3_key TEXT NOT NULL UNIQUE,
    source_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    history_id INTEGER REFERENCES app.import_history(id),
    
    -- Full Fidelity Device Metadata
    device_model TEXT,        -- e.g. 'SM-S908U'
    device_id TEXT,           -- e.g. 'S22Ultra'
    os_version TEXT,          -- e.g. 'Android 14'
    app_version TEXT,         -- e.g. '1.4.2-build88'
    battery_level INTEGER,    -- 0-100
    storage_free_gb NUMERIC,  -- e.g. 128.5
    extra_metadata JSONB,     -- Catch-all for extra metrics
    
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION app.update_mobile_uploads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_mobile_uploads_timestamp
    BEFORE UPDATE ON app.mobile_uploads
    FOR EACH ROW
    EXECUTE FUNCTION app.update_mobile_uploads_timestamp();

-- Indexes for status and source tracking
CREATE INDEX idx_mobile_uploads_status ON app.mobile_uploads (status);
CREATE INDEX idx_mobile_uploads_source_tag ON app.mobile_uploads (source_tag);
CREATE INDEX idx_mobile_uploads_created_at ON app.mobile_uploads (created_at DESC);

-- Grants
GRANT SELECT ON app.mobile_uploads TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.mobile_uploads TO shadowcheck_admin;
