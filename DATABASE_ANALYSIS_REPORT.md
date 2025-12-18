# ShadowCheck Database Structure Analysis

## Executive Summary

The current `/api/kepler/observations` endpoint is **hardcoding placeholder values** for most network metadata. We need to create a materialized view that properly aggregates data from `observations` and `access_points` tables.

---

## Current Database Structure

### Tables

1. **`observations`** (161 MB) - Raw observation data
2. **`access_points`** (29 MB) - Access point metadata
3. **`device_sources`** (48 kB) - Device source info
4. **`ssid_history`** (16 MB) - SSID changes over time

### Materialized Views

1. **`mv_network_latest`** (40 MB) - Latest observation per BSSID
2. **`mv_network_timeline`** (44 MB) - Hourly aggregations per BSSID
3. **`mv_heatmap_tiles`** (3 MB) - Spatial heat map tiles
4. **`mv_device_routes`** (3 MB) - Device movement paths

---

## Problem: Current Kepler Endpoint Query

**File:** `server.js:266-311`

```sql
SELECT bssid, ssid, level, lat, lon, altitude, accuracy,
       observed_at, device_id, source_tag,
       ST_AsGeoJSON(geom)::json as geometry
FROM public.observations
WHERE geom IS NOT NULL
ORDER BY observed_at DESC
```

### Hardcoded Values Being Returned:

- ❌ `manufacturer: 'Unknown'`
- ❌ `device_type: 'Unknown'`
- ❌ `encryption: 'Unknown'`
- ❌ `channel: 'Unknown'`
- ❌ `frequency: 'Unknown'`
- ❌ `type: 'W'` (assumes all WiFi)
- ❌ `capabilities: 'Unknown'`
- ❌ `first_seen: row.observed_at` (using observation time, not first seen)
- ❌ `last_seen: row.observed_at` (same as first_seen)

### What We Actually Have Available:

#### From `observations` table:

✅ `bssid`
✅ `ssid`
✅ `level` (signal strength)
✅ `lat`, `lon`, `altitude`, `accuracy`
✅ `observed_at` (timestamp)
✅ `device_id`
✅ `source_tag`
✅ `geom` (PostGIS geometry)

#### From `access_points` table:

✅ `first_seen` - **ACTUAL first observation timestamp**
✅ `last_seen` - **ACTUAL last observation timestamp**
✅ `total_observations` - **COUNT of observations**
✅ `latest_ssid` - Most recent SSID
✅ `ssid_variants` - All SSIDs seen for this BSSID
✅ `is_5ghz`, `is_6ghz` - Frequency band detection
✅ `is_hidden` - Hidden network flag
✅ `vendor` - MAC vendor lookup
✅ `enriched_json` - **JSONB with WiGLE/external data**

#### From `mv_network_latest`:

✅ Latest observation per BSSID with all observation fields

#### From `mv_network_timeline`:

✅ Hourly statistics (obs_count, avg_level, min_level, max_level)

---

## What We're Missing (Not in Database)

### Radio Type Detection

**Problem:** No column explicitly stores radio type (W/E/B/L/N/G)

**Possible Solutions:**

1. Derive from frequency bands (`is_5ghz`, `is_6ghz` → WiFi)
2. Parse from `enriched_json` if WiGLE data exists
3. Add a computed column to `access_points`

### Channel & Frequency

**Problem:** Not stored in either table

**Possible Sources:**

1. `enriched_json` from WiGLE enrichment
2. Could be derived from signal characteristics
3. May need to add columns to `access_points`

### Security/Encryption/Capabilities

**Problem:** Not stored

**Possible Sources:**

1. `enriched_json` if WiGLE data exists
2. May need to capture from WigleAndroid exports

### Manufacturer/Device Type

**Problem:** Only `vendor` column exists (MAC vendor)

**Current:**

- `vendor` in `access_points` (from MAC lookup)
- `enriched_json` may have WiGLE manufacturer data

---

## Recommended Solution: New Materialized View

### Proposed: `mv_kepler_observations`

```sql
CREATE MATERIALIZED VIEW public.mv_kepler_observations AS
SELECT
    o.id,
    o.bssid,
    o.ssid,
    o.level,
    o.lat,
    o.lon,
    o.altitude,
    o.accuracy,
    o.observed_at,
    o.device_id,
    o.source_tag,
    o.geom,

    -- From access_points
    ap.first_seen,
    ap.last_seen,
    ap.total_observations,
    ap.latest_ssid,
    ap.is_5ghz,
    ap.is_6ghz,
    ap.is_hidden,
    ap.vendor as manufacturer,

    -- Derived radio type
    CASE
        WHEN ap.is_5ghz OR ap.is_6ghz THEN 'W'  -- WiFi
        -- Could add more logic here for BLE/Bluetooth/Cellular detection
        ELSE 'W'  -- Default to WiFi for now
    END as radio_type,

    -- Extract from enriched_json if available
    ap.enriched_json->>'encryption' as encryption,
    ap.enriched_json->>'channel' as channel,
    ap.enriched_json->>'frequency' as frequency,
    ap.enriched_json->>'capabilities' as capabilities,
    ap.enriched_json->>'type' as wigle_type,

    -- Time span calculation
    EXTRACT(EPOCH FROM (ap.last_seen - ap.first_seen)) as observation_span_seconds

FROM public.observations o
INNER JOIN public.access_points ap ON o.bssid = ap.bssid
WHERE o.geom IS NOT NULL
ORDER BY o.observed_at DESC;

CREATE INDEX idx_mv_kepler_observations_bssid ON mv_kepler_observations(bssid);
CREATE INDEX idx_mv_kepler_observations_geom ON mv_kepler_observations USING GIST(geom);
CREATE INDEX idx_mv_kepler_observations_observed_at ON mv_kepler_observations(observed_at DESC);
```

---

## Action Items

### 1. Investigate `enriched_json` Content

```sql
SELECT
    bssid,
    enriched_json
FROM access_points
WHERE enriched_json != '{}'::jsonb
LIMIT 10;
```

**Need to know:** What keys exist in `enriched_json`? Does it have:

- `channel`
- `frequency`
- `encryption`
- `capabilities`
- `type` (radio type)

### 2. Check WiGLE Import Data

- Review WiGLE CSV/SQLite import scripts
- Determine what fields are captured during import
- See if we're losing data during import that we need

### 3. Create Enhanced Materialized View

- Build `mv_kepler_observations` with all available data
- Test query performance
- Add proper indexes

### 4. Update Kepler Endpoint

- Replace hardcoded values with actual data from MV
- Add fallbacks for missing data
- Return `null` instead of `'Unknown'` for cleaner frontend handling

### 5. Frontend Tooltip Logic

- Handle `null` values gracefully
- Show/hide sections based on data availability
- Use actual radio type for icon selection
- Display observation span prominently

---

## Sample Query to Test Data Availability

```sql
SELECT
    COUNT(*) as total_aps,
    COUNT(DISTINCT CASE WHEN is_5ghz THEN bssid END) as wifi_5ghz,
    COUNT(DISTINCT CASE WHEN is_6ghz THEN bssid END) as wifi_6ghz,
    COUNT(DISTINCT CASE WHEN enriched_json != '{}' THEN bssid END) as has_enrichment,
    COUNT(DISTINCT CASE WHEN enriched_json->>'channel' IS NOT NULL THEN bssid END) as has_channel,
    COUNT(DISTINCT CASE WHEN enriched_json->>'encryption' IS NOT NULL THEN bssid END) as has_encryption,
    COUNT(DISTINCT CASE WHEN vendor IS NOT NULL THEN bssid END) as has_vendor
FROM access_points;
```

---

## Next Steps

**DECISION NEEDED:**

1. Should we create `mv_kepler_observations` materialized view?
2. Do we need to enhance WiGLE import to capture more fields?
3. Should we add explicit columns to `access_points` for commonly needed data?
4. How often should materialized views refresh?
