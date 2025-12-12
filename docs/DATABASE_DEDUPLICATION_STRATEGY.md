# Deduplication Strategy - Prevent Double Imports

## Problem

- WiGLE data already imported into ShadowCheckMobile
- Don't want to import same observations twice
- Need to track what's been imported from where
- Only import NEW data from Mobile

## Solution: Source Fingerprinting

### 1. Unique Observation Fingerprint

```sql
-- Add fingerprint column to observations
ALTER TABLE app.observations
    ADD COLUMN fingerprint TEXT GENERATED ALWAYS AS (
        md5(
            radio_type::text ||
            identifier ||
            observed_at::text ||
            COALESCE(latitude::text, '') ||
            COALESCE(longitude::text, '')
        )
    ) STORED;

CREATE UNIQUE INDEX idx_observations_fingerprint ON app.observations(fingerprint);
```

### 2. Import Tracking Table

```sql
CREATE TABLE app.import_sources (
    id SERIAL PRIMARY KEY,

    -- Source identification
    source_repo TEXT NOT NULL, -- 'wigle_app', 'mobile_android', 'pentest'
    source_db_path TEXT, -- Path to source database
    source_db_hash TEXT, -- SHA256 of source database file

    -- What was imported
    import_type TEXT NOT NULL, -- 'full', 'incremental', 'new_only'

    -- Fingerprint range (for dedup)
    fingerprints_imported TEXT[], -- Array of fingerprints
    observation_count INTEGER,

    -- Time range
    data_from TIMESTAMPTZ,
    data_to TIMESTAMPTZ,

    -- Import metadata
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by TEXT,
    notes TEXT,

    metadata JSONB
);

CREATE INDEX idx_import_sources_repo ON app.import_sources(source_repo);
CREATE INDEX idx_import_sources_hash ON app.import_sources(source_db_hash);
```

### 3. Check Before Import Function

```sql
CREATE OR REPLACE FUNCTION app.observation_exists(
    p_radio_type radio_type,
    p_identifier TEXT,
    p_observed_at TIMESTAMPTZ,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS BOOLEAN AS $$
DECLARE
    v_fingerprint TEXT;
BEGIN
    v_fingerprint := md5(
        p_radio_type::text ||
        p_identifier ||
        p_observed_at::text ||
        COALESCE(p_latitude::text, '') ||
        COALESCE(p_longitude::text, '')
    );

    RETURN EXISTS (
        SELECT 1 FROM app.observations
        WHERE fingerprint = v_fingerprint
    );
END;
$$ LANGUAGE plpgsql;
```

### 4. Import with Deduplication

```javascript
// Import from Mobile - Skip if already exists
async function importFromMobile(mobileDb, importId) {
  const result = await mobileDb.query(
    `
        SELECT * FROM wifi_networks 
        WHERE timestamp > $1
        ORDER BY timestamp
    `,
    [lastImportTimestamp]
  );

  let imported = 0;
  let skipped = 0;

  for (const row of result.rows) {
    // Check if already exists
    const exists = await pgPool.query(
      `
            SELECT app.observation_exists($1, $2, $3, $4, $5)
        `,
      ['wifi', row.bssid, new Date(row.timestamp), row.latitude, row.longitude]
    );

    if (exists.rows[0].observation_exists) {
      skipped++;
      continue;
    }

    // Import new observation
    await pgPool.query(
      `
            INSERT INTO app.observations (
                radio_type, identifier, 
                latitude, longitude, location,
                signal_dbm, observed_at,
                source_type, device_uuid, session_uuid,
                radio_metadata, metadata
            ) VALUES (
                'wifi', $1, $2, $3, 
                ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
                $4, $5, 'mobile_android', $6, $7, $8, $9
            )
        `,
      [
        row.bssid,
        row.latitude,
        row.longitude,
        row.signalLevel,
        new Date(row.timestamp),
        deviceUuid,
        sessionUuid,
        buildRadioMetadata(row),
        buildGeneralMetadata(row),
      ]
    );

    imported++;
  }

  console.log(`✓ Imported: ${imported}, Skipped (duplicates): ${skipped}`);
}
```

## Import Strategies

### Strategy 1: Timestamp-Based (Recommended)

Only import observations newer than last import:

```sql
-- Get last import timestamp from Mobile
SELECT MAX(observed_at)
FROM app.observations
WHERE source_type = 'mobile_android';

-- Import only newer data
SELECT * FROM mobile.wifi_networks
WHERE timestamp > last_import_timestamp;
```

### Strategy 2: Source Tracking

Track which source databases have been imported:

```sql
-- Check if this Mobile DB was already imported
SELECT * FROM app.import_sources
WHERE source_db_hash = sha256(mobile_db_file);

-- If not found, import all
-- If found, import only new data since last import
```

### Strategy 3: Fingerprint Dedup (Safest)

Check each observation's fingerprint before import:

```sql
-- Generate fingerprint for each row
-- Check if exists in app.observations
-- Skip if exists, import if new
```

## Recommended Workflow

### Initial Setup (One-time)

```bash
# 1. Import WiGLE SQLite to PostgreSQL
node scripts/import/import-wigle-sqlite.js

# 2. Record this import
INSERT INTO app.import_sources (
    source_repo, source_db_path, source_db_hash,
    import_type, observation_count, imported_by
) VALUES (
    'wigle_app',
    '/path/to/wigle.sqlite',
    sha256('/path/to/wigle.sqlite'),
    'full',
    419969,
    'initial_setup'
);
```

### Ongoing Mobile Sync

```bash
# Only import NEW observations from Mobile
# (those created after WiGLE import)

# Get last sync timestamp
last_sync=$(psql -c "SELECT MAX(observed_at) FROM app.observations WHERE source_type = 'mobile_android'")

# Import only newer
node scripts/import/import-mobile-new.js --since "$last_sync"
```

## Decision: WiGLE Data in Mobile

### Option A: Skip WiGLE Data in Mobile

```sql
-- When syncing from Mobile, exclude WiGLE source
SELECT * FROM mobile.wifi_networks
WHERE source != 'wigle_import'
    AND timestamp > last_sync;
```

### Option B: Import All, Deduplicate

```sql
-- Import everything, fingerprint dedup handles it
-- Slower but safer
```

### Option C: Separate Mobile-Only Table

```sql
-- Mobile app tracks what it collected vs imported
-- Only sync mobile-collected data
SELECT * FROM mobile.wifi_networks
WHERE collected_by_app = true;
```

## Recommended Approach

**For now:**

1. ✅ Import WiGLE SQLite directly to PostgreSQL (done)
2. ✅ Add fingerprint column for deduplication
3. ✅ When syncing Mobile, use timestamp filter:
   ```sql
   WHERE timestamp > (SELECT MAX(observed_at) FROM app.observations WHERE source_type = 'mobile_android')
   ```
4. ✅ Track imports in `app.import_sources`

**This ensures:**

- No double imports
- Clear audit trail
- Only new Mobile data synced
- WiGLE data imported once

## Implementation

```sql
-- Add fingerprint to observations
ALTER TABLE app.observations
    ADD COLUMN fingerprint TEXT GENERATED ALWAYS AS (
        md5(
            radio_type::text ||
            identifier ||
            observed_at::text ||
            COALESCE(latitude::text, '') ||
            COALESCE(longitude::text, '')
        )
    ) STORED;

CREATE UNIQUE INDEX idx_observations_fingerprint ON app.observations(fingerprint);

-- Create import tracking
CREATE TABLE app.import_sources (
    id SERIAL PRIMARY KEY,
    source_repo TEXT NOT NULL,
    source_db_path TEXT,
    source_db_hash TEXT,
    import_type TEXT NOT NULL,
    observation_count INTEGER,
    data_from TIMESTAMPTZ,
    data_to TIMESTAMPTZ,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);
```

## Query to Check for Duplicates

```sql
-- Find potential duplicates before import
SELECT
    radio_type,
    identifier,
    observed_at,
    COUNT(*) as duplicate_count
FROM app.observations
GROUP BY radio_type, identifier, observed_at, latitude, longitude
HAVING COUNT(*) > 1;
```

**Decision needed:**

- Import WiGLE data that's already in Mobile? (Recommend: No, skip it)
- Use timestamp-based or fingerprint-based dedup? (Recommend: Timestamp for performance)
