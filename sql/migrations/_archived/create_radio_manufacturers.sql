-- Create radio_manufacturers table matching CSV structure
-- Includes generated alias columns for application code compatibility
CREATE TABLE IF NOT EXISTS app.radio_manufacturers (
    registry_type TEXT NOT NULL,
    oui_assignment_hex TEXT NOT NULL,
    prefix_24bit TEXT,
    prefix_28bit TEXT,
    prefix_36bit TEXT,
    organization_name TEXT NOT NULL,
    organization_address TEXT,
    -- Compatibility columns referenced by application code
    oui TEXT GENERATED ALWAYS AS (oui_assignment_hex) STORED,
    oui_prefix_24bit TEXT GENERATED ALWAYS AS (prefix_24bit) STORED,
    manufacturer TEXT GENERATED ALWAYS AS (organization_name) STORED,
    address TEXT GENERATED ALWAYS AS (organization_address) STORED,
    PRIMARY KEY (registry_type, oui_assignment_hex)
);

CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_oui ON app.radio_manufacturers(oui);
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_oui_hex ON app.radio_manufacturers(oui_assignment_hex);
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_prefix24 ON app.radio_manufacturers(prefix_24bit);
