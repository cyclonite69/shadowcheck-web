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
