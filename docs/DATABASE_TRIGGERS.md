# Database Triggers Documentation

## Overview

Automated triggers maintain calculated fields in the `networks_legacy` table based on observations in `locations_legacy`.

## Active Triggers

### 1. `trigger_auto_calculate_channel`

**Table:** `networks_legacy`  
**Timing:** BEFORE INSERT OR UPDATE OF frequency  
**Purpose:** Automatically calculates WiFi channel from frequency

**Logic:**

- WiFi 2.4GHz (2412-2484 MHz) → Channels 1-14
- WiFi 5GHz (5170-5825 MHz) → Channels 36-165
- Bluetooth/BLE → NULL (different channel scheme)

**Created:** 2025-11-23

---

### 2. `trigger_update_network_from_location`

**Table:** `locations_legacy`  
**Timing:** AFTER INSERT  
**Purpose:** Updates parent network aggregates when new observation is added

**Updates:**

- `lasttime` - Most recent observation timestamp (milliseconds)
- `last_seen` - Most recent observation (datetime)
- `first_seen` - Earliest observation (datetime, set once)
- `observation_count_staging` - Total observation count
- `signal_min` - Minimum signal level (dBm)
- `signal_max` - Maximum signal level (dBm)
- `signal_avg` - Average signal level (dBm)
- `bestlevel` - Strongest signal level
- `bestlat/bestlon` - Location of strongest signal
- `last_update` - Timestamp of last modification

**Created:** 2025-11-23

---

### 3. `trigger_update_network_timestamp`

**Table:** `networks_legacy`  
**Timing:** BEFORE UPDATE  
**Purpose:** Maintains audit trail of network modifications

**Updates:**

- `last_update` - Set to NOW() on any update

**Created:** 2025-11-23

---

## Calculated Fields (No Triggers - Computed Dynamically)

### Security Field

**Computed in:** SQL SELECT queries  
**Logic:**

- Type 'B' or 'E' → 'N/A' (Bluetooth/BLE)
- WiFi → Parse from capabilities (WPA3-E, WPA2-P, WPA, WEP, OPEN, etc.)

**Reason:** Derived data, always accurate, no storage overhead

---

## Performance Considerations

### Bulk Inserts

If importing large datasets, you may want to temporarily disable triggers:

```sql
-- Disable triggers
ALTER TABLE app.locations_legacy DISABLE TRIGGER trigger_update_network_from_location;

-- Perform bulk insert
-- ... your import here ...

-- Re-enable triggers
ALTER TABLE app.locations_legacy ENABLE TRIGGER trigger_update_network_from_location;

-- Backfill aggregates
UPDATE app.networks_legacy n
SET ... (see create_network_aggregation_triggers.sql)
```

### Index Optimization

Ensure these indexes exist for trigger performance:

- `idx_locations_staging_bssid` on `locations_legacy(bssid)`
- `idx_deduped_networks_bssid` on `networks_legacy(bssid)`

---

## Maintenance

### Verify Trigger Status

```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'app'
ORDER BY event_object_table, trigger_name;
```

### Check Data Integrity

```sql
-- Verify observation counts match
SELECT
  n.bssid,
  n.observation_count_staging as network_count,
  COUNT(l.unified_id) as actual_count
FROM app.networks_legacy n
LEFT JOIN app.locations_legacy l ON n.bssid = l.bssid
GROUP BY n.bssid, n.observation_count_staging
HAVING n.observation_count_staging != COUNT(l.unified_id)
LIMIT 10;
```

### Rebuild Aggregates (if needed)

```sql
-- Run the backfill section from create_network_aggregation_triggers.sql
```

---

## Migration History

| Date       | Script                                    | Description                           |
| ---------- | ----------------------------------------- | ------------------------------------- |
| 2025-11-23 | `fix_channels_from_frequency.sql`         | Created channel calculation trigger   |
| 2025-11-23 | `create_network_aggregation_triggers.sql` | Created location aggregation triggers |

---

## Future Enhancements

Potential triggers to consider:

- Signal standard deviation calculation
- Geospatial clustering updates
- Threat score recalculation on tag changes
- Automatic network type detection from frequency
