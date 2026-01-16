# ShadowCheck Threat Analysis Context Report

**Generated**: 2026-01-16T02:40:00-05:00  
**Purpose**: Contextual discovery for specialized threat scoring implementation

---

## Executive Summary

**Data Scale**: 566,400+ observations across 173,326+ unique networks  
**Current Threat System**: Rule-based scoring in `api_network_explorer` view  
**Primary Threat Model**: Personal surveillance/stalking detection  
**Geographic Scope**: Primarily Michigan area (home: 43.02°N, -83.70°W)

---

## Phase 1: Data Structure Discovery

### 1.1 Observation Table Schema (`public.observations`)

**Core Fields**:

```sql
bssid              TEXT          -- MAC address (primary identifier)
ssid               TEXT          -- Network name
lat                NUMERIC       -- Latitude (WGS84)
lon                NUMERIC       -- Longitude (WGS84)
level              INTEGER       -- RSSI in dBm (-100 to 0)
accuracy           NUMERIC       -- GPS accuracy in meters
time               TIMESTAMPTZ   -- Observation timestamp
radio_type         TEXT          -- W/E/B/L/N/G (WiFi/BLE/BT/LTE/5G/GSM)
radio_frequency    NUMERIC       -- Frequency in MHz
radio_capabilities TEXT          -- Encryption/capabilities string
geom               GEOMETRY      -- PostGIS point (SRID 4326)
altitude           NUMERIC       -- Elevation in meters
```

**Data Quality**:

- **Valid observations filter**: `time >= '2000-01-01'` (filters out invalid timestamps)
- **Invalid BSSIDs excluded**: `00:00:00:00:00:00`, `FF:FF:FF:FF:FF:FF`
- **GPS requirement**: Most queries filter `geom IS NOT NULL`
- **Coordinate precision**: Standard WGS84 (6-8 decimal places)

**Storage & Scale**:

- **Total observations**: 566,400+
- **Unique networks**: 173,326+
- **Average observations per network**: ~3.27
- **Date range**: Filtered to >= 2000-01-01 (excludes epoch 0 timestamps)
- **Geographic spread**: Primarily Michigan, USA

### 1.2 Network Relationships

**Primary Key**: `bssid` (MAC address, uppercase)  
**One-to-Many**: Each network (BSSID) has multiple observations  
**No SSID arrays**: Each observation has single SSID (may be null/hidden)

**Network Metadata** (from `api_network_explorer` view):

```sql
manufacturer          TEXT      -- OUI-based vendor lookup
device_type           TEXT      -- Classified device category
is_sentinel           BOOLEAN   -- Stationary network flag
distance_from_home_km NUMERIC   -- Distance from home marker
observations          INTEGER   -- Total observation count
first_seen            TIMESTAMP -- Earliest observation
last_seen             TIMESTAMP -- Latest observation
```

### 1.3 GPS/Location Data

**Coordinate Storage**:

- **Columns**: `lat`, `lon` (NUMERIC)
- **PostGIS**: `geom` (GEOMETRY POINT, SRID 4326)
- **Precision**: Standard GPS (typically 6-8 decimals)
- **Nullable**: Yes - filtered with `geom IS NOT NULL` in queries

**GPS Quality**:

- **Accuracy field**: Meters (from GPS sensor)
- **Validation**: Lat between -90/90, Lon between -180/180
- **Invalid coord handling**: `excludeInvalidCoords` filter available

**Geographic Spread**:

- **Home location**: 43.02345147°N, -83.69682688°W (Michigan)
- **Primary coverage**: Local area (likely 50km radius)
- **Bounding box**: Not explicitly defined (user-dependent)

### 1.4 Signal Strength (RSSI)

**Field**: `level` (INTEGER, dBm)  
**Range**: -100 to 0 dBm (typical WiFi)  
**Validation**: Noise floor at -95 dBm (enforced in filters)

**RSSI Distribution** (estimated from validation rules):

- **Strong signal**: -30 to -50 dBm (close proximity)
- **Medium signal**: -50 to -70 dBm (normal range)
- **Weak signal**: -70 to -95 dBm (far/obstructed)
- **Below noise floor**: < -95 dBm (filtered out)

**Usage**:

- **Proximity indicator**: Lower (more negative) = farther away
- **Not used for distance estimation**: Too variable (obstacles, power)
- **Filter support**: `rssiMin`/`rssiMax` filters available

### 1.5 Temporal Data

**Field**: `time` (TIMESTAMPTZ)  
**Granularity**: Second precision (PostgreSQL timestamp)  
**Timezone**: UTC (timestamptz)

**Temporal Patterns**:

- **Observation clustering**: Likely burst-based (wardriving sessions)
- **Typical gap**: Unknown (varies by collection method)
- **Seasonality**: Not analyzed (insufficient data)

**Temporal Queries**:

- **First seen**: `MIN(time)` per BSSID
- **Last seen**: `MAX(time)` per BSSID
- **Unique days**: `COUNT(DISTINCT DATE(time))`
- **Timeframe filter**: Relative (24h/7d/30d/90d) or absolute ranges

---

## Phase 2: Threat Pattern Discovery

### 2.1 Current Threat Scoring System

**Implementation**: Rule-based scoring in `api_network_explorer` view

**Threat Dimensions** (current):

| Dimension                | Weight | Threshold                           | Score Contribution |
| ------------------------ | ------ | ----------------------------------- | ------------------ |
| **Home & Away**          | 40%    | Seen <100m from home AND >500m away | 40 points          |
| **Excessive Movement**   | 25%    | Max distance > 200m                 | 25 points          |
| **Vehicle Speed**        | 20%    | Max speed > 100 km/h                | 20 points          |
| **High Speed**           | 15%    | Max speed > 50 km/h                 | 15 points          |
| **Moderate Speed**       | 10%    | Max speed > 20 km/h                 | 10 points          |
| **Persistent (7+ days)** | 15%    | Unique days >= 7                    | 15 points          |
| **Multi-day (3+ days)**  | 10%    | Unique days >= 3                    | 10 points          |
| **Multi-day (2+ days)**  | 5%     | Unique days >= 2                    | 5 points           |
| **High Obs Count**       | 10%    | Observations >= 50                  | 10 points          |
| **Moderate Obs Count**   | 5%     | Observations >= 20                  | 5 points           |

**Maximum Score**: 100 points  
**Threat Levels**:

- **NONE**: 0-24 points
- **LOW**: 25-49 points
- **MED**: 50-74 points
- **HIGH**: 75-100 points

### 2.2 Known Threat Patterns

**Primary Threat Model**: Personal surveillance/stalking

**Suspicious Indicators**:

1. **Follows user home**: Seen near home location (<100m)
2. **Follows user away**: Also seen far from home (>500m)
3. **Persistent presence**: Appears across multiple days
4. **High observation count**: Detected frequently (20+ times)
5. **Movement patterns**: Travels significant distances (>200m)
6. **Speed patterns**: Moves at vehicle speeds (>20 km/h)

**Threat Flags** (current system):

- `SEEN_AT_HOME_AND_AWAY` - Most critical indicator
- `EXCESSIVE_MOVEMENT` - Travels with user
- `VEHICLE_SPEED` / `HIGH_SPEED` / `MODERATE_SPEED` - Movement patterns
- `PERSISTENT_TRACKING` - Multi-day presence
- `MULTI_DAY_OBSERVATION` - Repeated sightings
- `HIGH_OBSERVATION_COUNT` - Frequent detections

### 2.3 False Positive Patterns

**Known False Positives**:

1. **Delivery Vehicles**
   - Pattern: Regular routes, high speed, multi-location
   - Distinguisher: Predictable timing, commercial SSID patterns
   - Example: "FedEx_Truck_123", "UPS_Mobile"

2. **Mobile Hotspots**
   - Pattern: Frequent location changes, vehicle speeds
   - Distinguisher: Smartphone manufacturer, personal SSID
   - Example: "iPhone", "Galaxy_Hotspot"

3. **Public Transit**
   - Pattern: Regular routes, predictable timing
   - Distinguisher: Transit-related SSIDs, fixed schedules
   - Example: "BusWiFi", "MetroConnect"

4. **Neighbors**
   - Pattern: Seen at home, occasional away (shopping, work)
   - Distinguisher: Stationary most of time, residential SSID
   - Example: "NETGEAR_Home", "Linksys_Router"

5. **Legitimate Smartphones**
   - Pattern: Probes many SSIDs, moves frequently
   - Distinguisher: Normal user behavior, not persistent
   - Example: Personal devices scanning for known networks

**Distinguishing Features**:

- **SSID patterns**: Commercial vs personal naming
- **Manufacturer**: Known device types (routers vs phones)
- **Temporal regularity**: Scheduled vs random
- **Stationary confidence**: Fixed location vs mobile
- **Observation density**: Continuous vs sporadic

### 2.4 Threat Model Specifics

**Primary Concern**: Personal stalking/surveillance

**Attack Profile**:

- **Solo threats**: Single device following target
- **Coordinated threats**: Multiple devices (less common)
- **Dwell time**: Days to weeks (persistent)
- **Behavior**: Passive (sniffing) + active (probing)

**Observable Signals**:

- ✅ Location correlation (home + away)
- ✅ Temporal persistence (multi-day)
- ✅ Movement patterns (follows user)
- ✅ Observation frequency (high count)
- ⚠️ SSID probing (not currently weighted)
- ⚠️ Signal strength trends (not analyzed)
- ❌ Time-of-day patterns (not analyzed)
- ❌ Device correlation (not implemented)

**Blind Spots**:

- **Passive sniffing**: Devices that don't broadcast
- **Intermittent tracking**: Devices turned on/off strategically
- **Distant surveillance**: Devices with directional antennas
- **Spoofed identities**: Rotating MAC addresses

---

## Phase 3: Threat Dimension Prioritization

### Signal Strength Analysis (for ShadowCheck threat model)

| Dimension                   | Ranking | Reason                                          | Current Threshold      | Data Availability                |
| --------------------------- | ------- | ----------------------------------------------- | ---------------------- | -------------------------------- |
| **Home & Away Correlation** | 5/5     | **CRITICAL** - Primary stalking indicator       | <100m home, >500m away | 100% (if home set)               |
| **Multi-Location Spread**   | 5/5     | **CRITICAL** - Follows user to multiple places  | >200m max distance     | 100% (geom required)             |
| **Temporal Persistence**    | 4/5     | **HIGH** - Sustained surveillance over days     | 2-7+ unique days       | 100% (time always present)       |
| **Observation Frequency**   | 4/5     | **HIGH** - Repeated detections indicate intent  | 20-50+ observations    | 100% (count always available)    |
| **Movement Speed**          | 3/5     | **MEDIUM** - Indicates vehicle-based tracking   | 20-100+ km/h           | 100% (calculated from geom+time) |
| **Off-Hours Activity**      | 3/5     | **MEDIUM** - Night appearances suspicious       | NOT IMPLEMENTED        | 100% (time available)            |
| **Quick Transitions**       | 3/5     | **MEDIUM** - Active pursuit indicator           | NOT IMPLEMENTED        | 100% (time+geom available)       |
| **Temporal Regularity**     | 2/5     | **LOW** - Scheduled patterns less threatening   | NOT IMPLEMENTED        | 100% (time available)            |
| **Device Correlation**      | 2/5     | **LOW** - Coordinated surveillance rare         | NOT IMPLEMENTED        | 100% (spatial+temporal join)     |
| **Probe Anomalies**         | 2/5     | **LOW** - SSID fishing less relevant            | NOT IMPLEMENTED        | ~50% (SSID may be hidden)        |
| **Signal Pattern Trends**   | 1/5     | **VERY LOW** - Too variable for reliable signal | NOT IMPLEMENTED        | 100% (level available)           |

### Recommended Dimension Weights (for ShadowCheck)

**Tier 1 - Critical Indicators** (60% total weight):

- **Home & Away**: 30% - Strongest stalking signal
- **Multi-Location**: 30% - Confirms following behavior

**Tier 2 - Strong Indicators** (30% total weight):

- **Temporal Persistence**: 15% - Sustained surveillance
- **Observation Frequency**: 15% - Repeated detections

**Tier 3 - Supporting Indicators** (10% total weight):

- **Movement Speed**: 5% - Vehicle-based tracking
- **Off-Hours Activity**: 3% - Suspicious timing
- **Quick Transitions**: 2% - Active pursuit

**Not Recommended** (0% weight):

- **Temporal Regularity**: Inverse indicator (scheduled = less threatening)
- **Device Correlation**: Insufficient data for reliable detection
- **Probe Anomalies**: Not relevant to stalking model
- **Signal Trends**: Too noisy for actionable intelligence

---

## Phase 4: Performance & Operational Constraints

### 4.1 Query Performance Baseline

**Current System**:

- **Threat calculation**: Materialized view (`api_network_explorer`)
- **Refresh method**: Manual or scheduled (not real-time)
- **Query latency**: Unknown (needs measurement)
- **Typical result set**: 500 networks per page (LIMIT 500)

**Filter Performance** (from testing):

- **Fastest filters**: Network-only (ssid, bssid, manufacturer)
- **Slowest filters**: Spatial (boundingBox, radiusFilter with PostGIS)
- **Acceptable latency**: <2s for filtered queries (estimated)

### 4.2 Compute Capacity

**Threat Score Calculation**:

- **Networks requiring scores**: All 173,326+ networks
- **Per-network complexity**: 5-10 CTEs (joins, aggregations, spatial calcs)
- **Real-time feasibility**: NO - too expensive for per-query
- **Caching strategy**: Materialized view (current approach)

**Batch Job Constraints**:

- **Low-traffic window**: 2-6 AM local time (estimated)
- **Max acceptable runtime**: 30 minutes (estimated)
- **Parallel processing**: PostgreSQL parallel query support available

### 4.3 Storage

**Current Storage**:

- **Threat scores**: Stored in `api_network_explorer` view (virtual)
- **Materialized view**: `api_network_explorer_mv` (physical cache)
- **Additional tables**: Can add `threat_analysis` table if needed
- **Index capacity**: PostGIS indexes already exist on `geom`

**Storage Estimates**:

- **Threat metadata per network**: ~500 bytes (JSON)
- **Total for 173K networks**: ~87 MB (negligible)
- **Index overhead**: ~50 MB (acceptable)

### 4.4 Data Refresh Cadence

**Current System**:

- **Materialized view refresh**: Manual or scheduled
- **Freshness requirement**: Daily (estimated)
- **New observations**: Batch imports (not streaming)
- **Stale tolerance**: 24 hours acceptable

**Recommended Cadence**:

- **Threat score refresh**: Daily at 3 AM
- **Incremental updates**: For new observations only
- **Full recalculation**: Weekly (Sundays)

---

## Phase 5: Integration & Output Expectations

### 5.1 UI Integration

**Current Implementation**:

- **Dashboard**: Threat score displayed as badge (NONE/LOW/MED/HIGH)
- **Network list**: Threat column with color coding
- **Filters**: `threatScoreMin`/`threatScoreMax` (0-100 range)
- **Details**: Threat flags shown in network details

**User Expectations**:

- **Threat reasons**: YES - `threat_flags` array displayed
- **Component breakdown**: YES - `signals` array with weights
- **Explanation**: JSON structure with evidence

**Example Threat Object**:

```json
{
  "score": 0.75,
  "level": "HIGH",
  "summary": "Device seen at home and away, persistent tracking",
  "flags": ["SEEN_AT_HOME_AND_AWAY", "PERSISTENT_TRACKING"],
  "signals": [
    {
      "code": "HOME_AND_AWAY",
      "weight": 0.4,
      "evidence": { "seen_at_home": true, "seen_away": true }
    },
    {
      "code": "PERSISTENT_TRACKING",
      "weight": 0.15,
      "evidence": { "unique_days": 8 }
    }
  ]
}
```

### 5.2 Alerting

**Current System**: No automated alerting

**Recommended**:

- **Critical threats**: Score >= 75 (HIGH level)
- **Notification method**: Browser notification + email
- **Deduplication**: Alert once per device per day
- **Alert on change**: YES - notify when score increases by 20+ points

### 5.3 Reporting

**Export Formats**:

- **JSON**: Full threat analysis with evidence
- **CSV**: Simplified (BSSID, score, level, flags)
- **PDF**: Not currently supported

**Use Cases**:

- **Personal records**: Track suspicious devices over time
- **Law enforcement**: Evidence package with timeline
- **Historical analysis**: Threat score trends

### 5.4 Investigation Workflow

**Analyst Queries** (supported):

1. "Show me all HIGH threats" → `threatScoreMin: 75`
2. "Show threats near home" → `distanceFromHomeMax: 0.5` + `threatScoreMin: 50`
3. "Show persistent devices" → Filter by `unique_days >= 7`
4. "Show this device's timeline" → `/api/networks/observations/:bssid`

**Analyst Queries** (NOT supported):

1. "Show temporal pattern for BSSID" → Needs time-series visualization
2. "Identify coordinated devices" → Needs correlation analysis
3. "Show threat score history" → Needs historical tracking table

---

## Phase 6: Success Metrics Definition

### 6.1 Detection Accuracy

**Labeled Data**: None currently available

**Recommended Test Set**:

- **Known threats**: 5-10 documented stalking cases
- **Known benign**: 20-30 trusted devices (home, work, family)
- **Uncertain**: 10-20 ambiguous cases

**Target Metrics**:

- **True Positive Rate (TPR)**: 85% (catch 85% of real threats)
- **False Positive Rate (FPR)**: <5% (false alarm rate)
- **Precision**: 80% (80% of flagged devices are actual threats)

**Current System Performance**: Unknown (needs validation)

### 6.2 Operational Metrics

**Target Performance**:

- **Threat score calc per device**: <250ms (batch mode)
- **Batch refresh for all networks**: <15 minutes
- **Query latency impact**: +50ms (with threat filters)
- **Alert volume**: <5 per day (acceptable false alarms)

**Current Performance**: Not measured

### 6.3 Usability Metrics

**User Engagement**:

- **% users enabling threat filters**: Unknown
- **Time to investigate critical threat**: Target <5 minutes
- **Threat reason clarity**: User feedback needed

**User Feedback Questions**:

- Do threat_reasons help understand the score?
- Are threat levels (NONE/LOW/MED/HIGH) intuitive?
- Is the evidence JSON too technical?

---

## Phase 7: Gaps & Unknowns

### 7.1 Data Gaps

**Missing GPS** (~0%):

- **Impact**: CRITICAL - spatial analysis impossible
- **Mitigation**: Filter `geom IS NOT NULL` (already done)
- **Prevalence**: Minimal (observations without GPS excluded)

**Missing RSSI** (~5% estimated):

- **Impact**: LOW - not critical for threat scoring
- **Mitigation**: Use NULL-safe aggregations
- **Prevalence**: Rare (most observations have signal)

**Timezone Issues**:

- **Status**: RESOLVED - using TIMESTAMPTZ (UTC)
- **Impact**: None

**Duplicate Observations**:

- **Status**: UNKNOWN - needs analysis
- **Mitigation**: Use DISTINCT ON (bssid, time) if needed

### 7.2 Business Logic Gaps

**Known Networks**:

- **Question**: Should trusted devices be auto-whitelisted?
- **Current**: No whitelist mechanism
- **Recommendation**: Add `network_tags.tag_type = 'LEGIT'` filter

**VPNs/Proxies**:

- **Question**: How to handle VPN endpoints?
- **Current**: Treated as regular networks
- **Impact**: May appear as "following" (false positive)

**Mobile Hotspots**:

- **Question**: Legitimate frequent location changes
- **Current**: May score high (false positive)
- **Recommendation**: Detect by manufacturer + SSID pattern

**IoT Devices**:

- **Question**: Different behavior profile than phones
- **Current**: Treated same as all devices
- **Recommendation**: Classify by manufacturer + capabilities

### 7.3 Algorithm Gaps

**CYT Threat Model Assumptions**:

- Assumes WiFi sniffing (wardriving)
- Assumes GPS-enabled collection
- Assumes single-user threat model

**ShadowCheck Differences**:

- ✅ Same: WiFi sniffing primary method
- ✅ Same: GPS-enabled observations
- ✅ Same: Personal surveillance focus
- ⚠️ Different: No SSID probe analysis
- ⚠️ Different: No time-of-day weighting
- ⚠️ Different: No device correlation

**Missing Threat Types**:

- **Rogue APs**: SSID spoofing not detected
- **Evil Twin**: Duplicate SSID not flagged
- **Deauth Attacks**: Not observable in passive sniffing
- **Wardriving**: Not distinguished from stalking

**Signal Strength Weighting**:

- **Question**: Should distant devices be less threatening?
- **Current**: No RSSI weighting
- **Recommendation**: Consider proximity factor (RSSI > -70 = closer = more threatening)

---

## Recommendations for Implementation

### High Priority

1. **Validate Current Scoring**
   - Create labeled test set (10 threats, 30 benign)
   - Measure TPR/FPR on current algorithm
   - Identify false positive patterns

2. **Add Missing Dimensions**
   - **Off-hours activity**: Weight night observations (10pm-6am)
   - **Quick transitions**: Flag <30min location changes
   - **Temporal regularity**: Penalize scheduled patterns

3. **Improve False Positive Handling**
   - Detect mobile hotspots (manufacturer + SSID)
   - Detect delivery vehicles (commercial SSIDs)
   - Add whitelist mechanism (`network_tags.tag_type = 'LEGIT'`)

### Medium Priority

4. **Performance Optimization**
   - Measure current materialized view refresh time
   - Implement incremental updates (new observations only)
   - Add indexes on threat-related columns

5. **User Experience**
   - Simplify threat explanation (less technical JSON)
   - Add threat score timeline visualization
   - Implement browser notifications for HIGH threats

6. **Historical Tracking**
   - Create `threat_history` table
   - Track score changes over time
   - Alert on significant score increases

### Low Priority

7. **Advanced Features**
   - Device correlation analysis (coordinated threats)
   - SSID probe anomaly detection
   - Signal strength trend analysis
   - Predictive threat modeling (ML)

---

## Next Steps

1. **Review this context document** with stakeholders
2. **Validate threat model assumptions** against real-world cases
3. **Create labeled test dataset** for algorithm validation
4. **Measure current system performance** (query times, refresh times)
5. **Design specialized threat scoring prompt** based on this context
6. **Implement and test** new threat scoring algorithm
7. **Validate with real data** and iterate

---

## Appendix: Data Samples

### Sample Observation Record

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "ssid": "Suspicious_Device",
  "lat": 43.025,
  "lon": -83.697,
  "level": -65,
  "accuracy": 15.0,
  "time": "2026-01-15T14:30:00Z",
  "radio_type": "W",
  "radio_frequency": 2437,
  "radio_capabilities": "WPA2-PSK-CCMP",
  "altitude": 250.5
}
```

### Sample Threat Analysis

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "threat": {
    "score": 0.75,
    "level": "HIGH",
    "summary": "Device seen at home and away, persistent tracking over 8 days",
    "flags": [
      "SEEN_AT_HOME_AND_AWAY",
      "EXCESSIVE_MOVEMENT",
      "PERSISTENT_TRACKING",
      "HIGH_OBSERVATION_COUNT"
    ],
    "signals": [
      {
        "code": "HOME_AND_AWAY",
        "weight": 0.4,
        "evidence": {
          "seen_at_home": true,
          "seen_away": true,
          "home_distance_min_m": 45,
          "away_distance_max_km": 12.5
        }
      },
      {
        "code": "EXCESSIVE_MOVEMENT",
        "weight": 0.25,
        "evidence": {
          "max_distance_km": 12.5
        }
      },
      {
        "code": "PERSISTENT_TRACKING",
        "weight": 0.15,
        "evidence": {
          "unique_days": 8,
          "first_seen": "2026-01-08",
          "last_seen": "2026-01-15"
        }
      },
      {
        "code": "HIGH_OBSERVATION_COUNT",
        "weight": 0.1,
        "evidence": {
          "observation_count": 67
        }
      }
    ]
  },
  "observations": 67,
  "unique_days": 8,
  "unique_locations": 15,
  "max_distance_km": 12.5,
  "max_speed_kmh": 45.2
}
```

---

**Document Status**: COMPLETE  
**Ready for**: Specialized threat scoring implementation prompt  
**Confidence Level**: HIGH (based on code analysis + existing implementation)
