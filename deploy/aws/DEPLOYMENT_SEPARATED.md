# AWS EC2 Separated Container Deployment

## Architecture

- **Frontend**: Nginx serving React build (port 80)
- **Backend**: Node.js API with SSM plugin (port 3001)
- **Redis**: Caching layer (port 6379, localhost only)
- **PostgreSQL**: Existing container (shadowcheck_postgres) - NOT rebuilt

## Deployment Steps

### 1. Connect to EC2 Instance

```bash
aws ssm start-session --target i-035565c52ac4fa6dd --region us-east-1
```

### 2. Stop Existing Monolithic Containers

```bash
cd /home/ssm-user/shadowcheck
docker stop shadowcheck_static_api shadowcheck_static_redis 2>/dev/null || true
```

### 3. Pull Latest Code

```bash
git pull origin master
```

### 4. Deploy Separated Containers

```bash
./deploy/aws/scripts/deploy-separated.sh
```

This script will:

- Stop old containers
- Pull latest code
- Build frontend and backend images
- Start separated containers
- Show status

### 5. Verify Deployment

```bash
# Check container status
docker ps

# Check logs
docker-compose -f deploy/aws/docker-compose-aws.yml logs -f

# Test endpoints
curl http://localhost/health        # Frontend
curl http://localhost:3001/health   # Backend
```

## Manual Commands

### Build Individual Images

```bash
# Backend only
docker-compose -f deploy/aws/docker-compose-aws.yml build backend

# Frontend only
docker-compose -f deploy/aws/docker-compose-aws.yml build frontend
```

### Start/Stop Services

```bash
# Start all
docker-compose -f deploy/aws/docker-compose-aws.yml up -d

# Stop all (keeps PostgreSQL running)
docker-compose -f deploy/aws/docker-compose-aws.yml down

# Restart backend only
docker-compose -f deploy/aws/docker-compose-aws.yml restart backend
```

### View Logs

```bash
# All services
docker-compose -f deploy/aws/docker-compose-aws.yml logs -f

# Backend only
docker logs -f shadowcheck_backend

# Frontend only
docker logs -f shadowcheck_frontend
```

## Environment Variables

Set in `/home/ssm-user/shadowcheck/.env`:

```bash
DB_PASSWORD=your_db_password
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
```

## Network Architecture

All containers share `shadowcheck_net` network:

- Frontend → Backend: `http://shadowcheck_backend:3001`
- Backend → PostgreSQL: `shadowcheck_postgres:5432`
- Backend → Redis: `redis:6379`

## Rollback

If deployment fails:

```bash
# Stop new containers
docker-compose -f deploy/aws/docker-compose-aws.yml down

# Restart old monolithic container
docker start shadowcheck_static_api shadowcheck_static_redis
```

## Troubleshooting

### Frontend can't reach backend

- Check nginx.conf proxy settings
- Verify backend container is healthy: `docker ps`

### Backend can't reach PostgreSQL

- Ensure shadowcheck_postgres is running
- Check network: `docker network inspect shadowcheck_net`

### SSM terminal not working

- Verify session-manager-plugin in container: `docker exec shadowcheck_backend which session-manager-plugin`
- Check backend logs for PATH issues
