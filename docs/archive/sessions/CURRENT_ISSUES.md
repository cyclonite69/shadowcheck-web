# Current Issues - Surveillance Page

## Issue 1: ❌ Tagged items appearing in UNDETERMINED list

**Problem**: When you tag a network as THREAT or SAFE, it still shows up in the "Active Threats" (undetermined) list.

**Root Cause**: The `exclude_tagged=true` parameter is being sent, but the SQL WHERE clause `nt.tag_type IS NULL` is not filtering correctly.

**Evidence**:
```bash
# Tagged BSSID: 310260_10943488_4368449837
# This BSSID is in network_tags with tag_type='THREAT'
# But it STILL appears in /api/threats/quick?exclude_tagged=true
```

**Suspected Issue**: The LEFT JOIN might be returning NULL for nt.tag_type even when tags exist.

**Fix Needed**: Change the query to use NOT EXISTS or INNER JOIN instead of LEFT JOIN + WHERE NULL check.

## Issue 2: ❌ Geospatial tagging not persisting to Surveillance page

**Problem**: When you tag a network on the geospatial page, it doesn't show up in the correct card on surveillance page.

**Root Cause**: Unknown - need to verify if:
1. Geospatial page is calling the correct API endpoint
2. The tag is being saved to database
3. The surveillance page is loading the correct data

**Fix Needed**: Check geospatial.html tagging implementation.

## Issue 3: ❓ Not seeing more threats after algorithm change

**Problem**: User expected more threats after lowering threshold to 30 and increasing distance weight.

**Current Count**: 61 threats total

**Analysis Needed**:
- Check if threshold change is working
- Verify distance weight is being applied
- Check if data has devices that meet criteria

## Immediate Fix for Issue 1

Change the SQL query from:
```sql
LEFT JOIN app.network_tags nt ON ns.bssid = nt.bssid
WHERE nt.tag_type IS NULL
```

To:
```sql
LEFT JOIN app.network_tags nt ON ns.bssid = nt.bssid
WHERE NOT EXISTS (
  SELECT 1 FROM app.network_tags 
  WHERE bssid = ns.bssid
)
```

Or use:
```sql
WHERE ns.bssid NOT IN (
  SELECT bssid FROM app.network_tags
)
```

## Testing Commands

```bash
# Get a tagged BSSID
curl -s "http://localhost:3001/api/networks/tagged?tag_type=THREAT&page=1&limit=1"

# Check if it appears in undetermined (should NOT)
curl -s "http://localhost:3001/api/threats/quick?page=1&limit=100&exclude_tagged=true" | grep "BSSID_HERE"

# Tag a network
curl -X POST "http://localhost:3001/api/tag-network" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secure-random-key-here" \
  -d '{"bssid":"AA:BB:CC:DD:EE:FF","tag_type":"THREAT","confidence":90}'

# Verify it moved
curl -s "http://localhost:3001/api/networks/tagged?tag_type=THREAT" | grep "AA:BB:CC:DD:EE:FF"
```
