# Scripts Directory

## Security & Maintenance

### Password Rotation

```bash
./scripts/rotate-db-password.sh
./deploy/aws/scripts/rotate-grafana-passwords.sh
```

Automated password rotation for PostgreSQL. Works in both local and AWS environments.

- Generates secure 32-character password
- Updates secrets in AWS Secrets Manager (no secrets on disk)
- Updates PostgreSQL user password
- Restarts affected services
- See `docs/security/PASSWORD_ROTATION.md` for details

Grafana rotation script:

- Generates `grafana_admin_password` and `grafana_reader_password`
- Updates `shadowcheck/config` in AWS Secrets Manager
- Syncs the `grafana_reader` PostgreSQL role password/grants
- Recreates `shadowcheck_grafana` with runtime-only env vars

### Database Backup

```bash
./scripts/backup-shadowcheck.sh
```

Creates timestamped PostgreSQL backup with optional S3 upload.

### AWS Spot Instance

```bash
./deploy/aws/scripts/launch-shadowcheck-spot.sh
```

Launches ShadowCheck Spot instance with persistent data volume.

- See `deploy/aws/README.md` for AWS deployment details

## Data Import & ETL

### WiGLE Import

```bash
# Canonical SQLite import
npx tsx etl/load/sqlite-import.ts <file.sqlite> [source_tag]

# Canonical JSON import
npx tsx etl/load/json-import.ts <file.json>

# Legacy wrapper entrypoints remain temporarily for backwards compatibility,
# but new operational docs should use the ETL paths above.
```

### Geocoding

```bash
# Batch geocoding
npx tsx scripts/geocoding/geocode-batch.ts

# Reverse geocoding
npx tsx scripts/geocoding/reverse-geocode-smart.ts

# Import geocoded data
npx tsx scripts/geocoding/import-geocodes.ts
```

### Address Enrichment

```bash
# Multi-source enrichment
npx tsx scripts/enrichment/enrich-multi-source.ts

# Business names
npx tsx scripts/enrichment/enrich-business-names.ts

# Monitor progress
npx tsx scripts/enrichment/monitor-enrichment.ts
```

## Machine Learning

### Model Training

```bash
npx tsx scripts/ml/ml-trainer.ts
```

Trains threat detection model on tagged networks.

## Database Operations

### Connect to Database

```bash
./scripts/db-connect.sh
```

Opens psql connection to PostgreSQL.

### Run Migration

```bash
./scripts/shell/run-migration.sh <migration.sql>
```

Applies SQL migration with error handling.

### Refresh Materialized Views

```bash
./scripts/refresh_api_network.sh        # Full refresh
./scripts/refresh_api_network_delta.sh  # Delta refresh
```

### Rebuild Network Precision

```bash
npx tsx scripts/rebuild-networks-precision.ts
```

Recalculates network location precision from observations.

## Development

### Start Server

```bash
./scripts/shell/start-server.sh
```

Starts development server with hot reload.

### Docker Management

```bash
./scripts/docker-manage.sh [up|down|restart|logs]
```

Manages Docker Compose services.

### Test Endpoints

```bash
./scripts/test-endpoints.sh
```

Validates API endpoint responses.

### Test Dashboard Filters

```bash
bash scripts/test-dashboard-filters.sh http://localhost:3001
```

Validates dashboard filter behavior against `/api/dashboard-metrics`:

- Baseline vs filtered parity checks
- `filtersApplied` behavior
- Neutral all-radio selection behavior

If the target API requires authentication, create a cookie jar first:

```bash
bash scripts/login-admin-from-aws-sm.sh http://localhost:3001 /tmp/sc.cookies
COOKIE_JAR=/tmp/sc.cookies bash scripts/test-dashboard-filters.sh http://localhost:3001
COOKIE_JAR=/tmp/sc.cookies bash scripts/test-all-filters.sh localhost:3001
```

## Utilities

### Set Home Location

```bash
npx tsx scripts/set-home.ts <lat> <lon>
```

Sets home location for distance calculations.

### Generate Sitemap

```bash
npx tsx scripts/generate-sitemap.ts
```

Generates sitemap.xml for SEO.

### Write Robots.txt

```bash
npx tsx scripts/write-robots.ts
```

Generates robots.txt (respects ROBOTS_ALLOW_INDEXING env var).

## Script Categories

- **Security**: `rotate-db-password.sh`, `backup-shadowcheck.sh`
- **AWS**: `launch-shadowcheck-spot.sh`
- **Import**: `scripts/import/*.ts`
- **Geocoding**: `scripts/geocoding/*.ts`
- **Enrichment**: `scripts/enrichment/*.ts`
- **ML**: `scripts/ml/*.ts`
- **Database**: `db-*.sh`, `refresh-*.sh`, `rebuild-*.ts`
- **Development**: `shell/*.sh`, `docker-manage.sh`
- **Utilities**: `set-home.ts`, `generate-sitemap.ts`, `write-robots.ts`

## TypeScript Scripts

All `.ts` scripts should be run with `npx tsx`:

```bash
npx tsx scripts/path/to/script.ts [args]
```

## Shell Scripts

All `.sh` scripts should be executable:

```bash
chmod +x scripts/script-name.sh
./scripts/script-name.sh [args]
```
