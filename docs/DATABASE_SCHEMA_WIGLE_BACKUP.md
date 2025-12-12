# WiGLE Raw Network Table - Backup & Enrichment

## Purpose

Import WiGLE `network` table as-is for:

- **Backup** - Preserve original computed data
- **Enrichment** - Use as reference for missing fields
- **Validation** - Compare our computed values vs WiGLE's
- **Historical** - Keep original best/last locations

## Schema

```sql
CREATE TABLE import.wigle_networks_raw (
    -- Identity
    bssid MACADDR PRIMARY KEY,
    ssid TEXT,

    -- Technical
    frequency_mhz INTEGER,
    capabilities TEXT,

    -- Last seen
    last_time TIMESTAMPTZ,
    last_latitude DOUBLE PRECISION,
    last_longitude DOUBLE PRECISION,
    last_location GEOGRAPHY(POINT, 4326),

    -- Best signal location
    best_level INTEGER,
    best_latitude DOUBLE PRECISION,
    best_longitude DOUBLE PRECISION,
    best_location GEOGRAPHY(POINT, 4326),

    -- WiGLE-specific
    type TEXT, -- W=WiFi, B=Bluetooth, C=Cellular
    rcois TEXT, -- Roaming Consortium OIs
    mfgrid INTEGER, -- Manufacturer grid
    service TEXT, -- Service/venue info

    -- Import tracking
    import_id BIGINT REFERENCES app.imports(id),
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wigle_networks_ssid ON import.wigle_networks_raw(ssid);
CREATE INDEX idx_wigle_networks_last_location ON import.wigle_networks_raw USING gist(last_location);
CREATE INDEX idx_wigle_networks_best_location ON import.wigle_networks_raw USING gist(best_location);
CREATE INDEX idx_wigle_networks_type ON import.wigle_networks_raw(type);
CREATE INDEX idx_wigle_networks_rcois ON import.wigle_networks_raw(rcois) WHERE rcois != '';
```

## Import Function

```sql
CREATE OR REPLACE FUNCTION import.import_wigle_network_table(
    p_import_id BIGINT,
    p_bssid MACADDR,
    p_ssid TEXT,
    p_frequency INTEGER,
    p_capabilities TEXT,
    p_lasttime BIGINT,
    p_lastlat DOUBLE PRECISION,
    p_lastlon DOUBLE PRECISION,
    p_type TEXT,
    p_bestlevel INTEGER,
    p_bestlat DOUBLE PRECISION,
    p_bestlon DOUBLE PRECISION,
    p_rcois TEXT,
    p_mfgrid INTEGER,
    p_service TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO import.wigle_networks_raw (
        bssid, ssid, frequency_mhz, capabilities,
        last_time, last_latitude, last_longitude, last_location,
        type, best_level, best_latitude, best_longitude, best_location,
        rcois, mfgrid, service, import_id
    ) VALUES (
        p_bssid, p_ssid, p_frequency, p_capabilities,
        to_timestamp(p_lasttime / 1000.0),
        p_lastlat, p_lastlon,
        ST_SetSRID(ST_MakePoint(p_lastlon, p_lastlat), 4326)::geography,
        p_type, p_bestlevel, p_bestlat, p_bestlon,
        ST_SetSRID(ST_MakePoint(p_bestlon, p_bestlat), 4326)::geography,
        p_rcois, p_mfgrid, p_service, p_import_id
    )
    ON CONFLICT (bssid) DO UPDATE SET
        ssid = EXCLUDED.ssid,
        frequency_mhz = EXCLUDED.frequency_mhz,
        capabilities = EXCLUDED.capabilities,
        last_time = EXCLUDED.last_time,
        last_latitude = EXCLUDED.last_latitude,
        last_longitude = EXCLUDED.last_longitude,
        last_location = EXCLUDED.last_location,
        best_level = EXCLUDED.best_level,
        best_latitude = EXCLUDED.best_latitude,
        best_longitude = EXCLUDED.best_longitude,
        best_location = EXCLUDED.best_location,
        rcois = EXCLUDED.rcois,
        mfgrid = EXCLUDED.mfgrid,
        service = EXCLUDED.service;
END;
$$ LANGUAGE plpgsql;
```

## Enrichment Queries

### Enrich observations with WiGLE network data

```sql
-- Add SSID from WiGLE network table where missing
UPDATE app.observations o
SET ssid = w.ssid
FROM import.wigle_networks_raw w
WHERE o.bssid = w.bssid
    AND (o.ssid IS NULL OR o.ssid = '');

-- Add frequency where missing
UPDATE app.observations o
SET frequency_mhz = w.frequency_mhz
FROM import.wigle_networks_raw w
WHERE o.bssid = w.bssid
    AND o.frequency_mhz IS NULL;

-- Add capabilities where missing
UPDATE app.observations o
SET capabilities = w.capabilities
FROM import.wigle_networks_raw w
WHERE o.bssid = w.bssid
    AND o.capabilities IS NULL;

-- Add WiGLE-specific metadata
UPDATE app.observations o
SET metadata = metadata || jsonb_build_object(
    'wigle', jsonb_build_object(
        'rcois', w.rcois,
        'service', w.service,
        'mfgrid', w.mfgrid,
        'type', w.type,
        'best_level', w.best_level,
        'best_location', jsonb_build_object(
            'latitude', w.best_latitude,
            'longitude', w.best_longitude
        )
    )
)
FROM import.wigle_networks_raw w
WHERE o.bssid = w.bssid
    AND o.source_type = 'wigle_app';
```

## Validation Queries

### Compare our computed values vs WiGLE's

```sql
-- Compare best signal location
SELECT
    w.bssid,
    w.ssid,
    w.best_level as wigle_best_signal,
    (SELECT MAX(signal_dbm) FROM app.observations WHERE bssid = w.bssid) as our_best_signal,
    w.best_latitude as wigle_best_lat,
    (SELECT latitude FROM app.observations WHERE bssid = w.bssid ORDER BY signal_dbm DESC LIMIT 1) as our_best_lat,
    ST_Distance(
        w.best_location,
        (SELECT location FROM app.observations WHERE bssid = w.bssid ORDER BY signal_dbm DESC LIMIT 1)
    ) as distance_meters
FROM import.wigle_networks_raw w
LIMIT 10;

-- Find networks with Passpoint (rcois)
SELECT
    bssid,
    ssid,
    rcois,
    service,
    COUNT(*) as observation_count
FROM import.wigle_networks_raw w
LEFT JOIN app.observations o USING (bssid)
WHERE rcois != ''
GROUP BY bssid, ssid, rcois, service;
```

## View with WiGLE Enrichment

```sql
CREATE VIEW app.networks_enriched AS
SELECT
    n.*,
    w.rcois as wigle_rcois,
    w.service as wigle_service,
    w.type as wigle_type,
    w.best_level as wigle_best_signal,
    w.best_location as wigle_best_location,
    w.last_time as wigle_last_seen
FROM app.networks n
LEFT JOIN import.wigle_networks_raw w ON n.bssid = w.bssid;
```

## Updated Import Script

```javascript
// Import WiGLE network table first (backup)
async function importWigleNetworkTable(sqliteDb, importId, stats) {
  return new Promise((resolve, reject) => {
    sqliteDb.each(
      'SELECT * FROM network',
      async (err, row) => {
        if (err) {
          stats.errors.push({ table: 'network', error: err.message });
          return;
        }

        try {
          await pgPool.query(
            `
                        SELECT import.import_wigle_network_table(
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                        )
                    `,
            [
              importId,
              row.bssid,
              row.ssid,
              row.frequency,
              row.capabilities,
              row.lasttime,
              row.lastlat,
              row.lastlon,
              row.type,
              row.bestlevel,
              row.bestlat,
              row.bestlon,
              row.rcois,
              row.mfgrid,
              row.service,
            ]
          );

          stats.networks_backup++;
          if (stats.networks_backup % 1000 === 0) {
            process.stdout.write(`\r   Backed up ${stats.networks_backup} networks...`);
          }
        } catch (error) {
          stats.errors.push({ table: 'network', error: error.message, bssid: row.bssid });
        }
      },
      (err, count) => {
        if (err) reject(err);
        else {
          console.log(
            `\r   ✓ Backed up ${stats.networks_backup} networks to import.wigle_networks_raw`
          );
          resolve();
        }
      }
    );
  });
}

// Updated import order
async function importWigleDatabase() {
  // 1. Import network table (backup)
  await importWigleNetworkTable(sqliteDb, importId, stats);

  // 2. Import location table (observations)
  await importObservations(sqliteDb, importId, stats);

  // 3. Enrich observations from network table
  await enrichObservationsFromNetworkTable(importId);

  // 4. Import routes
  await importRoutes(sqliteDb, importId, stats);
}
```

## Storage Considerations

**Size estimate:**

- 129,633 networks × ~200 bytes = ~25 MB
- Minimal storage cost for valuable backup data

## Benefits

✅ **Complete backup** - Original WiGLE data preserved
✅ **Enrichment source** - Fill missing fields in observations
✅ **Validation** - Compare computed vs original
✅ **Passpoint data** - rcois field preserved
✅ **Service info** - venue/operator data preserved
✅ **Historical reference** - Original best/last locations
✅ **No data loss** - Everything from WiGLE preserved
