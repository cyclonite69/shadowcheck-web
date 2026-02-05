# ETL Load Scripts

Data extraction and loading scripts for importing raw data into staging tables.

## Scripts

### sqlite-import.js

High-performance parallel importer for WiGLE SQLite databases.

```bash
# Basic usage
node etl/load/sqlite-import.js /path/to/wigle.sqlite

# With environment config
IMPORT_WORKERS=8 IMPORT_BATCH_SIZE=2000 node etl/load/sqlite-import.js /path/to/wigle.sqlite

# Debug mode
DEBUG=true node etl/load/sqlite-import.js /path/to/wigle.sqlite
```

**Features:**

- Multi-threaded parallel import (configurable workers)
- Automatic MV refresh after import
- Progress tracking with speed metrics
- Import record in `app.imports`

### json-import.js

Imports WiGLE API v2 JSON response files.

```bash
node etl/load/json-import.js
```

**Default directory:** `wigle api v2 responses/`

### fbi-offices.ts

Loads FBI field offices and resident agencies into `app.agency_offices` from public FBI pages.

```bash
# Load all offices (keeps existing non-FBI rows)
tsx etl/load/fbi-offices.ts

# Refresh FBI rows only
tsx etl/load/fbi-offices.ts --refresh

# Limit number of field offices (for testing)
tsx etl/load/fbi-offices.ts --limit=5
```

### fbi-resident-agencies-gov.ts

Enriches FBI resident agencies with addresses from curated official .gov sources.

```bash
# Use default CSV at data/csv/fbi_resident_agencies_gov.csv
tsx etl/load/fbi-resident-agencies-gov.ts

# Provide a custom CSV
tsx etl/load/fbi-resident-agencies-gov.ts --csv=/path/to/file.csv
```

## Configuration

| Variable            | Default          | Description                       |
| ------------------- | ---------------- | --------------------------------- |
| `IMPORT_WORKERS`    | 4                | Number of parallel worker threads |
| `IMPORT_BATCH_SIZE` | 1000             | Records per batch insert          |
| `DEBUG`             | false            | Enable verbose debug logging      |
| `DB_HOST`           | 127.0.0.1        | PostgreSQL host                   |
| `DB_PORT`           | 5432             | PostgreSQL port                   |
| `DB_NAME`           | shadowcheck_db   | Database name                     |
| `DB_USER`           | shadowcheck_user | Database user                     |
| `DB_PASSWORD`       | (required)       | Database password                 |
