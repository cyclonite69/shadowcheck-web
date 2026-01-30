# ETL Pipeline

ShadowCheck Extract-Transform-Load pipeline for importing network observation data.

## Directory Structure

```
etl/
├── load/           # Data extraction and loading scripts
├── transform/      # Data transformation and normalization
├── promote/        # Data validation and materialized view refresh
└── utils/          # Shared utilities
```

## Pipeline Flow

```
Source Data (SQLite/JSON)
         ↓
    [1. LOAD]
         ↓
  import.wigle_networks_raw (staging)
         ↓
   [2. TRANSFORM]
         ↓
  app.observations (production)
         ↓
   [3. PROMOTE]
         ↓
  Materialized Views + ML Scoring
```

## Quick Start

```bash
# Import from WiGLE SQLite database
node etl/load/sqlite-import.js /path/to/wigle.sqlite

# Import from WiGLE API JSON responses
node etl/load/json-import.js

# Refresh materialized views
node etl/promote/refresh-mviews.js

# Run ML scoring
node etl/promote/run-scoring.js
```

## Configuration

Set environment variables or use `.env`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shadowcheck_db
DB_USER=shadowcheck_user
DB_PASSWORD=your_password
IMPORT_WORKERS=4
IMPORT_BATCH_SIZE=1000
DEBUG=false
```

## Data Sources

| Source              | Script                  | Target Table                      |
| ------------------- | ----------------------- | --------------------------------- |
| WiGLE SQLite        | `load/sqlite-import.js` | `app.observations`                |
| WiGLE API v2 JSON   | `load/json-import.js`   | `public.wigle_v2_networks_search` |
| WiGLE API v3 Detail | API endpoint            | `public.wigle_v3_network_details` |

## Monitoring

Import progress is tracked in `app.imports` table:

```sql
SELECT id, source_file, status, records_imported, records_failed, duration_seconds
FROM app.imports
ORDER BY started_at DESC
LIMIT 10;
```
