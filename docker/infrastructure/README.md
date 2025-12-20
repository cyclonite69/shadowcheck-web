# ShadowCheck Shared Infrastructure

This directory contains Docker Compose configuration for shared infrastructure used across multiple ShadowCheck projects.

## Purpose

The `docker-compose.postgres.yml` file defines:

- **PostgreSQL 18 + PostGIS 3.6**: Shared database container
- **PgAdmin 4**: Database management interface
- **Redis**: Optional shared caching layer
- **shadowcheck_net**: Shared Docker network

## Usage

### First-Time Setup

Start the shared infrastructure (PostgreSQL + PgAdmin):

```bash
cd docker/infrastructure
docker-compose -f docker-compose.postgres.yml up -d
```

This creates:

- Container: `shadowcheck_postgres` (PostgreSQL 18 + PostGIS)
- Container: `shadowcheck_pgadmin` (PgAdmin 4)
- Container: `shadowcheck_redis` (Redis 7)
- Network: `shadowcheck_net` (bridge network)
- Volumes: `shadowcheck_postgres_data`, `shadowcheck_pgadmin_data`, `shadowcheck_redis_data`

### Start Application Containers

Once infrastructure is running, start application-specific containers from the project root:

```bash
cd ../../  # Return to project root
docker-compose up -d  # Starts shadowcheck_static_api + shadowcheck_static_redis
```

## Access

- **PostgreSQL**: `localhost:5432`
  - User: `shadowcheck_user` (or value in `.env`)
  - Database: `shadowcheck_db`
  - Password: Set in `.env` as `DB_PASSWORD`

- **PgAdmin**: `http://localhost:5050`
  - Email: `admin@example.com` (or value in `.env`)
  - Password: Set in `.env` as `PGADMIN_PASSWORD`

- **Redis**: `localhost:6379`

## Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DB_USER=shadowcheck_user
DB_PASSWORD=your_secure_password
DB_NAME=shadowcheck_db
DB_PORT=5432

# PgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin_password
PGADMIN_PORT=5050

# Redis
REDIS_PORT=6379
```

## Management Commands

```bash
# View logs
docker-compose -f docker/infrastructure/docker-compose.postgres.yml logs -f postgres

# Stop infrastructure (keeps data)
docker-compose -f docker/infrastructure/docker-compose.postgres.yml down

# Stop and remove volumes (DESTROYS DATA)
docker-compose -f docker/infrastructure/docker-compose.postgres.yml down -v

# Restart PostgreSQL
docker-compose -f docker/infrastructure/docker-compose.postgres.yml restart postgres

# Check health
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user

# Access PostgreSQL shell
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db
```

## Backup & Restore

### Backup

```bash
# Create SQL dump
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user shadowcheck_db > backups/backup-$(date +%Y%m%d).sql

# Or use pg_dump with compression
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user -Fc shadowcheck_db > backups/backup-$(date +%Y%m%d).dump
```

### Restore

```bash
# From SQL file
docker exec -i shadowcheck_postgres psql -U shadowcheck_user shadowcheck_db < backups/backup-20251219.sql

# From compressed dump
docker exec -i shadowcheck_postgres pg_restore -U shadowcheck_user -d shadowcheck_db < backups/backup-20251219.dump
```

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  shadowcheck_net (Docker Bridge Network)                    │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────────────┐   │
│  │ shadowcheck_       │  │ shadowcheck_static_api      │   │
│  │ postgres           │◄─┤ (This Project)              │   │
│  │ (Port 5432)        │  │ Connects via DB_HOST env    │   │
│  └────────────────────┘  └─────────────────────────────┘   │
│           ▲                                                 │
│           │                                                 │
│  ┌────────┴───────────┐  ┌─────────────────────────────┐   │
│  │ shadowcheck_       │  │ Other ShadowCheck Projects  │   │
│  │ pgadmin            │  │ (Mobile, Analytics, etc.)   │   │
│  │ (Port 5050)        │  └─────────────────────────────┘   │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
         │                          │
         │                          │
         ▼                          ▼
   localhost:5050            localhost:5432
   (PgAdmin UI)              (PostgreSQL)
```

## Why Shared Infrastructure?

**Benefits**:

- Single PostgreSQL instance for all ShadowCheck projects
- Consistent database schema across projects
- Easier data sharing and cross-project queries
- Reduced resource usage (one DB vs. multiple)
- Centralized backup strategy

**Trade-offs**:

- All projects share the same database (use schemas/tables to separate)
- Requires infrastructure to be running before applications
- Schema changes affect all connected projects

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker/infrastructure/docker-compose.postgres.yml logs postgres

# Check port conflicts
lsof -i :5432  # PostgreSQL
lsof -i :5050  # PgAdmin

# Remove and recreate
docker-compose -f docker/infrastructure/docker-compose.postgres.yml down
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d
```

### Can't connect to database

```bash
# Verify container is healthy
docker ps | grep shadowcheck_postgres

# Test connection
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user

# Check network
docker network inspect shadowcheck_net

# Verify environment variables
docker exec shadowcheck_postgres env | grep POSTGRES
```

### Permission issues

```bash
# Fix data directory permissions
sudo chown -R 999:999 postgres_data/  # 999 = postgres user in container
```

## Production Considerations

For production deployments:

1. **Use Docker secrets** instead of environment variables
2. **Enable SSL/TLS** for PostgreSQL connections
3. **Configure resource limits** (uncomment in docker-compose.postgres.yml)
4. **Set up automated backups** (cron job with pg_dump)
5. **Use a reverse proxy** (Traefik, Nginx) for PgAdmin
6. **Monitor logs and metrics** (Prometheus, Grafana)
7. **Implement connection pooling** (PgBouncer)

## See Also

- [Project Root README](../../README.md)
- [CLAUDE.md](../../CLAUDE.md) - Development guidance
- [PROJECT_STRUCTURE.md](../../PROJECT_STRUCTURE.md) - Directory organization
- [docs/SHARED_INFRASTRUCTURE.md](../../docs/SHARED_INFRASTRUCTURE.md) - Detailed infrastructure docs

---

**Last Updated**: 2025-12-19
