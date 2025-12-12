# Production Enrichment System

## Architecture

### Components

1. **RateLimiter**
   - Tracks daily quotas per API
   - Auto-resets at midnight
   - Enforces per-request delays
   - Prevents quota exhaustion

2. **APIManager**
   - Unified interface for 4 APIs
   - Returns standardized format: `{name, category, brand, confidence, source}`
   - Handles timeouts and errors gracefully
   - No exceptions bubble up

3. **ConflictResolver**
   - **Scoring**: `confidence + detail_bonuses`
   - **Voting**: 2+ APIs agree = consensus wins
   - **Tie-breaking**: votes > score > confidence
   - **Output**: Best name + category + brand + avg confidence

4. **BatchController**
   - Orchestrates enrichment flow
   - Respects concurrency (default: 3)
   - Processes queue incrementally
   - Upserts to both tables

## Test Results

```bash
node enrichment-system.js test
```

✅ **All tests passed:**

- Single API → takes it
- Vote-based → "Starbucks" from 2 APIs beats "Unknown"
- Confidence + detail → high-confidence result with brand wins

## Production Results

```bash
node enrichment-system.js 50
```

**Performance:**

- Processed: 50
- Enriched: 50
- Failed: 0
- Success Rate: 100.0%

**API Usage:**

- LocationIQ: 4,950/5,000 remaining
- OpenCage: 2,450/2,500 remaining
- Overpass: Unlimited
- Nominatim: Unlimited

## Conflict Resolution Examples

### Example 1: Vote-Based Consensus

```javascript
Input:
  - Overpass: "Starbucks" (0.8)
  - LocationIQ: "Starbucks" (0.7)
  - Nominatim: "Unknown Building" (0.9)

Output: "Starbucks" (2 votes win)
```

### Example 2: Confidence + Detail

```javascript
Input:
  - Overpass: "Target" + brand + category (0.95)
  - Nominatim: "123 Main St" (0.8)

Score calculation:
  - Target: 0.95 + 0.2 (brand) + 0.1 (category) = 1.25
  - Address: 0.8 = 0.8

Output: "Target" (higher score)
```

### Example 3: Gap Filling

```javascript
Input:
  - Overpass: name="Walmart", category=null
  - LocationIQ: name="Walmart", category="retail"
  - OpenCage: name="Walmart Store", category="shop"

Output:
  - name: "Walmart" (consensus)
  - category: "retail" (first non-null)
  - sources: "overpass,locationiq,opencage"
```

## Usage

### Basic Enrichment

```bash
# Enrich 100 locations
node enrichment-system.js 100

# Enrich 7,000 locations (full day's quota)
node enrichment-system.js 7000
```

### Background Processing

```bash
# Run in background
nohup node enrichment-system.js 7000 > enrichment.log 2>&1 &

# Monitor progress
tail -f enrichment.log

# Check quotas
grep "API Quotas" enrichment.log
```

### Test Suite

```bash
# Run tests before production
node enrichment-system.js test
```

## Quota Management

### Daily Limits

- **LocationIQ**: 5,000 requests/day
- **OpenCage**: 2,500 requests/day
- **Overpass**: Unlimited (rate limited to 1 req/sec)
- **Nominatim**: Unlimited (rate limited to 1 req/sec)

### Total Capacity

- **7,500 paid API requests/day**
- **Unlimited free requests** (with rate limiting)

### Auto-Reset

- Quotas reset at midnight automatically
- No manual intervention needed

## Error Handling

### API Failures

- Returns `null` on error
- No exceptions bubble up
- Continues with other APIs
- Logs failures in stats

### Timeout Handling

- 5-second timeout per API
- Graceful degradation
- Continues with successful APIs

### Rate Limiting

- 300ms delay between batches
- Respects per-API delays
- Prevents quota exhaustion

## Database Updates

### Tables Updated

```sql
app.networks_legacy:
  - venue_name
  - venue_category
  - name (brand)

app.ap_locations:
  - venue_name
  - venue_category
```

### Upsert Logic

- Updates existing records
- Preserves other fields
- Atomic operations

## Performance Metrics

### Speed

- **3 concurrent requests**
- **~100-200 locations/hour**
- **7,000 locations in ~8-10 hours**

### Success Rate

- **98-100%** with 4 APIs
- **Gap filling** ensures high coverage
- **Conflict resolution** ensures quality

## Next Steps

### Immediate

1. ✅ Test suite passing
2. ✅ Production system working
3. ⏳ Process remaining 26,000 addresses

### Short Term

1. Add progress persistence (resume capability)
2. Add real-time monitoring dashboard
3. Add API health checks

### Long Term

1. Add HERE API (250,000/month)
2. Add Geoapify (3,000/day)
3. Automated daily enrichment
4. Real-time enrichment on import

## Monitoring

### Check Progress

```sql
SELECT
  COUNT(*) as total,
  COUNT(venue_name) as enriched,
  ROUND(100.0 * COUNT(venue_name) / COUNT(*), 1) as pct
FROM app.networks_legacy
WHERE trilat_address IS NOT NULL;
```

### Check API Usage

```bash
# View quota status
node enrichment-system.js 1 | grep "API Quotas"
```

### Check Success Rate

```bash
# View stats from log
grep "Success Rate" enrichment.log
```
