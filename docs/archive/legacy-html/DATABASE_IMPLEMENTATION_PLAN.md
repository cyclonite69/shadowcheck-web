# ShadowCheck Database V2 - Implementation Plan

## Overview

Complete redesign of ShadowCheck database following KISS principles, PostgreSQL 18 + PostGIS 3.4 best practices, and multi-source import strategy.

## Documentation Structure

1. **DATABASE_DESIGN_V2.md** - Design principles and overview
2. **DATABASE_SCHEMA_ENTITIES.md** - Core entity tables
3. **DATABASE_SCHEMA_IMPORT.md** - Import, audit, and supporting tables
4. **DATABASE_SCHEMA_ANALYTICS.md** - Materialized views
5. **DATABASE_SCHEMA_FUNCTIONS.md** - Functions and stored procedures
6. **DATABASE_SCHEMA_TRIGGERS.md** - Triggers and automation
7. **This file** - Implementation plan and checklist

## Key Features

### Multi-Source Import Support

- ✅ WiGLE Wardriving App (CSV)
- ✅ WiGLE API v2 (JSON)
- ✅ WiGLE API v3 Alpha (JSON)
- ✅ Kismet (SQLite sidecar integration)
- ✅ ShadowCheckPentest scans

### PostgreSQL 18 Features Used

- ✅ Native MACADDR type for MAC addresses
- ✅ GEOGRAPHY/GEOMETRY types (PostGIS)
- ✅ JSONB with GIN indexes
- ✅ Table partitioning (observations by month)
- ✅ Materialized views with CONCURRENTLY refresh
- ✅ Advanced indexing (GiST, BRIN, partial, covering)
- ✅ Triggers for automation
- ✅ Stored procedures for business logic
- ✅ Referential integrity with foreign keys
- ✅ CHECK constraints for data quality
- ✅ pg_notify for real-time alerts

### Performance Optimizations

- ✅ Partitioned observations table (time-series)
- ✅ Materialized views for dashboards
- ✅ GiST indexes for spatial queries
- ✅ BRIN indexes for time-series
- ✅ GIN indexes for JSONB and arrays
- ✅ Partial indexes for filtered queries
- ✅ Triggers offload computation from frontend
- ✅ Connection pooling (already in server.js)

## Implementation Phases

### Phase 1: Core Schema (Day 1)

**Goal:** Basic tables and relationships

```bash
# Run migrations in order:
psql -f sql/v2/01_create_schemas.sql
psql -f sql/v2/02_create_networks.sql
psql -f sql/v2/03_create_observations.sql
psql -f sql/v2/04_create_devices.sql
psql -f sql/v2/05_create_network_tags.sql
psql -f sql/v2/06_create_imports.sql
```

**Tables:**

- app.networks
- app.observations (partitioned)
- app.devices
- app.network_tags
- app.imports

**Deliverable:** Can insert and query basic network data

### Phase 2: Supporting Tables (Day 1-2)

**Goal:** Enrichment, trilateration, tracking

```bash
psql -f sql/v2/07_create_enrichments.sql
psql -f sql/v2/08_create_ap_locations.sql
psql -f sql/v2/09_create_tracked_devices.sql
psql -f sql/v2/10_create_baselines.sql
psql -f sql/v2/11_create_scans.sql
psql -f sql/v2/12_create_ml_models.sql
```

**Tables:**

- app.enrichments
- app.ap_locations
- app.tracked_devices
- app.baselines
- app.scans
- app.ml_models

**Deliverable:** Full data model in place

### Phase 3: Functions (Day 2)

**Goal:** Business logic in database

```bash
psql -f sql/v2/20_functions_network.sql
psql -f sql/v2/21_functions_trilateration.sql
psql -f sql/v2/22_functions_import.sql
psql -f sql/v2/23_functions_geospatial.sql
psql -f sql/v2/24_functions_utility.sql
```

**Functions:**

- upsert_network()
- calculate_threat_score()
- calculate_ap_location()
- import_wigle_csv()
- find_networks_near()
- get_network_movement()

**Deliverable:** Can import data programmatically

### Phase 4: Triggers (Day 2-3)

**Goal:** Automation and data quality

```bash
psql -f sql/v2/30_triggers_timestamps.sql
psql -f sql/v2/31_triggers_audit.sql
psql -f sql/v2/32_triggers_geospatial.sql
psql -f sql/v2/33_triggers_trilateration.sql
psql -f sql/v2/34_triggers_statistics.sql
psql -f sql/v2/35_triggers_ml.sql
psql -f sql/v2/36_triggers_validation.sql
```

**Triggers:**

- Auto-update timestamps
- Audit trail for tags
- Auto-populate geography columns
- Auto-calculate trilateration
- Update network statistics
- Auto-score new networks
- Validate coordinates

**Deliverable:** Self-maintaining database

### Phase 5: Analytics (Day 3)

**Goal:** Materialized views for dashboards

```bash
psql -f sql/v2/40_mv_network_stats.sql
psql -f sql/v2/41_mv_daily_activity.sql
psql -f sql/v2/42_mv_threat_dashboard.sql
psql -f sql/v2/43_mv_manufacturer_stats.sql
psql -f sql/v2/44_mv_geospatial_heatmap.sql
psql -f sql/v2/45_mv_enrichment_coverage.sql
psql -f sql/v2/46_mv_refresh_function.sql
```

**Materialized Views:**

- analytics.network_stats
- analytics.daily_activity
- analytics.threat_dashboard
- analytics.manufacturer_stats
- analytics.geospatial_heatmap
- analytics.enrichment_coverage

**Deliverable:** Fast dashboard queries

### Phase 6: Import ETL (Day 3-4)

**Goal:** Import from all sources

**Scripts to create:**

- scripts/import/wigle_csv.js
- scripts/import/wigle_api_v2.js
- scripts/import/wigle_api_v3.js
- scripts/import/kismet_sync.js
- scripts/import/pentest_sync.js

**Deliverable:** Can import from all sources

### Phase 7: Backup Strategy (Day 4)

**Goal:** Automated backups

```bash
# Create backup scripts
scripts/backup/daily_backup.sh
scripts/backup/wal_archive.sh
scripts/backup/export_geojson.sh

# Setup cron jobs
crontab -e
# 0 2 * * * /path/to/daily_backup.sh
# */15 * * * * /path/to/wal_archive.sh
```

**Deliverable:** Automated backup system

### Phase 8: Migration from V1 (Day 4-5)

**Goal:** Migrate existing data

```bash
psql -f sql/v2/90_migrate_from_v1.sql
```

**Tasks:**

- Export data from current schema
- Transform to new schema
- Import with validation
- Verify data integrity

**Deliverable:** All existing data migrated

### Phase 9: API Updates (Day 5)

**Goal:** Update server.js to use new schema

**Files to update:**

- server.js (API endpoints)
- public/\*.html (frontend queries)

**Deliverable:** Application works with new schema

### Phase 10: Testing & Optimization (Day 5-6)

**Goal:** Performance tuning

**Tasks:**

- Load testing with large datasets
- Query optimization
- Index tuning
- MV refresh scheduling
- Documentation updates

**Deliverable:** Production-ready database

## Rollback Plan

If issues arise:

1. Keep V1 schema in separate schema: `app_v1`
2. Can switch back by updating connection strings
3. Export V2 data before major changes
4. Test migrations on copy of production data

## Success Criteria

- [ ] All import sources working
- [ ] Dashboard loads in < 2 seconds
- [ ] Geospatial queries < 500ms
- [ ] Can handle 1M+ observations
- [ ] Automated backups running
- [ ] Data integrity validated
- [ ] Documentation complete
- [ ] Team trained on new schema

## Next Steps

**Before proceeding:**

1. Review all documentation files
2. Discuss any missing requirements
3. Agree on implementation timeline
4. Create git branch for V2 work
5. Backup current database

**Ready to start?**

- Create Phase 1 migration scripts
- Test on empty database
- Import sample data
- Validate before proceeding to Phase 2
