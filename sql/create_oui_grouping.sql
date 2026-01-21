-- OUI Device Grouping and MAC Randomization Detection
-- Groups BSSIDs by OUI (vendor MAC prefix) to detect same-device networks

CREATE TABLE IF NOT EXISTS app.oui_device_groups (
  id SERIAL PRIMARY KEY,
  oui VARCHAR(8) NOT NULL UNIQUE,
  vendor_name VARCHAR(256),
  device_count INTEGER DEFAULT 0,
  collective_threat_score NUMERIC(5,2),
  threat_level VARCHAR(20),
  primary_bssid VARCHAR(17),
  secondary_bssids TEXT[], -- Array of other BSSIDs
  radio_types TEXT[], -- ['WiFi', 'BLE', 'WiFi Direct']
  has_randomization BOOLEAN DEFAULT FALSE,
  randomization_confidence NUMERIC(5,2),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oui_device_groups_oui ON app.oui_device_groups(oui);
CREATE INDEX IF NOT EXISTS idx_oui_device_groups_threat ON app.oui_device_groups(collective_threat_score DESC);

-- MAC Randomization Detection Table
CREATE TABLE IF NOT EXISTS app.mac_randomization_suspects (
  id SERIAL PRIMARY KEY,
  oui VARCHAR(8) NOT NULL,
  mac_sequence TEXT[], -- Array of observed MACs in chronological order
  location_sequence POINT[], -- Array of locations where each MAC was seen
  time_deltas INTEGER[], -- Hours between MAC observations
  avg_distance_km NUMERIC(8,2),
  movement_speed_kmh NUMERIC(8,2),
  confidence_score NUMERIC(5,2),
  status VARCHAR(20) DEFAULT 'suspected', -- suspected, confirmed, benign
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mac_randomization_oui ON app.mac_randomization_suspects(oui);
CREATE INDEX IF NOT EXISTS idx_mac_randomization_confidence ON app.mac_randomization_suspects(confidence_score DESC);

-- Helper function to group networks by OUI
CREATE OR REPLACE FUNCTION app.get_oui_groups()
RETURNS TABLE (
  oui VARCHAR(8),
  vendor_name VARCHAR(256),
  bssid_count INTEGER,
  bssids TEXT[],
  collective_threat_score NUMERIC(5,2),
  threat_level VARCHAR(20),
  has_randomization BOOLEAN,
  randomization_confidence NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    odg.oui,
    odg.vendor_name,
    odg.device_count,
    ARRAY_PREPEND(odg.primary_bssid, odg.secondary_bssids),
    odg.collective_threat_score,
    odg.threat_level,
    odg.has_randomization,
    odg.randomization_confidence
  FROM app.oui_device_groups odg
  ORDER BY odg.collective_threat_score DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE app.oui_device_groups IS 'Groups BSSIDs by OUI (vendor MAC prefix) to detect same-device networks';
COMMENT ON TABLE app.mac_randomization_suspects IS 'Tracks MAC randomization patterns (walked BSSIDs)';
