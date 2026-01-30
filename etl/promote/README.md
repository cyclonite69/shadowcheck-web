# ETL Promote Scripts

Data validation, materialized view refresh, and ML scoring scripts.

## Scripts

### validate-data.js

Validates data quality after import.

Checks:

- Coordinate validity (no nulls, valid ranges)
- BSSID format (valid MAC addresses)
- Timestamp sanity (not in future, not too old)
- Signal strength ranges (-120 to 0 dBm)

### refresh-mviews.js

Refreshes all materialized views.

```bash
node etl/promote/refresh-mviews.js
```

Refreshes:

- `public.api_network_explorer_mv`
- `public.network_statistics_mv`
- Other registered MVs

### run-scoring.js

Triggers ML threat scoring.

```bash
node etl/promote/run-scoring.js
```

Updates:

- `app.network_threat_scores`
- Network classification predictions

## Promotion Flow

```
app.observations (validated)
         ↓
  [validate-data.js]
         ↓
  [refresh-mviews.js]
         ↓
  Materialized Views updated
         ↓
  [run-scoring.js]
         ↓
  Threat scores updated
```
