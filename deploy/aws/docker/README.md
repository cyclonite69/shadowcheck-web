# ShadowCheck Container Deployment

## Overview

This directory contains Dockerfiles and scripts for building and deploying ShadowCheck containers on AWS without affecting your local development environment.

## Files

- `Dockerfile.backend` - Node.js API server (multi-stage build)
- `Dockerfile.frontend` - React frontend with nginx
- `Dockerfile.postgis` - PostgreSQL 18 + PostGIS 3.6 (already built)
- `nginx-entrypoint.sh` - Frontend container startup script
- `docker-compose.fullstack.yml` - AWS full-stack orchestration
- `docker-compose.simple.yml` - Reduced compose variant for targeted runs

The frontend nginx config lives in `deploy/aws/configs/nginx.conf`.

## Building Containers on AWS

### 1. Upload Project to AWS Instance

```bash
# From your local machine
./deploy/aws/scripts/upload-project.sh
```

This creates a tarball (excluding node_modules, dist, .git) and uploads via S3.

### 2. Build Containers on Instance

```bash
# SSH/SSM into instance
aws ssm start-session --target i-035565c52ac4fa6dd --region us-east-1

# Build containers
cd /home/ssm-user/shadowcheck
./deploy/aws/scripts/build-containers.sh
```

## Running Services Separately

### Backend Only

```bash
docker run -d --name shadowcheck_backend \
  --network shadowcheck_net \
  -e DB_HOST=shadowcheck_postgres \
  -e DB_USER=shadowcheck_user \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=shadowcheck_db \
  -e PORT=3001 \
  -p 3001:3001 \
  shadowcheck/backend:latest
```

### Frontend Only

```bash
docker run -d --name shadowcheck_frontend \
  --network shadowcheck_net \
  -p 80:80 \
  shadowcheck/frontend:latest
```

### Using Docker Compose Profiles

```bash
# Backend only
docker-compose -f deploy/aws/docker/docker-compose.fullstack.yml --profile backend up -d

# Frontend only
docker-compose -f deploy/aws/docker/docker-compose.fullstack.yml --profile frontend up -d

# Both
docker-compose -f deploy/aws/docker/docker-compose.fullstack.yml --profile backend --profile frontend up -d

# With Redis cache
docker-compose -f deploy/aws/docker/docker-compose.fullstack.yml --profile backend --profile cache up -d
```

## Environment Variables

Create `.env` file on AWS instance:

```bash
DB_PASSWORD=your_secure_password
DB_HOST=shadowcheck_postgres
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
PORT=3001
NODE_ENV=production
```

## Container Sizes

- Backend: ~150MB (Node 20 Alpine + compiled TypeScript)
- Frontend: ~50MB (Nginx Alpine + built React app)
- PostgreSQL: ~700MB (Postgres 18 + PostGIS 3.6)

## Networking

All containers use the `shadowcheck_net` bridge network:

- PostgreSQL: `shadowcheck_postgres:5432` (internal only)
- Backend: `shadowcheck_backend:3001` (exposed to host)
- Frontend: `shadowcheck_frontend:80` (exposed to host)

## Security

- Backend runs as non-root user (nodejs:1001)
- Frontend uses nginx with security headers
- PostgreSQL bound to localhost only
- No secrets in images (environment variables only)

## Troubleshooting

### Backend won't connect to database

```bash
# Check network
docker network inspect shadowcheck_net

# Check backend logs
docker logs shadowcheck_backend

# Test database connection
docker exec shadowcheck_backend nc -zv shadowcheck_postgres 5432
```

### Frontend can't reach backend

```bash
# Check nginx config
docker exec shadowcheck_frontend cat /etc/nginx/conf.d/default.conf

# Check backend is running
curl http://localhost:3001/api/health
```

### Build fails on AWS

```bash
# Check disk space
df -h

# Check memory
free -h

# Clean up old images
docker system prune -a
```

## Local Development

**These Dockerfiles are for AWS deployment only.** For local development, continue using:

```bash
npm run dev          # Backend dev server
npm run dev:frontend # Frontend dev server
```

Your local environment remains unchanged.
