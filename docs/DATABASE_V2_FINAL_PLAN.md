# ShadowCheck Database V2 - Final Comprehensive Plan

## 📚 Complete Documentation Set

1. **DATABASE_V2_SUMMARY.md** - Quick reference
2. **DATABASE_DESIGN_V2.md** - Core principles and conventions
3. **DATABASE_SCHEMA_ENTITIES.md** - Core tables (networks, observations, devices, tags)
4. **DATABASE_SCHEMA_IMPORT.md** - Import tracking, enrichment, trilateration
5. **DATABASE_SCHEMA_ANALYTICS.md** - Materialized views for dashboards
6. **DATABASE_SCHEMA_FUNCTIONS.md** - Stored procedures
7. **DATABASE_SCHEMA_TRIGGERS.md** - Automation and data quality
8. **archive/legacy-html/DATABASE_IMPLEMENTATION_PLAN.md** - 10-phase rollout (archived)
9. **DATABASE_CROSS_REPO_INTEGRATION.md** - Multi-repo architecture
10. **DATABASE_KEYRING_MAPS.md** - Security and visualization
11. **This file** - Final consensus checklist

## 🎯 Key Decisions Made

### Architecture

✅ PostgreSQL 18 + PostGIS 3.4 (shared across all repos)
✅ MACADDR native type for MAC addresses
✅ GEOGRAPHY for real-world distances, GEOMETRY for operations
✅ JSONB for flexible metadata with GIN indexes
✅ Partitioned observations table (monthly)
✅ Materialized views for analytics
✅ Clean Architecture pattern (from ShadowCheckPentest)

### Cross-Repository Integration

✅ **ShadowCheckStatic** - Web dashboard (Node.js/Express)
✅ **ShadowCheckPentest** - Active scanning (Python/SQLAlchemy)
✅ **ShadowCheckMobile** - Wardriving (Kotlin/Room → sync to PostgreSQL)
✅ Single shared database: `shadowcheck_postgres:5432/shadowcheck_db`

### Security (NO HARDCODED SECRETS)

✅ All API keys in system keyring
✅ Database password from keyring
✅ Map tokens (Mapbox, Google) from keyring
✅ WiGLE API keys from keyring
✅ Geocoding API keys from keyring
✅ .env files in .gitignore
✅ Python keyring library for all repos

### Map Visualization

✅ Mapbox GL JS (primary)
✅ Google Maps
✅ Google Earth (KML export)
✅ Kepler.gl for time-series visualization
✅ GeoJSON API endpoint for all maps

### Import Sources

✅ WiGLE Wardriving App (CSV)
✅ WiGLE API v2 (JSON)
✅ WiGLE API v3 Alpha (JSON)
✅ Kismet (SQLite sidecar sync)
✅ ShadowCheckPentest (direct SQLAlchemy)
✅ ShadowCheckMobile (HTTP sync API)

### Performance Features

✅ Table partitioning (observations by month)
✅ Auto-create partitions via trigger
✅ GiST indexes for spatial queries
✅ BRIN indexes for time-series
✅ GIN indexes for JSONB and arrays
✅ Materialized views refresh every 15 minutes
✅ Triggers for auto-calculation (trilateration, scoring)
✅ Connection pooling

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Import Sources                            │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ WiGLE App    │ WiGLE API    │ Kismet       │ Mobile App     │
│ (CSV)        │ (v2/v3 JSON) │ (SQLite)     │ (Room sync)    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Import Functions   │
                    │  (PostgreSQL)       │
                    └──────────┬──────────┘
                               │
                               ▼
       ┌───────────────────────────────────────────────┐
       │         Core Tables (app schema)              │
       ├─────────────┬─────────────┬──────────────────┤
       │  networks   │observations │  devices         │
       │network_tags │  imports    │  enrichments     │
       └──────┬──────┴─────┬───────┴──────┬───────────┘
              │            │              │
              └────────────┴──────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Triggers & Functions  │
              │  - Trilateration       │
              │  - Threat scoring      │
              │  - Statistics update   │
              └────────┬───────────────┘
                       │
                       ▼
              ┌────────────────────────┐
              │  Materialized Views    │
              │  (analytics schema)    │
              └────────┬───────────────┘
                       │
       ┌───────────────┴───────────────┐
       │                               │
       ▼                               ▼
┌──────────────┐              ┌──────────────┐
│ Web Dashboard│              │ Map Layers   │
│ (Static)     │              │ (Mapbox/etc) │
└──────────────┘              └──────────────┘
```

## ✅ Pre-Implementation Checklist

### Infrastructure

- [x] PostgreSQL 18 + PostGIS 3.4 running in Docker
- [x] Database `shadowcheck_db` created
- [x] User `shadowcheck_user` created
- [x] Password stored in keyring
- [x] pgAdmin configured
- [ ] Backup strategy implemented
- [ ] WAL archiving configured

### Security

- [x] Keyring library installed
- [x] Database password in keyring
- [ ] Mapbox token in keyring
- [ ] Google Maps API key in keyring
- [ ] WiGLE API key in keyring
- [ ] Geocoding API keys in keyring
- [ ] .env in .gitignore
- [ ] No secrets in git history

### Code Preparation

- [ ] Create git branch `database-v2`
- [ ] Create `utils/keyring.js` helper
- [ ] Update `server.js` to use keyring
- [ ] Create `sql/v2/` directory for migrations
- [ ] Backup current database schema

### Documentation Review

- [ ] All team members reviewed design docs
- [ ] Consensus on schema design
- [ ] Consensus on naming conventions
- [ ] Consensus on cross-repo integration
- [ ] Timeline agreed upon

## 🚀 Implementation Timeline

### Week 1: Core Schema

**Days 1-2:** Core tables

- Create schemas (app, analytics, import, audit)
- Create networks table with PostGIS
- Create observations table (partitioned)
- Create devices table
- Create network_tags table
- Create imports table
- Test basic CRUD operations

**Days 3-4:** Supporting tables

- Create enrichments table
- Create ap_locations table
- Create tracked_devices table
- Create baselines table
- Create scans table
- Create ml_models table

**Day 5:** Functions

- upsert_network()
- calculate_threat_score()
- calculate_ap_location()
- import_wigle_csv()
- find_networks_near()
- get_network_movement()

### Week 2: Automation & Analytics

**Days 1-2:** Triggers

- Timestamp triggers
- Audit trail triggers
- Geography auto-population
- Trilateration triggers
- Statistics triggers
- ML auto-scoring
- Validation triggers

**Days 3-4:** Materialized Views

- network_stats
- daily_activity
- threat_dashboard
- manufacturer_stats
- geospatial_heatmap
- enrichment_coverage
- Refresh function

**Day 5:** Import ETL

- WiGLE CSV importer
- WiGLE API v2 importer
- WiGLE API v3 importer
- Kismet sync script
- Mobile sync API

### Week 3: Integration & Testing

**Days 1-2:** API Updates

- Update server.js endpoints
- Create GeoJSON endpoint
- Create KML export endpoint
- Update frontend queries
- Keyring integration

**Days 3-4:** Map Integration

- Mapbox GL JS setup
- Google Maps setup
- Kepler.gl setup
- Google Earth KML export
- Test all visualizations

**Day 5:** Cross-repo Integration

- ShadowCheckPentest connection
- ShadowCheckMobile sync API
- Test data flow
- Verify referential integrity

### Week 4: Migration & Production

**Days 1-2:** Data Migration

- Export V1 data
- Transform to V2 schema
- Import with validation
- Verify data integrity

**Days 3-4:** Backup & Monitoring

- Setup daily backups
- Configure WAL archiving
- Setup monitoring
- Performance tuning

**Day 5:** Documentation & Training

- Update README
- Create user guides
- Team training
- Go live!

## 🎬 Ready to Execute?

### Immediate Next Steps

1. **Review all documentation** (10 files)
2. **Get team consensus** on design
3. **Copy SQLite database** to project (if exists)
4. **Setup all API keys** in keyring
5. **Create git branch** `database-v2`
6. **Start Phase 1** - Core schema migration

### Questions to Answer

1. Where is the SQLite database to import?
2. Do you have WiGLE API v3 alpha access?
3. What's the Mapbox token?
4. What's the Google Maps API key?
5. Any other API keys needed?
6. Timeline acceptable? (4 weeks)
7. Any missing requirements?

## 📞 Consensus Required

**Please confirm:**

- [ ] Schema design approved
- [ ] Naming conventions approved
- [ ] Cross-repo integration approved
- [ ] Security approach approved (keyring)
- [ ] Map integrations approved
- [ ] Timeline approved
- [ ] Ready to proceed with Phase 1

**Once confirmed, we'll create the first migration scripts and begin implementation!**

---

## 🆕 UPDATED: Media, Sensors, and Device Metadata

### New Tables Added (DATABASE_SCHEMA_MEDIA_SENSORS.md)

1. **app.scanning_devices** - Track scanning device metadata
   - Device UUID, hardware info, capabilities
   - WiFi/BT chipsets, calibration data
   - GPS accuracy, signal offsets

2. **app.sensor_readings** - Store sensor data (partitioned)
   - Accelerometer, gyroscope, magnetometer, barometer
   - 3-axis values + location context
   - Partitioned by month

3. **app.media_attachments** - Store files IN database
   - Photos, videos, audio, documents
   - Full EXIF metadata, GPS coordinates
   - Binary data (BYTEA), thumbnails
   - SHA256 hash for deduplication
   - Up to 100MB per file

4. **app.device_sessions** - Track scanning sessions
   - Session UUID, type, status
   - Statistics (networks found, distance traveled)
   - Battery consumption tracking
   - Bounding box of session

### Features

✅ Store media files directly in PostgreSQL (BYTEA)
✅ Full EXIF/metadata extraction and storage
✅ Automatic deduplication via SHA256 hash
✅ Thumbnail generation
✅ Sensor data with location context
✅ Device calibration tracking
✅ Session statistics auto-update via triggers

### Storage Strategy

- Files stored as BYTEA (up to 100MB)
- Compression enabled
- Alternative: Large Objects (OID) for >1GB files
- Thumbnails for quick preview
- Hash-based deduplication

### Updated Tables

- **app.observations** - Added device_uuid and session_uuid columns

---

## 🎯 CRITICAL: Full Precision Storage

### Principle: Store Raw, Compute in Views

✅ **All numeric data stored at DOUBLE PRECISION** (IEEE 754)
✅ **No rounding on storage** - preserve exact values from source
✅ **No computed fields in base tables** (except trilateration for performance)
✅ **All statistics computed in views/MVs**

### Data Type Changes

- Coordinates: `NUMERIC(10,7)` → `DOUBLE PRECISION`
- Signal: `INTEGER` → `DOUBLE PRECISION`
- Frequency: `INTEGER` → `DOUBLE PRECISION`
- Accuracy: `NUMERIC(8,2)` → `DOUBLE PRECISION`
- Confidence: `NUMERIC(5,4)` → `DOUBLE PRECISION`
- Sensor values: `REAL` → `DOUBLE PRECISION`

### Removed Computed Fields

**From app.networks:**

- observation_count → Computed in view
- observation_days → Computed in view
- max_signal_dbm → Computed in view
- min_signal_dbm → Computed in view
- avg_signal_dbm → Computed in view

**From app.device_sessions:**

- networks_found → Computed in view
- observations_recorded → Computed in view
- distance_traveled_meters → Computed in view
- media_captured → Computed in view

### Views for Statistics

- `app.network_statistics` - Real-time computed stats
- `app.network_signal_stats` - Signal statistics
- `app.session_stats` - Session statistics
- `analytics.network_stats` (MV) - Cached for performance

See **DATABASE_SCHEMA_PRECISION.md** for complete details.
