# Get Free API Keys for Address Enrichment

## Quick Setup (5 minutes)

### 1. LocationIQ (5,000 requests/day)

1. Go to: https://locationiq.com/register
2. Sign up with email
3. Verify email
4. Go to Dashboard → Access Tokens
5. Copy your token
6. Add to `.env`: `LOCATIONIQ_API_KEY=your_token_here`

### 2. OpenCage (2,500 requests/day)

1. Go to: https://opencagedata.com/users/sign_up
2. Sign up with email
3. Verify email
4. Go to Dashboard → API Keys
5. Copy your key
6. Add to `.env`: `OPENCAGE_API_KEY=your_key_here`

### 3. Geoapify (3,000 requests/day)

1. Go to: https://www.geoapify.com/get-started-with-maps-api
2. Sign up with email
3. Verify email
4. Go to Dashboard → API Keys
5. Copy your key
6. Add to `.env`: `GEOAPIFY_API_KEY=your_key_here`

### 4. HERE (250,000 requests/month!)

1. Go to: https://developer.here.com/sign-up
2. Sign up with email
3. Verify email
4. Create a project
5. Generate API key
6. Add to `.env`: `HERE_API_KEY=your_key_here`

## Total Free Capacity

**With all 4 keys:**

- **260,500 requests/day**
- **7.8 million requests/month**

**Current database:**

- ~28,000 addresses need enrichment
- With keys: ~30 minutes to complete
- Without keys: ~8 hours to complete

## Usage

```bash
# Add keys to .env file
nano .env

# Run fast enrichment (uses all available APIs)
node enrich-addresses-fast.js 10000

# Check progress
tail -f address_enrich_fast.log
```

## Performance

**Without API keys (current):**

- Speed: ~100 addresses/hour
- APIs: Overpass + Nominatim only
- Rate limited: 1 req/second

**With API keys:**

- Speed: ~1,000 addresses/hour
- APIs: All 4 in parallel
- Rate limited: 5 concurrent requests

## Recommended Strategy

1. **Start now** with free Overpass/Nominatim (no keys needed)
2. **Sign up** for LocationIQ (fastest signup, 5k/day)
3. **Add HERE** for massive capacity (250k/month)
4. **Optional**: OpenCage + Geoapify for redundancy

## Current Status

```bash
# Check how many addresses need enrichment
docker exec shadowcheck_postgres_18 psql -U postgres -d shadowcheck -c \
  "SELECT COUNT(*) FROM app.networks_legacy WHERE trilat_address IS NOT NULL AND venue_name IS NULL;"

# Check enrichment progress
tail -f address_enrich_fast.log
```
