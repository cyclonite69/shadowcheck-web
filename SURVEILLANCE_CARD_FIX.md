# Surveillance Card State Fix

## Problem Statement

The surveillance page has 3 cards but needs 4 distinct states:
1. **UNDETERMINED** (Active Threats) - Untagged threats that need review
2. **CRITICAL/HIGH/MEDIUM/LOW** (Confirmed Threats) - Tagged as THREAT
3. **SAFE** (Tagged Safe) - Tagged as FALSE_POSITIVE
4. Items should **move between cards** when tagged

## Root Cause

The "Active Threats" card was showing ALL threats regardless of tag status. When a user tagged a threat, it would:
- ✅ Save the tag to database
- ✅ Reload all lists
- ❌ **Still show in Active Threats** (because it wasn't filtering out tagged items)

## Solution Applied

### Backend Changes (server.js)

**File**: `server.js` Line ~551

Added `exclude_tagged` parameter to `/api/threats/quick` endpoint:

```javascript
// NEW: Parse exclude_tagged parameter
const excludeTagged = req.query.exclude_tagged === 'true';

// NEW: Add WHERE clause to filter out tagged networks
if (excludeTagged) {
  whereClauses.push(`nt.tag_type IS NULL`);
}
```

This ensures the Active Threats list only shows **UNDETERMINED** (untagged) threats.

### Frontend Changes (surveillance.html)

**File**: `public/surveillance.html` Line ~1075

Updated API call to include `exclude_tagged=true`:

```javascript
// BEFORE:
const url = `${API_BASE}/threats/quick?page=${page}&limit=${limit}`;

// AFTER:
const url = `${API_BASE}/threats/quick?page=${page}&limit=${limit}&exclude_tagged=true`;
```

## How It Works Now

### Card States:

1. **Active Threats (UNDETERMINED)**
   - Shows threats with `nt.tag_type IS NULL`
   - These are threats that need user review
   - Count badge shows untagged threats only

2. **Confirmed Threats (CRITICAL/HIGH/MEDIUM/LOW)**
   - Shows threats with `tag_type = 'THREAT'`
   - API: `/api/networks/tagged?tag_type=THREAT`
   - User has confirmed these are real threats

3. **Tagged Safe**
   - Shows threats with `tag_type = 'FALSE_POSITIVE'`
   - API: `/api/networks/tagged?tag_type=FALSE_POSITIVE`
   - User has marked these as safe/false positives

### Tagging Flow:

```
User clicks "Tag as Threat" on network in Active Threats
  ↓
tagNetwork(bssid, 'THREAT', 90) called
  ↓
POST /api/tag-network with tag_type='THREAT'
  ↓
Database: INSERT INTO app.network_tags
  ↓
Frontend: Reload all 3 lists
  ↓
Active Threats: Excludes this BSSID (nt.tag_type IS NULL fails)
Confirmed Threats: Includes this BSSID (tag_type = 'THREAT' matches)
  ↓
Network moves from Active → Confirmed ✅
```

## Data Structure

### network_tags table:
```sql
CREATE TABLE app.network_tags (
  bssid TEXT PRIMARY KEY,
  tag_type TEXT,  -- 'THREAT', 'FALSE_POSITIVE', 'INVESTIGATE', 'LEGIT'
  confidence NUMERIC,
  notes TEXT,
  tagged_at TIMESTAMP,
  threat_score NUMERIC,
  ml_confidence NUMERIC,
  user_override BOOLEAN
);
```

### API Response Fields:
```javascript
{
  bssid: "AA:BB:CC:DD:EE:FF",
  ssid: "Network Name",
  threatScore: 75,
  isTagged: true,           // NEW: Indicates if network has any tag
  userTag: "THREAT",        // NEW: The actual tag type
  userConfidence: 90,
  userNotes: "User tagged as THREAT"
}
```

## Testing

### Test Case 1: Tag as Threat
1. Open `/surveillance.html`
2. Note count in "Active Threats" badge (e.g., 61)
3. Click "🔴 Threat" on any network
4. Verify:
   - Active Threats count decreases by 1 (60)
   - Network appears in "Confirmed Threats" card
   - Network removed from "Active Threats" card

### Test Case 2: Tag as Safe
1. Click "🟢 Safe" on any network in Active Threats
2. Verify:
   - Active Threats count decreases
   - Network appears in "Tagged Safe" card
   - Network removed from Active Threats

### Test Case 3: Untag
1. Click "✕ Untag" on any network in Confirmed Threats
2. Verify:
   - Network removed from Confirmed Threats
   - Network reappears in Active Threats
   - Active Threats count increases

## API Endpoints

### Get Undetermined Threats (Active)
```
GET /api/threats/quick?page=1&limit=100&exclude_tagged=true
```

### Get Confirmed Threats
```
GET /api/networks/tagged?tag_type=THREAT&page=1&limit=100
```

### Get Tagged Safe
```
GET /api/networks/tagged?tag_type=FALSE_POSITIVE&page=1&limit=100
```

### Tag Network
```
POST /api/tag-network
Body: {
  bssid: "AA:BB:CC:DD:EE:FF",
  tag_type: "THREAT",
  confidence: 90,
  notes: "User tagged as THREAT"
}
```

### Untag Network
```
DELETE /api/tag-network/:bssid
```

## Files Modified

1. ✅ `server.js` - Added `exclude_tagged` parameter support
2. ✅ `public/surveillance.html` - Updated API call to use `exclude_tagged=true`
3. ✅ Server restarted to apply changes

## Verification

```bash
# Test undetermined threats (should exclude tagged)
curl "http://localhost:3001/api/threats/quick?page=1&limit=5&exclude_tagged=true"

# Test confirmed threats
curl "http://localhost:3001/api/networks/tagged?tag_type=THREAT&page=1&limit=5"

# Test tagged safe
curl "http://localhost:3001/api/networks/tagged?tag_type=FALSE_POSITIVE&page=1&limit=5"
```

## Status

✅ **FIXED** - Networks now move between cards when tagged
✅ **TESTED** - API returns correct filtered results
✅ **DEPLOYED** - Server running with changes

The surveillance page now has proper 4-state card management:
- **UNDETERMINED** → Active Threats (untagged)
- **THREAT** → Confirmed Threats (tagged as threat)
- **SAFE** → Tagged Safe (tagged as false positive)
- **Movement** → Items move between cards when tagged/untagged
