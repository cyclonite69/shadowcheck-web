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

### enrich-agency-offices-zip4-smarty.ts

Adds ZIP+4 to `app.agency_offices.postal_code` using Smarty US Street API.

- Reads Smarty credentials from keyring/env (`smarty_auth_id` / `smarty_auth_token`)
- Only fills `postal_code` when it is blank or 5-digit
- Optional: can also fill missing `latitude`/`longitude`/`location` if Smarty returns coordinates (`--with-coordinates`)

### normalize-agency-offices-phone.ts

Normalizes `app.agency_offices.phone` into structured phone fields (does not overwrite `phone`):

- `phone_digits` (digits only)
- `normalized_phone` (US national 10-digit, US-only when parseable)
- `normalized_phone_display` ((XXX) XXX-XXXX, US-only when parseable)

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
