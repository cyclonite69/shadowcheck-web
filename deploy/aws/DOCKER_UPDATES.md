# AWS Docker Configuration Updates

## Summary

Updated AWS deployment Docker files to match local development setup with PgAdmin Docker socket support and Redis caching.

## Changes Made

### 1. deploy/aws/docker/Dockerfile.backend

**Updated to match local Dockerfile with:**

- Multi-stage build with proper TypeScript compilation
- Docker CLI and docker-compose tools
- su-exec for privilege dropping
- Custom entrypoint for Docker socket permission handling
- PostgreSQL client tools
- AWS CLI for S3 backups
- Proper directory structure and permissions
- Health check configuration

**Key additions:**

```dockerfile
# Install Docker CLI tools for PgAdmin management
RUN apk add --no-cache dumb-init postgresql-client aws-cli docker-cli docker-cli-compose su-exec

# Copy infrastructure files and entrypoint
COPY --chown=nodejs:nodejs docker/infrastructure ./docker/infrastructure/
COPY --chown=root:root docker/entrypoint.sh /entrypoint.sh

# Use custom entrypoint for Docker socket permissions
ENTRYPOINT ["/entrypoint.sh"]
```

### 2. deploy/aws/docker/docker-compose.fullstack.yml

**Updated to include:**

- Redis service with persistence and health checks
- Docker socket mount for PgAdmin management
- Volume mounts for data, logs, and backups
- Environment variables for AWS and Redis
- Proper service dependencies with health checks
- ADMIN_ALLOW_DOCKER environment variable

**Key additions:**

```yaml
redis:
  image: redis:7-alpine
  container_name: shadowcheck_redis
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']

backend:
  volumes:
    - ./data:/app/data
    - ./logs:/app/logs
    - ./backups:/app/backups
    - /var/run/docker.sock:/var/run/docker.sock
  environment:
    REDIS_HOST: shadowcheck_redis
    REDIS_PORT: 6379
    ADMIN_ALLOW_DOCKER: ${ADMIN_ALLOW_DOCKER:-false}
  depends_on:
    redis:
      condition: service_healthy
```

## Features Now Available in AWS Deployment

### PgAdmin Management

- Admin panel can start/stop PgAdmin containers
- Docker socket permissions handled automatically by entrypoint
- No manual GID configuration needed

### Redis Caching

- Session storage
- API response caching
- Rate limiting
- Persistent data with AOF

### AWS Integration

- S3 backup support
- AWS CLI available in container
- Environment variables for AWS credentials

### Improved Reliability

- Health checks for all services
- Proper service dependencies
- Graceful shutdown with dumb-init
- Non-root user execution

## Deployment Instructions

### Build Backend Image

```bash
cd /path/to/shadowcheck-static
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
```

### Deploy with Docker Compose

```bash
cd deploy/aws/docker

# Set environment variables
export DB_PASSWORD="your_db_password"
export ADMIN_ALLOW_DOCKER=true

# Start all services
docker-compose -f docker-compose.fullstack.yml --profile backend --profile frontend up -d

# Or start individually
docker-compose -f docker-compose.fullstack.yml up -d redis
docker-compose -f docker-compose.fullstack.yml --profile backend up -d
docker-compose -f docker-compose.fullstack.yml --profile frontend up -d
```

### Verify Deployment

```bash
# Check all services
docker-compose -f docker-compose.fullstack.yml ps

# Check backend logs
docker logs shadowcheck_backend

# Check Redis
docker exec shadowcheck_redis redis-cli ping

# Test Docker socket access
docker exec shadowcheck_backend docker ps

# Check health
curl http://localhost:3001/health
```

## Environment Variables

Add to your AWS `.env` file:

```bash
# Database
DB_PASSWORD=your_secure_password

# Redis (optional, defaults shown)
REDIS_HOST=shadowcheck_redis
REDIS_PORT=6379

# AWS (optional)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=your-bucket-name

# Admin Docker Controls
ADMIN_ALLOW_DOCKER=true
```

## Differences from Local Setup

### Local (docker-compose.yml)

- Uses external `shadowcheck_net` network
- Connects to shared PostgreSQL container
- Development-friendly volume mounts
- Keyring integration for secrets

### AWS (docker-compose.fullstack.yml)

- Creates its own bridge network
- Includes PostgreSQL in compose file
- Production-optimized settings
- Environment variable-based secrets

## Migration Notes

If migrating from old AWS setup:

1. **Rebuild backend image** with new Dockerfile
2. **Update compose file** to include Redis
3. **Add environment variables** for Redis and Docker
4. **Mount Docker socket** if using PgAdmin management
5. **Create volume directories** for data/logs/backups

## Troubleshooting

### PgAdmin Controls Not Working

```bash
# Check Docker socket permissions
docker exec shadowcheck_backend ls -la /var/run/docker.sock

# Check user groups
docker exec shadowcheck_backend id

# Check environment variable
docker exec shadowcheck_backend env | grep ADMIN_ALLOW_DOCKER
```

### Redis Connection Issues

```bash
# Check Redis is running
docker exec shadowcheck_redis redis-cli ping

# Check network connectivity
docker exec shadowcheck_backend ping shadowcheck_redis

# Check Redis logs
docker logs shadowcheck_redis
```

### Build Issues

```bash
# Clean build
docker build --no-cache -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .

# Check build context
docker build -f deploy/aws/docker/Dockerfile.backend --progress=plain -t shadowcheck/backend:latest .
```

## Next Steps

1. Test deployment on AWS EC2 instance
2. Update deployment scripts to use new compose file
3. Document Redis configuration options
4. Add monitoring for Redis and Docker socket access
5. Consider adding nginx reverse proxy for production
