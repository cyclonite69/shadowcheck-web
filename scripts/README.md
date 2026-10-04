# Scripts Directory

## Script Safety Categories

> [!IMPORTANT]
> **Safety Rule:** Do not assume a script is safe just because it lives under `scripts/`. Check the category, read the script, and prefer dry-run/read-only modes when available.

The tooling in this directory falls into the following functional categories:

| Category                             | Examples                                                   | Risk      | Rule of Thumb                                       |
| :----------------------------------- | :--------------------------------------------------------- | :-------- | :-------------------------------------------------- |
| **Safe Read-Only Diagnostics**       | `db-usage-audit.sql`, `generate-audit-report.js`           | 🟢 Low    | Safe to run on live environments to check status.   |
| **Build/Prebuild Utilities**         | `write-robots.js`, `generate-sitemap.js`                   | 🟢 Low    | Local asset generators.                             |
| **DB Migration/Deployment**          | `apply-migration.sh`, `setup-ec2.sh`                       | 🟡 Medium | Changes database schema or infrastructure state.    |
| **Security/Credential Tools**        | `rotate-db-password.sh`, `backup-sm-to-bitwarden.js`       | 🔴 High   | Handles credentials or SSO configuration.           |
| **Backup/Restore/Disaster Recovery** | `backup-shadowcheck.sh`, `restore-local-backup.sh`         | 🔴 High   | Modifies or restores complete snapshots.            |
| **Write-Heavy Maintenance**          | `rebuild-networks-precision.ts`, `rebuild-db.sql`          | 🔴 High   | Mass updates that take long locks on active tables. |
| **Historical/One-Off Scripts**       | `run_targeted_siblings.js`, `run_manufacturer_backfill.js` | 🟡 Medium | Retained for audit log; do not re-run.              |

### High-Risk Scripts Catalog

The following scripts are destructive or carry high operational risk. Exercise caution and verify targets before execution:

- **Credentials:**
  - `rotate-db-password.sh` / `rotate-grafana-passwords.sh`: Changes administrative role passwords.
- **Restore:**
  - `restore-local-backup.sh` / `ec2-restore-backup.sh`: Re-initializes database from backup snapshots.
- **Local test clone:**
  - `clone-local-test-db.sh`: Creates `shadowcheck_test` from the explicitly confirmed local `shadowcheck_db`; refuses remote Docker contexts and never drops an existing destination.
- **Destructive Maintenance:**
  - `rebuild-db.sql`: Drops and recreates schemas/views.
  - `rebuild-networks-precision.ts`: Runs intensive geographic precision updates across all networks.
  - `db-cleanup-drop-script.sql` / `db-cleanup-2026-03-28.sql`: Manual row/column drop cleanups.
- **Obsolete / One-Off Staging Helpers:**
  - `run_targeted_siblings.js` / `run_manufacturer_backfill.js`: Modifies tables without standard validation pipelines.

---

## Security & Maintenance

### Password Rotation

```bash
./scripts/rotate-db-password.sh
./deploy/aws/scripts/rotate-grafana-passwords.sh
```

Automated password rotation for PostgreSQL. Works in both local and AWS environments.

- Generates secure 32-character password
- Updates `shadowcheck/config` in AWS Secrets Manager (no secrets on disk)
- Updates the PostgreSQL role password with `ALTER USER`
- Can also rotate `db_admin_password` with `--rotate-admin`
- Restarts the running API container when present
- See `deploy/aws/docs/PASSWORD_ROTATION.md` for details

Grafana rotation script:

- Generates `grafana_admin_password` and `grafana_reader_password`
- Updates `shadowcheck/config` in AWS Secrets Manager
- Syncs the `grafana_reader` PostgreSQL role password/grants
- Recreates `shadowcheck_grafana` with runtime-only env vars

### Local Grafana

```bash
AWS_PROFILE=shadowcheck-sso \
AWS_REGION=us-east-1 \
SHADOWCHECK_AWS_SECRET=shadowcheck/config \
bash ./scripts/start-local-grafana.sh
```

Starts local Grafana for the proxied app URL at `http://localhost:8080/grafana/`,
keeps the upstream listener on `http://127.0.0.1:3002/`, pulls
`grafana_admin_password` and `grafana_reader_password` from `shadowcheck/config`,
and syncs the local `grafana_reader` PostgreSQL role.

### Database Backup

```bash
./scripts/backup-shadowcheck.sh
```

Creates timestamped PostgreSQL backup with optional S3 upload.

### Bitwarden Secrets Backup

```bash
BITWARDENCLI_APPDATA_DIR=/tmp/bwcli \
node ./scripts/backup-sm-to-bitwarden.js
```

Backs up the raw AWS Secrets Manager `SecretString` from `shadowcheck/config`
into a Bitwarden secure note without writing secret values to disk.

- Requires `aws` CLI access to the target secret
- Requires `bw` CLI with an authenticated, unlocked vault
- Stores the exact AWS JSON blob in the Bitwarden note body for restore-friendly backups
- Supports `--secret-id`, `--region`, `--profile`, `--item-name`, `--folder-id`, and `--organization-id`

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

### Schema Audit Report

```bash
npm run db:audit:report
```

Generates the comprehensive database architecture and schema audit report ([docs/schema/db-audit-report.md](file:///home/dbcooper/repos/shadowcheck-web/docs/schema/db-audit-report.md)) using [scripts/db-audit/generate-audit-report.js](file:///home/dbcooper/repos/shadowcheck-web/scripts/db-audit/generate-audit-report.js).

- Reads catalog dump inputs from the gitignored `scratch/` directory (e.g. `scratch/audit_*.txt`, `scratch/cross_ref_results.json`, `scratch/migrations_ref_results.json`).
- Staging and telemetry logs under `scratch/` remain strictly gitignored and local-only.

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
node scripts/generate-sitemap.js
```

Generates sitemap.xml for SEO.

### Write Robots.txt

```bash
node scripts/write-robots.js
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
- **Utilities**: `set-home.ts`, `generate-sitemap.js`, `write-robots.js`

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
