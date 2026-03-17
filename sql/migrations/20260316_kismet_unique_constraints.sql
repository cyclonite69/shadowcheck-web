-- Migration: Add unique constraints to Kismet Sidecar tables (with Deduplication)
-- Date: 2026-03-16
-- Purpose: Enable clean merging of multiple .kismet databases. 
--          Cleans up existing duplicates before applying unique indexes.

BEGIN;

-- 1. Deduplicate app.kismet_packets (hash, ts_sec, ts_usec)
DELETE FROM app.kismet_packets
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY hash, ts_sec, ts_usec ORDER BY id) as row_num
        FROM app.kismet_packets
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_packets_forensic_id ON app.kismet_packets (hash, ts_sec, ts_usec);

-- 2. Deduplicate app.kismet_alerts (ts_sec, ts_usec, devmac, header)
DELETE FROM app.kismet_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, devmac, header ORDER BY id) as row_num
        FROM app.kismet_alerts
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_alerts_forensic_id ON app.kismet_alerts (ts_sec, ts_usec, devmac, header);

-- 3. Deduplicate app.kismet_messages (ts_sec, ts_usec, message content)
DELETE FROM app.kismet_messages
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, md5(message) ORDER BY id) as row_num
        FROM app.kismet_messages
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_messages_forensic_id ON app.kismet_messages (ts_sec, ts_usec, md5(message));

-- 4. Deduplicate app.kismet_datasources (datasource uuid)
DELETE FROM app.kismet_datasources
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY datasource ORDER BY id) as row_num
        FROM app.kismet_datasources
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_datasources_forensic_id ON app.kismet_datasources (datasource);

-- 5. Deduplicate app.kismet_snapshots (ts_sec, ts_usec, snaptype)
DELETE FROM app.kismet_snapshots
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, snaptype ORDER BY id) as row_num
        FROM app.kismet_snapshots
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_snapshots_forensic_id ON app.kismet_snapshots (ts_sec, ts_usec, snaptype);

-- 6. Deduplicate app.kismet_data (ts_sec, ts_usec, devmac, data_type)
DELETE FROM app.kismet_data
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, devmac, data_type ORDER BY id) as row_num
        FROM app.kismet_data
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_data_forensic_id ON app.kismet_data (ts_sec, ts_usec, devmac, data_type);

COMMIT;
