# Scripts Documentation

This document catalogs and describes all available scripts in the ShadowCheckStatic project.

## Script Categories

1. [Root Scripts](#root-scripts)
2. [Database Scripts](#database-scripts)
3. [Docker Scripts](#docker-scripts)
4. [CLI Tools](#cli-tools)
5. [Enrichment Scripts](#enrichment-scripts)
6. [Geocoding Scripts](#geocoding-scripts)
7. [Import Scripts](#import-scripts)
8. [ML Scripts](#ml-scripts)
9. [Manual/Test Scripts](#manualtest-scripts)

---

## Root Scripts

Located in the project root (`scripts/` directory).

### Database Management

| Script                                                                   | Description                             |
| ------------------------------------------------------------------------ | --------------------------------------- |
| [`scripts/db-backup-commands.sh`](scripts/db-backup-commands.sh)         | Database backup commands and procedures |
| [`scripts/db-connect.sh`](scripts/db-connect.sh)                         | Database connection script              |
| [`scripts/setup_db.sh`](scripts/setup_db.sh)                             | Database initialization                 |
| [`scripts/setup_dashboard_script.sh`](scripts/setup_dashboard_script.sh) | Dashboard setup script                  |

### Maintenance & Validation

| Script                                                                         | Description                        |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| [`scripts/phase8_delta_verify.sh`](scripts/phase8_delta_verify.sh)             | Phase 8 delta verification         |
| [`scripts/phase10_run.sh`](scripts/phase10_run.sh)                             | Phase 10 execution                 |
| [`scripts/refresh_api_network.sh`](scripts/refresh_api_network.sh)             | Refresh API network data           |
| [`scripts/refresh_api_network_delta.sh`](scripts/refresh_api_network_delta.sh) | Refresh API network delta          |
| [`scripts/validate-explorer-v2.sh`](scripts/validate-explorer-v2.sh)           | Validate Explorer v2 functionality |
| [`scripts/test-endpoints.sh`](scripts/test-endpoints.sh)                       | Test API endpoints                 |

### Docker Management

| Script                                                         | Description                         |
| -------------------------------------------------------------- | ----------------------------------- |
| [`scripts/docker-manage.sh`](scripts/docker-manage.sh)         | Docker container management         |
| [`scripts/fix-docker-bridge.sh`](scripts/fix-docker-bridge.sh) | Fix Docker bridge networking issues |

### Backup & Recovery

| Script                                                           | Description                  |
| ---------------------------------------------------------------- | ---------------------------- |
| [`scripts/backup-shadowcheck.sh`](scripts/backup-shadowcheck.sh) | ShadowCheck backup procedure |

### Project Setup

| Script                                                                     | Description                    |
| -------------------------------------------------------------------------- | ------------------------------ |
| [`scripts/shadowcheck_setup_fixed.sh`](scripts/shadowcheck_setup_fixed.sh) | Fixed ShadowCheck setup script |

### GitHub

| Script                                                         | Description                  |
| -------------------------------------------------------------- | ---------------------------- |
| [`scripts/add-github-topics.sh`](scripts/add-github-topics.sh) | Add GitHub repository topics |

### SEO

| Script                                                       | Description          |
| ------------------------------------------------------------ | -------------------- |
| [`scripts/generate-sitemap.ts`](scripts/generate-sitemap.ts) | Generate sitemap.xml |
| [`scripts/write-robots.ts`](scripts/write-robots.ts)         | Generate robots.txt  |

---

## ETL & Pipeline Scripts

### Runners

| Script                                                                           | Description                    |
| -------------------------------------------------------------------------------- | ------------------------------ |
| [`scripts/run-migration.ts`](scripts/run-migration.ts)                           | Run database migrations        |
| [`scripts/rebuild-networks-precision.ts`](scripts/rebuild-networks-precision.ts) | Rebuild network precision data |

### Scoring

| Script                                                                 | Description                        |
| ---------------------------------------------------------------------- | ---------------------------------- |
| [`scripts/score-all-hybrid.ts`](scripts/score-all-hybrid.ts)           | Run hybrid scoring on all networks |
| [`scripts/refresh-threat-scores.sh`](scripts/refresh-threat-scores.sh) | Refresh threat scores              |

### Home Location

| Script                                                     | Description                  |
| ---------------------------------------------------------- | ---------------------------- |
| [`scripts/set-home.ts`](scripts/set-home.ts)               | Set home location            |
| [`scripts/update-home-s22.ts`](scripts/update-home-s22.ts) | Update home location for S22 |

### Client Imports

| Script                                                               | Description          |
| -------------------------------------------------------------------- | -------------------- |
| [`scripts/check-client-imports.ts`](scripts/check-client-imports.ts) | Check client imports |

---

## Database SQL Scripts

| Script                                                                       | Description                         |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| [`scripts/db-cleanup-drop-script.sql`](scripts/db-cleanup-drop-script.sql)   | Cleanup and drop script             |
| [`scripts/db-dependency-trace.sql`](scripts/db-dependency-trace.sql)         | Database dependency tracing         |
| [`scripts/db-object-classification.md`](scripts/db-object-classification.md) | Object classification documentation |
| [`scripts/db-usage-audit.sql`](scripts/db-usage-audit.sql)                   | Database usage audit                |
| [`scripts/rebuild-db.sql`](scripts/rebuild-db.sql)                           | Database rebuild script             |

---

## CLI Tools

Located in [`scripts/cli/`](scripts/cli/)

| Script                                                                           | Description          |
| -------------------------------------------------------------------------------- | -------------------- |
| [`scripts/cli/shadowcheck-cli.sh`](scripts/cli/shadowcheck-cli.sh)               | Main ShadowCheck CLI |
| [`scripts/cli/shadowcheck_cli_prompt.sh`](scripts/cli/shadowcheck_cli_prompt.sh) | CLI prompt utilities |

---

## Enrichment Scripts

Located in [`scripts/enrichment/`](scripts/enrichment/)

### Address Enrichment

| Script                                                                                         | Description                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------- |
| [`scripts/enrichment/enrich-addresses-fast.ts`](scripts/enrichment/enrich-addresses-fast.ts)   | Fast address enrichment         |
| [`scripts/enrichment/enrich-addresses-multi.ts`](scripts/enrichment/enrich-addresses-multi.ts) | Multi-source address enrichment |
| [`scripts/enrichment/enrich-business-names.ts`](scripts/enrichment/enrich-business-names.ts)   | Business name enrichment        |

### Multi-Source Enrichment

| Script                                                                                               | Description                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------- |
| [`scripts/enrichment/enrich-multi-source.ts`](scripts/enrichment/enrich-multi-source.ts)             | Multi-source enrichment           |
| [`scripts/enrichment/enrich-overpass-optimized.ts`](scripts/enrichment/enrich-overpass-optimized.ts) | Optimized Overpass API enrichment |
| [`scripts/enrichment/generate-overpass-queries.ts`](scripts/enrichment/generate-overpass-queries.ts) | Generate Overpass queries         |
| [`scripts/enrichment/enrichment-system.ts`](scripts/enrichment/enrichment-system.ts)                 | Enrichment system core            |
| [`scripts/enrichment/monitor-enrichment.ts`](scripts/enrichment/monitor-enrichment.ts)               | Monitor enrichment progress       |

---

## Geocoding Scripts

Located in [`scripts/geocoding/`](scripts/geocoding/)

### Batch Geocoding

| Script                                                                             | Description                |
| ---------------------------------------------------------------------------------- | -------------------------- |
| [`scripts/geocoding/geocode-addresses.ts`](scripts/geocoding/geocode-addresses.ts) | Geocode addresses          |
| [`scripts/geocoding/geocode-batch.ts`](scripts/geocoding/geocode-batch.ts)         | Batch geocoding            |
| [`scripts/geocoding/geocode-wigle.ts`](scripts/geocoding/geocode-wigle.ts)         | Geocode Wigle observations |

### Import Geocoding Data

| Script                                                                                           | Description                   |
| ------------------------------------------------------------------------------------------------ | ----------------------------- |
| [`scripts/geocoding/import-ap-addresses.ts`](scripts/geocoding/import-ap-addresses.ts)           | Import access point addresses |
| [`scripts/geocoding/import-final-geocodes.ts`](scripts/geocoding/import-final-geocodes.ts)       | Import final geocodes         |
| [`scripts/geocoding/import-geocodes.ts`](scripts/geocoding/import-geocodes.ts)                   | Import geocodes               |
| [`scripts/geocoding/import-missing-geocodes.ts`](scripts/geocoding/import-missing-geocodes.ts)   | Import missing geocodes       |
| [`scripts/geocoding/import-network-addresses.ts`](scripts/geocoding/import-network-addresses.ts) | Import network addresses      |

### Export

| Script                                                                                         | Description             |
| ---------------------------------------------------------------------------------------------- | ----------------------- |
| [`scripts/geocoding/export-missing-geocodes.ts`](scripts/geocoding/export-missing-geocodes.ts) | Export missing geocodes |

### Reverse Geocoding

| Script                                                                                                                 | Description                |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`scripts/geocoding/reverse-geocode-batch.ts`](scripts/geocoding/reverse-geocode-batch.ts)                             | Reverse geocode batch      |
| [`scripts/geocoding/reverse-geocode-observations-sample.ts`](scripts/geocoding/reverse-geocode-observations-sample.ts) | Sample reverse geocode     |
| [`scripts/geocoding/reverse-geocode-parallel.ts`](scripts/geocoding/reverse-geocode-parallel.ts)                       | Parallel reverse geocoding |
| [`scripts/geocoding/reverse-geocode-smart.ts`](scripts/geocoding/reverse-geocode-smart.ts)                             | Smart reverse geocoding    |

---

## Import Scripts

Located in [`scripts/import/`](scripts/import/)

| Script                                                                               | Description                 |
| ------------------------------------------------------------------------------------ | --------------------------- |
| [`scripts/import/import-wigle-parallel.ts`](scripts/import/import-wigle-parallel.ts) | Parallel Wigle import       |
| [`scripts/import/import-wigle-v2-json.ts`](scripts/import/import-wigle-v2-json.ts)   | Import Wigle v2 JSON format |
| [`scripts/import/turbo-import.ts`](scripts/import/turbo-import.ts)                   | High-performance import     |

---

## ML Scripts

Located in [`scripts/ml/`](scripts/ml/)

| Script                                                       | Description         |
| ------------------------------------------------------------ | ------------------- |
| [`scripts/ml/ml-trainer.ts`](scripts/ml/ml-trainer.ts)       | ML model trainer    |
| [`scripts/ml/ml-iterate.py`](scripts/ml/ml-iterate.py)       | ML iteration script |
| [`scripts/ml/requirements.txt`](scripts/ml/requirements.txt) | ML dependencies     |

---

## Manual/Test Scripts

Located in [`scripts/manual/`](scripts/manual/)

| Script                                                                               | Description                 |
| ------------------------------------------------------------------------------------ | --------------------------- |
| [`scripts/manual/band-geocode.ts`](scripts/manual/band-geocode.ts)                   | Band-specific geocoding     |
| [`scripts/manual/compare-opencage-band.ts`](scripts/manual/compare-opencage-band.ts) | Compare geocoding providers |
| [`scripts/manual/run-geocoding-sample.ts`](scripts/manual/run-geocoding-sample.ts)   | Run sample geocoding        |

### Database Testing

| Script                                                                                     | Description                 |
| ------------------------------------------------------------------------------------------ | --------------------------- |
| [`scripts/manual/test-db.js`](scripts/manual/test-db.js)                                   | Database connection test    |
| [`scripts/manual/test-db-direct.js`](scripts/manual/test-db-direct.js)                     | Direct DB test              |
| [`scripts/manual/test-db-url.js`](scripts/manual/test-db-url.js)                           | URL-based DB test           |
| [`scripts/manual/test-pg-debug.js`](scripts/manual/test-pg-debug.js)                       | PostgreSQL debug test       |
| [`scripts/manual/test-production.js`](scripts/manual/test-production.js)                   | Production DB test          |
| [`scripts/manual/test-simple.js`](scripts/manual/test-simple.js)                           | Simple connection test      |
| [`scripts/manual/test-tcp-socket.js`](scripts/manual/test-tcp-socket.js)                   | TCP socket test             |
| [`scripts/manual/test-minimal.js`](scripts/manual/test-minimal.js)                         | Minimal connection test     |
| [`scripts/manual/test-dns.js`](scripts/manual/test-dns.js)                                 | DNS resolution test         |
| [`scripts/manual/test-threat-sorting.js`](scripts/manual/test-threat-sorting.js)           | Threat sorting test         |
| [`scripts/manual/test-scroll-preservation.js`](scripts/manual/test-scroll-preservation.js) | UI scroll preservation test |

---

## Shell Scripts

Located in [`scripts/shell/`](scripts/shell/)

| Script                                                             | Description                  |
| ------------------------------------------------------------------ | ---------------------------- |
| [`scripts/shell/run-migration.sh`](scripts/shell/run-migration.sh) | Shell wrapper for migrations |
| [`scripts/shell/start-server.sh`](scripts/shell/start-server.sh)   | Server startup script        |

---

## AWS Deployment Scripts

See [`deploy/aws/scripts/`](deploy/aws/scripts/)

| Script                                                                                           | Description             |
| ------------------------------------------------------------------------------------------------ | ----------------------- |
| [`deploy/aws/scripts/add-ip-access.sh`](deploy/aws/scripts/add-ip-access.sh)                     | Add IP to access list   |
| [`deploy/aws/scripts/build-containers.sh`](deploy/aws/scripts/build-containers.sh)               | Build Docker containers |
| [`deploy/aws/scripts/scs_rebuild.sh`](deploy/aws/scripts/scs_rebuild.sh)                         | Deploy from GitHub      |
| [`deploy/aws/scripts/deploy-full-stack.sh`](deploy/aws/scripts/deploy-full-stack.sh)             | Full stack deployment   |
| [`deploy/aws/scripts/deploy-postgres.sh`](deploy/aws/scripts/deploy-postgres.sh)                 | PostgreSQL deployment   |
| [`deploy/aws/scripts/init-admin-user.sh`](deploy/aws/scripts/init-admin-user.sh)                 | Initialize admin user   |
| [`deploy/aws/scripts/launch-shadowcheck-spot.sh`](deploy/aws/scripts/launch-shadowcheck-spot.sh) | Launch spot instance    |
| [`deploy/aws/scripts/list-authorized-ips.sh`](deploy/aws/scripts/list-authorized-ips.sh)         | List authorized IPs     |
| [`deploy/aws/scripts/open-public-access.sh`](deploy/aws/scripts/open-public-access.sh)           | Open public access      |
| [`deploy/aws/scripts/quick-deploy.sh`](deploy/aws/scripts/quick-deploy.sh)                       | Quick deployment        |
| [`deploy/aws/scripts/setup-git-on-ec2.sh`](deploy/aws/scripts/setup-git-on-ec2.sh)               | Setup Git on EC2        |
| [`deploy/aws/scripts/upload-project.sh`](deploy/aws/scripts/upload-project.sh)                   | Upload project          |

---

## Homelab Scripts

See [`deploy/homelab/scripts/`](deploy/homelab/scripts/)

| Script                                                               | Description   |
| -------------------------------------------------------------------- | ------------- |
| [`deploy/homelab/scripts/setup.sh`](deploy/homelab/scripts/setup.sh) | Homelab setup |

---

## ETL Scripts

See [`etl/`](etl/) directory.

### Pipeline Scripts

| Script                                       | Description              |
| -------------------------------------------- | ------------------------ |
| [`etl/run-pipeline.ts`](etl/run-pipeline.ts) | Main ETL pipeline runner |

### Load Scripts

| Script                                                                           | Description               |
| -------------------------------------------------------------------------------- | ------------------------- |
| [`etl/load/json-import.ts`](etl/load/json-import.ts)                             | JSON data import          |
| [`etl/load/sqlite-import.ts`](etl/load/sqlite-import.ts)                         | SQLite import             |
| [`etl/load/sqlite-import-incremental.ts`](etl/load/sqlite-import-incremental.ts) | Incremental SQLite import |

### Transform Scripts

| Script                                                                               | Description            |
| ------------------------------------------------------------------------------------ | ---------------------- |
| [`etl/transform/deduplicate.ts`](etl/transform/deduplicate.ts)                       | Deduplication          |
| [`etl/transform/enrich-geocoding.ts`](etl/transform/enrich-geocoding.ts)             | Geocoding enrichment   |
| [`etl/transform/normalize-observations.ts`](etl/transform/normalize-observations.ts) | Normalize observations |

### Promote Scripts

| Script                                                           | Description                |
| ---------------------------------------------------------------- | -------------------------- |
| [`etl/promote/refresh-mviews.ts`](etl/promote/refresh-mviews.ts) | Refresh materialized views |
| [`etl/promote/run-scoring.ts`](etl/promote/run-scoring.ts)       | Run threat scoring         |
| [`etl/promote/validate-data.ts`](etl/promote/validate-data.ts)   | Validate data              |

---

## Docker Helper Commands

From [`package.json`](package.json):

```bash
# Start Docker containers
npm run docker:up

# Stop Docker containers
npm run docker:down
```

---

## Best Practices

### Running Scripts

1. **Check environment variables**: Many scripts require `.env` to be configured
2. **Run in correct order**: For ETL scripts, follow the documented order
3. **Check logs**: Scripts typically output to stdout/stderr

### Error Handling

- Most scripts return non-zero exit codes on failure
- Check script output for error messages
- Review logs in `logs/` directory

### Performance

- For large data operations, consider running during off-peak hours
- Use `turbo-import.ts` for large Wigle imports
- Monitor memory usage with batch scripts

---

## Related Documentation

- [ETL Documentation](etl/README.md)
- [Database Schema](DATABASE_SCHEMA_ENTITIES.md)
- [Deployment Guide](DEPLOYMENT.md)
- [AWS Infrastructure](deploy/aws/docs/AWS_INFRASTRUCTURE.md)
- [Development Guide](DEVELOPMENT.md)
