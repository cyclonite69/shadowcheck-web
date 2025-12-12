# Radio-Specific Table Architecture Decision

## Current Situation

### ShadowCheckMobile (Separate Tables)

```
wifi_networks       - WiFi observations
bluetooth_devices   - Bluetooth Classic
ble_devices        - BLE observations
cellular_towers    - Cellular observations
```

### WiGLE (Single Table)

```
network (type: W/B/C) - All radio types together
```

### Our Current Design

```
app.observations - Single table (WiFi only so far)
```

## Options Analysis

### Option A: Separate Tables (Mobile Way)

```sql
app.wifi_observations
app.bluetooth_observations
app.ble_observations
app.cellular_observations
```

**Pros:**
✅ Type-safe - Each table has exact fields needed
✅ No NULL columns - WiFi doesn't have BT fields
✅ Easier queries - No filtering by type
✅ Better indexes - Optimized per radio type
✅ Matches mobile architecture
✅ Clear separation of concerns

**Cons:**
❌ More tables to maintain
❌ Harder to query across all radios
❌ Duplicate common fields (lat/lon/signal/timestamp)
❌ More complex import logic

### Option B: Single Table (WiGLE Way)

```sql
app.observations (radio_type: wifi/bluetooth/ble/cellular)
```

**Pros:**
✅ Single source of truth
✅ Easy cross-radio queries
✅ Simpler import logic
✅ Unified partitioning strategy
✅ Common fields not duplicated

**Cons:**
❌ Many NULL columns (WiFi rows have NULL BT fields)
❌ Less type-safe
❌ Larger row size
❌ More complex queries (always filter by type)

### Option C: Hybrid (Recommended)

```sql
-- Base table (partitioned)
app.observations (radio_type enum)
  - Common fields: location, signal, timestamp, source
  - Type-specific in JSONB metadata

-- Type-specific views
app.wifi_observations (view)
app.bluetooth_observations (view)
app.ble_observations (view)
app.cellular_observations (view)
```

**Pros:**
✅ Single storage (observations)
✅ Type-specific views for convenience
✅ No NULL columns (metadata JSONB)
✅ Flexible - add new radio types easily
✅ Best of both worlds

**Cons:**
⚠️ JSONB queries slightly slower than native columns
⚠️ Need to maintain views

## Recommended: Option C (Hybrid)

### Core Schema

```sql
CREATE TYPE radio_type AS ENUM (
    'wifi',
    'bluetooth_classic',
    'bluetooth_le',
    'cellular_gsm',
    'cellular_lte',
    'cellular_5g',
    'zigbee',
    'zwave',
    'lora'
);

CREATE TABLE app.observations (
    id BIGSERIAL,

    -- Radio Type
    radio_type radio_type NOT NULL,

    -- Universal Identifier (MAC, BSSID, Cell ID, etc.)
    identifier TEXT NOT NULL, -- Flexible for all types

    -- Common Fields (all radio types)
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude_meters DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy_meters DOUBLE PRECISION,

    signal_dbm DOUBLE PRECISION,
    observed_at TIMESTAMPTZ NOT NULL,

    -- Source tracking
    source_type source_type NOT NULL,
    device_uuid UUID,
    session_uuid UUID,

    -- Type-specific fields (JSONB)
    radio_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- General metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Indexes
CREATE INDEX idx_observations_radio_type ON app.observations(radio_type);
CREATE INDEX idx_observations_identifier ON app.observations(identifier);
CREATE INDEX idx_observations_radio_identifier ON app.observations(radio_type, identifier);
CREATE INDEX idx_observations_location ON app.observations USING gist(location);
CREATE INDEX idx_observations_time ON app.observations USING brin(observed_at);
CREATE INDEX idx_observations_radio_metadata ON app.observations USING gin(radio_metadata);
```

### Type-Specific Views

#### WiFi View

```sql
CREATE VIEW app.wifi_observations AS
SELECT
    id,
    identifier::macaddr as bssid,
    radio_metadata->>'ssid' as ssid,
    (radio_metadata->>'frequency_mhz')::double precision as frequency_mhz,
    (radio_metadata->>'channel')::integer as channel,
    radio_metadata->>'capabilities' as capabilities,
    radio_metadata->'encryption' as encryption,
    (radio_metadata->>'channel_width')::integer as channel_width,
    radio_metadata->>'band' as band,
    (radio_metadata->'wps_enabled')::boolean as wps_enabled,
    radio_metadata->>'vendor_oui' as vendor_oui,
    radio_metadata->>'manufacturer' as manufacturer,
    latitude,
    longitude,
    altitude_meters,
    location,
    accuracy_meters,
    signal_dbm,
    observed_at,
    source_type,
    device_uuid,
    session_uuid,
    metadata
FROM app.observations
WHERE radio_type = 'wifi';
```

#### Bluetooth Classic View

```sql
CREATE VIEW app.bluetooth_observations AS
SELECT
    id,
    identifier::macaddr as address,
    radio_metadata->>'name' as name,
    (radio_metadata->>'device_class')::integer as device_class,
    (radio_metadata->>'bond_state')::integer as bond_state,
    radio_metadata->>'device_type' as device_type,
    latitude,
    longitude,
    location,
    signal_dbm as rssi,
    observed_at,
    source_type,
    device_uuid,
    session_uuid
FROM app.observations
WHERE radio_type = 'bluetooth_classic';
```

#### BLE View

```sql
CREATE VIEW app.ble_observations AS
SELECT
    id,
    identifier::macaddr as address,
    radio_metadata->>'name' as name,
    (radio_metadata->>'tx_power')::integer as tx_power,
    (radio_metadata->'is_connectable')::boolean as is_connectable,
    radio_metadata->>'service_uuids' as service_uuids,
    radio_metadata->>'manufacturer_data' as manufacturer_data,
    latitude,
    longitude,
    location,
    signal_dbm as rssi,
    observed_at,
    source_type,
    device_uuid,
    session_uuid
FROM app.observations
WHERE radio_type = 'bluetooth_le';
```

#### Cellular View

```sql
CREATE VIEW app.cellular_observations AS
SELECT
    id,
    identifier::integer as cell_id,
    (radio_metadata->>'lac')::integer as lac,
    (radio_metadata->>'mcc')::integer as mcc,
    (radio_metadata->>'mnc')::integer as mnc,
    (radio_metadata->>'psc')::integer as psc,
    radio_metadata->>'network_type' as network_type,
    radio_metadata->>'operator_name' as operator_name,
    latitude,
    longitude,
    location,
    signal_dbm as signal_strength,
    observed_at,
    source_type,
    device_uuid,
    session_uuid
FROM app.observations
WHERE radio_type = 'cellular_gsm';
```

### Import Examples

#### WiFi Import

```sql
INSERT INTO app.observations (
    radio_type, identifier,
    latitude, longitude, location,
    signal_dbm, observed_at,
    source_type, device_uuid,
    radio_metadata
) VALUES (
    'wifi', '00:11:22:33:44:55',
    43.0234, -83.6968, ST_SetSRID(ST_MakePoint(-83.6968, 43.0234), 4326)::geography,
    -65, NOW(),
    'mobile_android', 'device-uuid-here',
    jsonb_build_object(
        'ssid', 'MyNetwork',
        'frequency_mhz', 5560,
        'channel', 112,
        'capabilities', '[WPA2-PSK-CCMP]',
        'encryption', ARRAY['WPA2', 'PSK'],
        'channel_width', 80,
        'band', '5GHz',
        'vendor_oui', '00:11:22',
        'manufacturer', 'Cisco'
    )
);
```

#### BLE Import

```sql
INSERT INTO app.observations (
    radio_type, identifier,
    latitude, longitude, location,
    signal_dbm, observed_at,
    source_type, device_uuid,
    radio_metadata
) VALUES (
    'bluetooth_le', 'AA:BB:CC:DD:EE:FF',
    43.0234, -83.6968, ST_SetSRID(ST_MakePoint(-83.6968, 43.0234), 4326)::geography,
    -75, NOW(),
    'mobile_android', 'device-uuid-here',
    jsonb_build_object(
        'name', 'Fitness Tracker',
        'tx_power', 4,
        'is_connectable', true,
        'service_uuids', '180D,180F',
        'manufacturer_data', '4C00...'
    )
);
```

### Computed Networks by Radio Type

```sql
CREATE VIEW app.wifi_networks AS
SELECT
    identifier::macaddr as bssid,
    -- Aggregated fields from wifi_observations
    ...
FROM app.observations
WHERE radio_type = 'wifi'
GROUP BY identifier;

CREATE VIEW app.bluetooth_devices AS
SELECT
    identifier::macaddr as address,
    -- Aggregated fields from bluetooth_observations
    ...
FROM app.observations
WHERE radio_type IN ('bluetooth_classic', 'bluetooth_le')
GROUP BY identifier;

CREATE VIEW app.cellular_towers AS
SELECT
    identifier::integer as cell_id,
    -- Aggregated fields from cellular_observations
    ...
FROM app.observations
WHERE radio_type LIKE 'cellular_%'
GROUP BY identifier;
```

## Benefits of Hybrid Approach

✅ **Single storage** - One partitioned table
✅ **Type-safe views** - Convenient access per radio type
✅ **No NULL columns** - JSONB stores only relevant fields
✅ **Flexible** - Easy to add new radio types
✅ **Cross-radio queries** - Can query all radios together
✅ **Matches mobile** - Views match mobile table names
✅ **Performance** - Partitioned, indexed, materialized views available
✅ **Future-proof** - Zigbee, Z-Wave, LoRa, etc.

## Migration from Mobile

```sql
-- WiFi
INSERT INTO app.observations (radio_type, identifier, ...)
SELECT 'wifi', bssid, ... FROM mobile.wifi_networks;

-- Bluetooth
INSERT INTO app.observations (radio_type, identifier, ...)
SELECT 'bluetooth_classic', address, ... FROM mobile.bluetooth_devices;

-- BLE
INSERT INTO app.observations (radio_type, identifier, ...)
SELECT 'bluetooth_le', address, ... FROM mobile.ble_devices;

-- Cellular
INSERT INTO app.observations (radio_type, identifier, ...)
SELECT 'cellular_gsm', cellId::text, ... FROM mobile.cellular_towers;
```

## Recommendation

**Go with Option C (Hybrid)** because:

1. Matches mobile architecture through views
2. Single source of truth (observations table)
3. No wasted space (JSONB for type-specific fields)
4. Future-proof for new radio types
5. Best performance with partitioning + indexes
6. Flexible queries (per-type or cross-radio)

**Decision needed:** Approve Option C?
