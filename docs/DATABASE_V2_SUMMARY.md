# ShadowCheck Database V2 - Quick Reference

## 📚 Documentation Files

1. **DATABASE_DESIGN_V2.md** - Principles, naming conventions, backup strategy
2. **DATABASE_SCHEMA_ENTITIES.md** - Core tables (networks, observations, devices, tags)
3. **DATABASE_SCHEMA_IMPORT.md** - Import tracking, enrichment, trilateration, baselines
4. **DATABASE_SCHEMA_ANALYTICS.md** - Materialized views for dashboards
5. **DATABASE_SCHEMA_FUNCTIONS.md** - Stored procedures and functions
6. **DATABASE_SCHEMA_TRIGGERS.md** - Automation and data quality
7. **archive/legacy-html/DATABASE_IMPLEMENTATION_PLAN.md** - 10-phase implementation plan (archived)

## 🎯 Key Design Decisions

### Data Types

- **MACADDR** for MAC addresses (native PostgreSQL type)
- **GEOGRAPHY** for real-world distances
- **GEOMETRY** for spatial operations
- **JSONB** for flexible metadata
- **TIMESTAMPTZ** for all timestamps

### Schemas

- **app** - Application tables
- **import** - Staging tables (future)
- **analytics** - Materialized views
- **audit** - Change tracking (future)

### Partitioning

- **observations** table partitioned by month
- Auto-create partitions via trigger

### Indexes

- **GiST** for spatial queries
- **BRIN** for time-series
- **GIN** for JSONB and arrays
- **Partial** for filtered queries

## 📊 Core Tables

| Table        | Purpose               | Key Features                                |
| ------------ | --------------------- | ------------------------------------------- |
| networks     | WiFi APs              | MACADDR PK, PostGIS location, trilateration |
| observations | Location sightings    | Partitioned, time-series, source tracking   |
| devices      | Client devices        | MAC tracking, associations                  |
| network_tags | Threat classification | ML scores, audit trail                      |
| imports      | Import tracking       | Multi-source, statistics                    |
| enrichments  | Address data          | Multi-API, venue types                      |
| ap_locations | Trilateration         | Calculated positions                        |
| baselines    | Known good networks   | Rogue detection                             |

## 🔧 Key Functions

- `upsert_network()` - Insert/update network with conflict handling
- `calculate_threat_score()` - ML-based threat scoring
- `calculate_ap_location()` - Trilateration from observations
- `import_wigle_csv()` - Bulk import from WiGLE
- `find_networks_near()` - Geospatial search
- `get_network_movement()` - Track mobile APs

## ⚡ Triggers

- Auto-update timestamps
- Audit trail for tag changes
- Auto-populate geography columns
- Auto-calculate trilateration (every 10 observations)
- Update network statistics on new observation
- Auto-score new networks
- Validate coordinates
- Notify on high threats

## 📈 Materialized Views

- `network_stats` - Per-network aggregations
- `daily_activity` - Time-series activity
- `threat_dashboard` - Threat summary
- `manufacturer_stats` - Vendor analysis
- `geospatial_heatmap` - Spatial density
- `enrichment_coverage` - API coverage stats

## 🔄 Import Sources

1. **WiGLE Wardriving App** - CSV export
2. **WiGLE API v2** - JSON
3. **WiGLE API v3 Alpha** - JSON
4. **Kismet** - SQLite sidecar
5. **ShadowCheckPentest** - Live scans

## 🚀 Implementation Timeline

- **Day 1:** Core schema (networks, observations, devices, tags)
- **Day 2:** Supporting tables + functions
- **Day 3:** Triggers + analytics MVs
- **Day 4:** Import ETL + backups
- **Day 5:** Migrate V1 data + API updates
- **Day 6:** Testing + optimization

## ✅ Before Starting

- [ ] Review all 7 documentation files
- [ ] Discuss missing requirements
- [ ] Agree on timeline
- [ ] Create git branch `database-v2`
- [ ] Backup current database
- [ ] Copy SQLite database to project

## 🎬 Ready to Execute?

Once consensus is reached, we'll:

1. Create migration SQL files
2. Test on empty database
3. Import sample data
4. Validate schema
5. Proceed phase by phase
