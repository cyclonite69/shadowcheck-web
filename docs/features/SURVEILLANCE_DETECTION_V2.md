# Enhanced Surveillance Detection Algorithm V2

## Overview

This algorithm identifies potential surveillance devices based on movement patterns, temporal persistence, and proximity to home location.

## Detection Rules

### Rule 1: Home + Away Pattern (50 points)

**Trigger**: Device seen within 100m of home AND at a separate location

```sql
CASE WHEN seen_at_home AND seen_away_from_home THEN 50 ELSE 0 END
```

**Rationale**: A device that appears both at your home and follows you elsewhere is highly suspicious.

### Rule 2: Multiple Distinct Locations (up to 40 points)

**Trigger**: Device appears at multiple unique locations

```sql
CASE WHEN unique_locations >= 5 THEN 40
     WHEN unique_locations >= 4 THEN 30
     WHEN unique_locations >= 3 THEN 20
     ELSE 0 END
```

**Rationale**: More locations = more evidence of following/tracking behavior.

### Rule 3: Distance Range (up to 30 points)

**Trigger**: Large distance between min/max observations

```sql
CASE WHEN distance_range > 5.0 km THEN 30
     WHEN distance_range > 2.0 km THEN 20
     WHEN distance_range > 0.5 km THEN 10
     ELSE 0 END
```

**Rationale**: Devices that move significant distances are mobile (vehicles, phones).

### Rule 4: Temporal Persistence (up to 30 points)

**Trigger**: Device observed across multiple days

```sql
CASE WHEN unique_days >= 7 THEN 30
     WHEN unique_days >= 3 THEN 20
     WHEN unique_days >= 2 THEN 10
     ELSE 0 END
```

**Rationale**: Repeated observations over days = persistent surveillance pattern.

### Rule 5: Observation Frequency (up to 20 points)

**Trigger**: High number of observations

```sql
CASE WHEN observation_count >= 50 THEN 20
     WHEN observation_count >= 20 THEN 10
     WHEN observation_count >= 10 THEN 5
     ELSE 0 END
```

**Rationale**: More observations = more opportunities to detect pattern.

## Penalties (False Positive Reduction)

### Penalty 1: Strong WiFi Signal (-25 points)

```sql
CASE WHEN type = 'W' AND max_signal > -50 THEN -25 ELSE 0 END
```

**Rationale**: Very strong WiFi signals indicate stationary access points, not mobile surveillance.

### Penalty 2: Single Location (-30 points)

```sql
CASE WHEN unique_locations = 1 THEN -30 ELSE 0 END
```

**Rationale**: Device only seen in one place is not following you.

## Scoring Examples

### Example 1: High Threat (Score: 90)

```
Device: T-Mobile USA (Cell Tower)
- Seen at home: YES (+50)
- Seen away: YES
- Unique locations: 12 (+40)
- Distance range: 0.69 km (+10)
- Unique days: 9 (+30)
- Observations: 52 (+20)
- Penalties: 0
Total: 150 (capped at 100)
```

### Example 2: Medium Threat (Score: 60)

```
Device: Unknown WiFi
- Seen at home: YES (+50)
- Seen away: YES
- Unique locations: 3 (+20)
- Distance range: 1.2 km (+20)
- Unique days: 2 (+10)
- Observations: 15 (+10)
- Penalties: -50 (strong signal + single location)
Total: 60
```

### Example 3: Low Threat (Score: 30)

```
Device: Neighbor's WiFi
- Seen at home: NO (0)
- Unique locations: 2 (+0)
- Distance range: 0.1 km (+0)
- Unique days: 5 (+20)
- Observations: 100 (+20)
- Penalties: -25 (strong signal)
Total: 15 (below threshold)
```

## Threat Levels

- **Critical (80-100)**: Almost certain surveillance
  - Home + Away + Multiple locations + Multiple days
- **High (70-79)**: Strong surveillance indicators
  - Home + Away + Good distance range + Multiple observations
- **Medium (50-69)**: Suspicious pattern
  - Home + Away OR Multiple locations with movement
- **Low (30-49)**: Possible surveillance
  - Some movement detected, needs investigation

## Minimum Threshold

**Default: 30 points**

- Lowered from 40 to catch more candidates
- Users can adjust via severity filter

## Co-Traveling Detection (Future Enhancement)

### Rule 6: Convoy Pattern (CRITICAL)

**Not yet implemented - requires correlation analysis**

```sql
-- Find devices that appear together at multiple locations
WITH device_pairs AS (
  SELECT
    a.bssid as device_a,
    b.bssid as device_b,
    COUNT(DISTINCT a.location_id) as shared_locations
  FROM observations a
  JOIN observations b ON a.location_id = b.location_id
  WHERE a.bssid != b.bssid
  GROUP BY a.bssid, b.bssid
  HAVING COUNT(DISTINCT a.location_id) >= 2
)
SELECT * FROM device_pairs
WHERE shared_locations >= 2;
```

**Score**: +50 points for convoy detection

## Implementation

### Backend

**File**: `server/server.js` Line ~570-610

The algorithm is implemented in the `/api/threats/quick` endpoint as a SQL CASE statement.

### Database Requirements

- `app.observations` table with lat/lon
- `app.location_markers` table with home location
- PostGIS extension for distance calculations

### API Usage

```bash
# Get all threats (threshold 30+)
GET /api/threats/quick?page=1&limit=100&exclude_tagged=true

# Get only high threats (threshold 70+)
GET /api/threats/quick?page=1&limit=100&minSeverity=70&exclude_tagged=true
```

## Testing

### Test Case 1: Mobile Phone

```
Expected: High threat (70-90)
Pattern: Seen at home, multiple locations, multiple days
```

### Test Case 2: Neighbor's WiFi

```
Expected: Low/No threat (<30)
Pattern: Strong signal, single location, stationary
```

### Test Case 3: Tracking Device

```
Expected: Critical threat (90-100)
Pattern: Home + Away, 5+ locations, 7+ days, 50+ observations
```

## Tuning Parameters

Adjust these values in `server/server.js` to fine-tune detection:

```javascript
// Increase sensitivity (more threats)
const minThreshold = 20; // Lower threshold

// Decrease sensitivity (fewer false positives)
const minThreshold = 50; // Higher threshold

// Adjust home radius
WHERE ST_Distance(...) < 100 // Change from 100m to 50m or 200m
```

## Future Enhancements

1. **Convoy Detection**: Identify 2+ devices traveling together
2. **Temporal Clustering**: Group observations by trip/timeframe
3. **Speed Analysis**: Calculate travel speed between observations
4. **Pattern Recognition**: ML model to identify surveillance patterns
5. **Geofencing**: Alert when device crosses specific boundaries

## Status

✅ **DEPLOYED** - Enhanced algorithm active
✅ **TESTED** - Returning more surveillance candidates
✅ **THRESHOLD** - Lowered to 30 points for broader detection

**Refresh surveillance page to see enhanced threat detection!**
