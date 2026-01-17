# WiGLE Enrichment & Threat Detection Implementation Plan

## Issues to Fix

### 1. ✅ Mapbox Map Not Rendering

**Status:** Need to verify token is loaded from keyring
**Fix:** Update geospatial.html to load token from `/api/mapbox-token` or keyring

### 2. ❌ No Threat Detection

**Status:** Queries may be broken or no data matches criteria
**Fix:** Review and update threat detection logic

### 3. ❌ WiGLE API Integration Missing

**Status:** No enrichment workflow implemented
**Fix:** Create WiGLE API client and enrichment pipeline

### 4. ❌ Network Selection for Enrichment

**Status:** No UI for selecting networks
**Fix:** Add checkboxes to networks table + bulk enrichment button

### 5. ❌ Deduplication Strategy

**Status:** No merge logic for enriched data
**Fix:** Implement upsert logic with conflict resolution

## Implementation Plan

### Phase 1: Fix Immediate Issues (Priority 1)

#### 1.1 Fix Mapbox Token Loading

```javascript
// Update geospatial.html to load from keyring via API
fetch('/api/settings/mapbox')
  .then((r) => r.json())
  .then((data) => {
    if (data.token) {
      mapboxgl.accessToken = data.token;
      initMap();
    }
  });
```

#### 1.2 Fix Threat Detection

- Review current threat detection queries
- Update to work with new schema (app.observations, app.networks)
- Add proper indexes if missing

### Phase 2: WiGLE API Integration (Priority 2)

#### 2.1 WiGLE API Client

Create `/src/services/wigleService.js`:

```javascript
class WiGLEService {
  async searchByBSSID(bssid) {
    // GET /api/v2/network/detail?netid={bssid}
  }

  async searchBySSID(ssid) {
    // GET /api/v2/network/search?ssid={ssid}
  }

  async searchByLocation(lat, lon, radius) {
    // GET /api/v2/network/search?latrange1={lat1}&latrange2={lat2}...
  }
}
```

#### 2.2 Enrichment Staging Table

```sql
CREATE TABLE app.wigle_enrichment_staging (
    bssid TEXT PRIMARY KEY,
    wigle_data JSONB NOT NULL,
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT DEFAULT 'wigle_api_v2',
    status TEXT DEFAULT 'pending', -- pending, merged, failed
    error TEXT
);
```

#### 2.3 Enrichment Merge Logic

```sql
-- Merge enriched data into networks table
UPDATE app.networks n
SET
    ssid = COALESCE(n.ssid, staging.wigle_data->>'ssid'),
    encryption = COALESCE(n.encryption, staging.wigle_data->>'encryption'),
    -- ... other fields
    last_enriched = NOW()
FROM app.wigle_enrichment_staging staging
WHERE n.bssid = staging.bssid
  AND staging.status = 'pending';
```

### Phase 3: Network Selection UI (Priority 3)

#### 3.1 Add Selection to Networks Table

```html
<!-- Add to networks.html -->
<input type="checkbox" class="network-select" data-bssid="{bssid}" />
```

#### 3.2 Bulk Enrichment Button

```html
<button onclick="enrichSelected()">Enrich Selected Networks (0)</button>
```

#### 3.3 Enrichment API Endpoint

```javascript
// POST /api/enrichment/bulk
app.post('/api/enrichment/bulk', async (req, res) => {
  const { bssids } = req.body; // Array of BSSIDs

  for (const bssid of bssids) {
    // 1. Query WiGLE API
    // 2. Store in staging table
    // 3. Merge with networks table
  }
});
```

### Phase 4: Deduplication Strategy (Priority 4)

#### 4.1 Conflict Resolution Rules

```javascript
const mergeRules = {
  ssid: 'prefer_non_empty',
  encryption: 'prefer_stronger',
  signal_dbm: 'prefer_stronger',
  first_seen: 'prefer_earliest',
  last_seen: 'prefer_latest',
  latitude: 'prefer_more_accurate',
  longitude: 'prefer_more_accurate',
};
```

#### 4.2 Enrichment Tracking

```sql
ALTER TABLE app.networks ADD COLUMN enrichment_sources TEXT[];
ALTER TABLE app.networks ADD COLUMN last_enriched TIMESTAMP WITH TIME ZONE;
ALTER TABLE app.networks ADD COLUMN enrichment_count INTEGER DEFAULT 0;
```

#### 4.3 Audit Trail

```sql
CREATE TABLE app.enrichment_history (
    id BIGSERIAL PRIMARY KEY,
    bssid TEXT NOT NULL,
    source TEXT NOT NULL,
    fields_updated TEXT[],
    old_values JSONB,
    new_values JSONB,
    enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## WiGLE API v2 Endpoints

### Network Detail

```
GET /api/v2/network/detail?netid={bssid}
```

Returns:

- SSID
- Encryption
- Channel
- Frequency
- First seen / Last seen
- Location (lat/lon)
- QoS
- Type

### Network Search

```
GET /api/v2/network/search?ssid={ssid}&onlymine=false
```

Returns array of networks matching criteria

### Location Search

```
GET /api/v2/network/search?latrange1={lat1}&latrange2={lat2}&longrange1={lon1}&longrange2={lon2}
```

Returns networks in bounding box

## Data Flow

```
1. User selects networks in UI
   ↓
2. POST /api/enrichment/bulk with BSSIDs
   ↓
3. For each BSSID:
   a. Query WiGLE API
   b. Store raw response in staging table
   c. Parse and validate data
   ↓
4. Merge staging → networks table
   a. Apply conflict resolution rules
   b. Update enrichment_sources array
   c. Log to enrichment_history
   ↓
5. Mark staging records as 'merged'
   ↓
6. Return summary to UI
```

## Deduplication Strategy

### Scenario 1: New Data from WiGLE

```sql
-- If network exists, merge fields
-- If network doesn't exist, insert
INSERT INTO app.networks (bssid, ssid, ...)
VALUES (...)
ON CONFLICT (bssid) DO UPDATE SET
  ssid = COALESCE(EXCLUDED.ssid, networks.ssid),
  encryption = COALESCE(EXCLUDED.encryption, networks.encryption),
  enrichment_sources = array_append(networks.enrichment_sources, 'wigle_api_v2'),
  last_enriched = NOW();
```

### Scenario 2: Conflicting Data

```javascript
// Prefer more recent data
if (staging.last_seen > existing.last_seen) {
  use_staging_data();
}

// Prefer stronger signal
if (staging.signal_dbm > existing.signal_dbm) {
  use_staging_location();
}

// Prefer more accurate location
if (staging.accuracy < existing.accuracy) {
  use_staging_location();
}
```

### Scenario 3: Multiple Enrichment Sources

```sql
-- Track all sources that contributed data
enrichment_sources: ['wigle_app', 'wigle_api_v2', 'kismet']

-- Query to see enrichment coverage
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN 'wigle_api_v2' = ANY(enrichment_sources) THEN 1 END) as wigle_enriched,
  COUNT(CASE WHEN enrichment_count > 0 THEN 1 END) as any_enrichment
FROM app.networks;
```

## Implementation Order

1. **Week 1: Critical Fixes**
   - [ ] Fix Mapbox token loading
   - [ ] Fix threat detection queries
   - [ ] Test with current data

2. **Week 2: WiGLE Integration**
   - [ ] Create WiGLE service
   - [ ] Create staging table
   - [ ] Implement single BSSID enrichment
   - [ ] Test API calls

3. **Week 3: Bulk Enrichment**
   - [ ] Add network selection UI
   - [ ] Implement bulk enrichment endpoint
   - [ ] Add progress tracking
   - [ ] Rate limiting for WiGLE API

4. **Week 4: Deduplication & Polish**
   - [ ] Implement merge logic
   - [ ] Add enrichment history
   - [ ] Create enrichment dashboard
   - [ ] Documentation

## Rate Limiting

WiGLE API has rate limits:

- Free tier: ~100 queries/day
- Paid tier: Higher limits

Strategy:

- Queue enrichment requests
- Process in batches
- Cache results
- Respect rate limits

## Files to Create

1. `/src/services/wigleService.js` - WiGLE API client
2. `/src/api/routes/v1/enrichment.js` - Enrichment endpoints
3. `/sql/migrations/03_create_enrichment_tables.sql` - Schema
4. `/public/js/enrichment.js` - UI logic
5. `/docs/WIGLE_API_GUIDE.md` - API documentation

## Testing Plan

1. Test WiGLE API connectivity
2. Test single BSSID enrichment
3. Test bulk enrichment (10 networks)
4. Test deduplication logic
5. Test conflict resolution
6. Test rate limiting
7. Load test (1000 networks)

## Success Metrics

- ✅ Map renders with Mapbox token
- ✅ Threat detection shows results
- ✅ Can select networks for enrichment
- ✅ WiGLE API returns data
- ✅ Data merges without duplicates
- ✅ Enrichment history tracked
- ✅ UI shows enrichment status
