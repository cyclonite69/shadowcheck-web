# ETL Transform Scripts

Data transformation and normalization scripts.

## Scripts

### normalize-observations.js

Normalizes raw import data into the production observations schema.

- Standardizes BSSID format (uppercase)
- Validates coordinates (lat/lon ranges)
- Reports radio type distribution

### deduplicate.js

Removes duplicate observations based on composite key.

- Uses `(bssid, lat, lon, time)` as composite key
- Preserves highest signal strength (level) observation
- Updates deduplication stats

### enrich-geocoding.js

Adds reverse geocoding data to observations.

- Uses configured geocoding providers
- Rate-limited API calls
- Caches results in `app.geocoding_cache`

## Data Flow

```
app.observations (raw)
         ↓
  [normalize-observations.js]
         ↓
  app.observations (normalized)
         ↓
  [deduplicate.js]
         ↓
  app.observations (deduplicated)
         ↓
  [enrich-geocoding.js]
         ↓
  app.observations (geocoded)
```
