# Database Import Validation

## Overview

Enhanced WiGLE database import with strict validation and Unix epoch timestamp storage.

## Changes Made

### 1. Timestamp Storage

- **Before**: Converted Unix epoch milliseconds to PostgreSQL TIMESTAMP
- **After**: Store original Unix epoch milliseconds as BIGINT
- **Rationale**: Preserves original precision, avoids timezone issues, matches source format

### 2. BSSID Normalization

- All BSSIDs converted to UPPERCASE
- Format validation: `^[0-9A-F]{2}(:[0-9A-F]{2}){5}$`
- Invalid BSSIDs logged and skipped

### 3. Coordinate Validation

- Latitude: -90 to 90
- Longitude: -180 to 180
- Invalid coordinates logged and skipped
- Database constraints enforce valid ranges

### 4. Timestamp Validation

- Must be positive integer
- Must be less than current time + 24 hours (prevents future dates)
- Invalid timestamps logged and skipped

## Database Schema

### import.wigle_networks_raw

```sql
CREATE TABLE import.wigle_networks_raw (
    bssid TEXT PRIMARY KEY,
    last_time BIGINT NOT NULL,  -- Unix epoch milliseconds
    last_latitude NUMERIC(10, 7),
    last_longitude NUMERIC(10, 7),
    CONSTRAINT valid_bssid CHECK (bssid ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
    CONSTRAINT valid_last_coords CHECK (
        last_latitude BETWEEN -90 AND 90 AND
        last_longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT valid_timestamp CHECK (last_time > 0)
);
```

### app.observations

```sql
ALTER TABLE app.observations
    ADD COLUMN observed_at_epoch BIGINT,  -- Unix epoch milliseconds
    ADD CONSTRAINT valid_coords CHECK (
        latitude BETWEEN -90 AND 90 AND
        longitude BETWEEN -180 AND 180
    );
```

## Import Process

### Validation Steps

1. **BSSID**: Uppercase and format check
2. **Coordinates**: Range validation
3. **Timestamp**: Positive integer, reasonable date range
4. **Skip**: Invalid records logged in errors array

### Error Tracking

```javascript
stats.errors.push({
  table: 'network',
  bssid: 'AA:BB:CC:DD:EE:FF',
  error: 'Invalid coordinates',
});
```

## Usage

### Run Migration

```bash
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/01_create_import_schema.sql
```

### Run Import

```bash
node scripts/import/import-wigle-v2.js /path/to/wigle.sqlite
```

### Check Errors

```sql
SELECT errors FROM app.imports WHERE id = <import_id>;
```

## Benefits

1. **Data Integrity**: Only valid data imported
2. **Debugging**: All validation errors logged
3. **Performance**: Constraints prevent invalid queries
4. **Compatibility**: Unix epoch works across all systems
5. **Precision**: No floating-point timestamp conversion issues

## Migration Notes

- Existing data: Run migration to add new columns
- New imports: Use updated import script
- Backward compatible: `observed_at` TIMESTAMP still available
- Query both: Use `observed_at_epoch` for precision, `observed_at` for display
