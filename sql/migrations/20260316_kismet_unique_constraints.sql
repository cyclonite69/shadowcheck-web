-- Migration: Add unique constraints to Kismet Sidecar tables
-- Date: 2026-03-16
-- Purpose: Enable clean merging of multiple .kismet databases by defining unique forensic keys

-- 1. Packets: Unique on hash and microsecond timestamp
-- If hash isn't enough, adding timestamps ensures we don't collide on identical frames at different times
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_packets_forensic_id ON app.kismet_packets (hash, ts_sec, ts_usec);

-- 2. Alerts: Unique on timestamp, device, and header
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_alerts_forensic_id ON app.kismet_alerts (ts_sec, ts_usec, devmac, header);

-- 3. Messages: Unique on timestamp and content
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_messages_forensic_id ON app.kismet_messages (ts_sec, ts_usec, MD5(message));

-- 4. Datasources: Unique on the datasource identifier (usually a UUID)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_datasources_forensic_id ON app.kismet_datasources (datasource);

-- 5. Snapshots: Unique on timestamp and type
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_snapshots_forensic_id ON app.kismet_snapshots (ts_sec, ts_usec, snaptype);

-- 6. Extra Data: Unique on timestamp, type and device
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_data_forensic_id ON app.kismet_data (ts_sec, ts_usec, devmac, data_type);
