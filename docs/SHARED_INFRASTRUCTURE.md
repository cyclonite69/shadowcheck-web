# Shared Infrastructure Guide

This document explains how ShadowCheck projects share PostgreSQL and PgAdmin infrastructure.

## Architecture

All ShadowCheck projects connect to **shared** Docker containers:

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Network: shadowcheck_net            │
│                                                               │
│  ┌──────────────────────┐    ┌──────────────────────┐      │
│  │ shadowcheck_postgres │◄───┤ ShadowCheckStatic    │      │
│  │ (PostGIS 16-3.4)     │    │ (Node.js/Express)    │      │
│  │ Port: 5432           │    │ Port: 3001           │      │
│  └──────────────────────┘    └──────────────────────┘      │
│           ▲                                                  │
│           │                                                  │
│           │                   ┌──────────────────────┐      │
│           └───────────────────┤ ShadowCheckPentest   │      │
│                               │ (Python/FastAPI)     │      │
│                               │ Port: 8000           │      │
│                               └──────────────────────┘      │
│                                                               │
│  ┌──────────────────────┐                                   │
│  │ shadowcheck_pgadmin  │                                   │
│  │ Port: 5050           │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

## Current Shared Containers

### PostgreSQL

- **Container**: `shadowcheck_postgres`
- **Image**: `postgis/postgis:16-3.4`
- **Port**: 5432
- **Network**: `shadowcheck_net`
- **Extensions**: PostGIS for geospatial queries

### PgAdmin

- **Container**: `shadowcheck_pgadmin`
- **Image**: `dpage/pgadmin4:latest`
- **Port**: 5050
- **Access**: http://localhost:5050

## Database Schema

All projects use the same database: `shadowcheck`

### Shared Tables

```sql
-- Core schema
app.networks_legacy         -- Network metadata (WiFi, BLE, Cellular)
app.locations_legacy        -- Observation records
app.network_tags            -- User classifications
app.location_markers        -- Home/work locations
app.radio_manufacturers     -- MAC OUI lookup

-- Enrichment
app.wigle_networks_enriched -- WiGLE API data
app.ap_addresses            -- Venue names
app.ap_locations            -- Trilateration results
```

## Connecting ShadowCheckStatic

### 1. Join Existing Network

First, ensure the `shadowcheck_net` network exists:

```bash
# Check existing networks
docker network ls | grep shadowcheck

# If shadowcheck_net doesn't exist, create it:
docker network create shadowcheck_net

# Connect existing containers to network (if needed)
docker network connect shadowcheck_net shadowcheck_postgres
docker network connect shadowcheck_net shadowcheck_pgadmin
```

### 2. Start ShadowCheckStatic API

```bash
# Start only the API (connects to existing postgres)
docker-compose up -d api

# View logs
docker-compose logs -f api

# Check connection
curl http://localhost:3001/api/dashboard-metrics
```

### 3. Verify Connection

```bash
# Check containers on network
docker network inspect shadowcheck_net

# Should show:
# - shadowcheck_postgres
# - shadowcheck_pgadmin
# - shadowcheck_static_api
# - shadowcheck_pentest_api (if running)
```

## Project-Specific Services

Each project has its own:

- **API Container** (different ports)
- **Redis Cache** (optional, project-specific)
- **Application Code** (mounted volumes)

## Configuration

### ShadowCheckStatic (.env)

```env
# Database - connects to SHARED container
DB_HOST=shadowcheck_postgres
DB_PORT=5432
DB_USER=shadowcheck_user
DB_PASSWORD=your_password
DB_NAME=shadowcheck

# API Port - unique per project
PORT=3001

# Redis - project-specific
REDIS_HOST=shadowcheck_static_redis
REDIS_PORT=6379
```

### ShadowCheckPentest (.env)

```env
# Database - same SHARED container
DB_HOST=shadowcheck_postgres
DB_PORT=5432
DB_USER=shadowcheck_user
DB_PASSWORD=your_password
DB_NAME=shadowcheck

# API Port - different from Static
PORT=8000

# Redis - different instance
REDIS_HOST=shadowcheck_pentest_redis
REDIS_PORT=6379
```

## Port Allocation

| Service         | Container                 | Port | Project            |
| --------------- | ------------------------- | ---- | ------------------ |
| PostgreSQL      | shadowcheck_postgres      | 5432 | Shared             |
| PgAdmin         | shadowcheck_pgadmin       | 5050 | Shared             |
| API (Static)    | shadowcheck_static_api    | 3001 | ShadowCheckStatic  |
| API (Pentest)   | shadowcheck_pentest_api   | 8000 | ShadowCheckPentest |
| Redis (Static)  | shadowcheck_static_redis  | 6379 | ShadowCheckStatic  |
| Redis (Pentest) | shadowcheck_pentest_redis | 6380 | ShadowCheckPentest |

## Managing Shared Infrastructure

### Starting All Projects

```bash
# 1. Ensure PostgreSQL and PgAdmin are running
docker ps | grep -E "shadowcheck_postgres|shadowcheck_pgadmin"

# 2. Start ShadowCheckStatic
cd ~/ShadowCheckStatic
docker-compose up -d

# 3. Start ShadowCheckPentest
cd ~/ShadowCheckPentest
docker-compose up -d

# 4. Verify all services
docker ps
curl http://localhost:3001/api/dashboard-metrics  # Static
curl http://localhost:8000/api/v1/networks       # Pentest
```

### Stopping Projects (Keep Database Running)

```bash
# Stop ShadowCheckStatic API only
cd ~/ShadowCheckStatic
docker-compose down

# Stop ShadowCheckPentest API only
cd ~/ShadowCheckPentest
docker-compose down

# PostgreSQL and PgAdmin continue running
```

### Restart Database (Affects All Projects)

```bash
# Restart PostgreSQL
docker restart shadowcheck_postgres

# Wait for ready
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user

# All APIs will reconnect automatically
```

## Database Migrations

Run migrations once - they apply to all projects:

```bash
# Connect to database
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck

# Run migration
\i /path/to/migration.sql

# Or from host
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck < migration.sql
```

## PgAdmin Access

Access shared PgAdmin at: http://localhost:5050

**Server Configuration**:

- Host: `shadowcheck_postgres` (Docker container name)
- Port: `5432`
- Username: `shadowcheck_user`
- Password: (from .env)
- Database: `shadowcheck`

**Note**: When adding server in PgAdmin, use `shadowcheck_postgres` as hostname (not `localhost`).

## Troubleshooting

### API Can't Connect to Database

```bash
# Check if containers are on same network
docker network inspect shadowcheck_net

# If API not connected, add it manually
docker network connect shadowcheck_net shadowcheck_static_api

# Restart API
docker-compose restart api
```

### Database Connection Refused

```bash
# Check PostgreSQL is running
docker ps | grep shadowcheck_postgres

# Check PostgreSQL logs
docker logs shadowcheck_postgres

# Test connection from API container
docker exec shadowcheck_static_api nc -zv shadowcheck_postgres 5432
```

### Port Conflicts

```bash
# Check what's using the port
lsof -i :3001

# Change port in .env
PORT=3002

# Restart
docker-compose down && docker-compose up -d
```

## Best Practices

### 1. Database Credentials

- Use same credentials across all projects
- Store in `.env` file (gitignored)
- Use keyring for production

### 2. Network Management

- All ShadowCheck containers should be on `shadowcheck_net`
- Don't create project-specific PostgreSQL instances
- Use external network definition in docker-compose

### 3. Data Isolation

- All projects share same database tables
- Use application-level logic to filter data if needed
- Consider adding `project_source` column for tracking

### 4. Backup Strategy

- Backup shared PostgreSQL container
- One backup covers all projects
- Schedule: `pg_dump -U shadowcheck_user shadowcheck > backup.sql`

### 5. Monitoring

- Monitor shared PostgreSQL performance
- All projects contribute to DB load
- Use `pg_stat_activity` to track connections

```sql
-- Check active connections by application
SELECT application_name, count(*)
FROM pg_stat_activity
WHERE datname = 'shadowcheck'
GROUP BY application_name;
```

## Migration from Standalone to Shared

If you previously had project-specific databases:

```bash
# 1. Export data from old database
pg_dump -U old_user -d old_db > old_data.sql

# 2. Import to shared database
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck < old_data.sql

# 3. Update .env to point to shared container
DB_HOST=shadowcheck_postgres

# 4. Remove old database container
docker stop old_postgres_container
docker rm old_postgres_container

# 5. Test connection
curl http://localhost:3001/api/dashboard-metrics
```

## Summary

- ✅ **One PostgreSQL** for all ShadowCheck projects
- ✅ **One PgAdmin** for database management
- ✅ **Shared network** (`shadowcheck_net`)
- ✅ **Project-specific APIs** (different ports)
- ✅ **Optional Redis per project** (different ports)

This architecture:

- Reduces resource usage
- Simplifies backup/restore
- Enables cross-project queries
- Maintains data consistency

---

**Last Updated**: 2025-12-02
