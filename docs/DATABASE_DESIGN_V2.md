# ShadowCheck Database Design V2

**PostgreSQL 18 + PostGIS 3.4 | SIGINT Forensics Platform**

## Design Principles

### 1. KISS (Keep It Simple, Stupid)

- Normalized schema with clear relationships
- Single source of truth for each data type
- Avoid redundant storage unless for performance (MVs)

### 2. Multi-Source Import Strategy

- **Primary Sources:**
  - WiGLE Wardriving App (CSV export)
  - WiGLE API v2 (JSON)
  - WiGLE API v3 Alpha (JSON)
  - Kismet (SQLite sidecar)
  - ShadowCheckPentest scans
- **Track provenance:** Every record knows its source and import timestamp

### 3. PostgreSQL 18 + PostGIS Best Practices

- Use GEOGRAPHY for real-world distance calculations
- Use GEOMETRY for spatial operations
- Leverage GiST/SP-GiST indexes for spatial queries
- Use BRIN indexes for time-series data
- Partition large tables by time
- Use materialized views for expensive aggregations
- Implement proper constraints and referential integrity

### 4. Naming Conventions

- **Schemas:** `app` (application), `import` (staging), `analytics` (MVs/views)
- **Tables:** snake_case, plural nouns (e.g., `networks`, `observations`)
- **Columns:** snake_case, descriptive (e.g., `first_seen_at`, `signal_dbm`)
- **Indexes:** `idx_{table}_{columns}` or `idx_{table}_{type}_{columns}`
- **Constraints:** `{table}_{column}_{type}` (e.g., `networks_bssid_check`)
- **Functions:** `{verb}_{noun}` (e.g., `calculate_threat_score`)
- **Triggers:** `trg_{table}_{action}` (e.g., `trg_networks_update_timestamp`)

### 5. Performance Strategy

- Offload computation to database (functions, triggers, MVs)
- Use partial indexes for filtered queries
- Implement covering indexes where beneficial
- Use JSONB for flexible metadata (with GIN indexes)
- Partition by time for observations (monthly)
- Use connection pooling (already in server/server.js)

## Schema Organization

### Core Schemas

```sql
app          -- Application tables (networks, devices, observations)
import       -- Staging tables for ETL processes
analytics    -- Materialized views and aggregations
audit        -- Change tracking and data lineage
```

## Data Flow

```
Import Sources → import.* (staging) → ETL Functions → app.* (production)
                                                          ↓
                                                    analytics.* (MVs)
```

## Backup Strategy

1. **Automated pg_dump:** Daily full backup at 2 AM
2. **WAL archiving:** Continuous for PITR
3. **Logical replication:** Optional for HA
4. **Export formats:** SQL, CSV, GeoJSON for portability
5. **Retention:** 30 days rolling, monthly archives for 1 year

## Next Steps

1. Define core entity tables
2. Define relationship tables
3. Define import staging tables
4. Define materialized views
5. Define functions and stored procedures
6. Define triggers
7. Define indexes
8. Create migration scripts
