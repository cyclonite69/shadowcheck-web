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
docker stop shadowcheck_web_api shadowcheck_web_redis 2>/dev/null || true
```

### 3. Pull Latest Code

```bash
git pull origin master
```

### 4. Deploy Separated Containers

Before building or starting the production services, provide at least one exact browser Origin. Production requires `CORS_ORIGINS`; the `*` wildcard is ignored. Origins must match scheme, host, and port exactly, including for same-origin writes (there is no same-origin exemption).

```bash
export CORS_ORIGINS='https://<production-host>'
# If you use the admin UI through an SSM port forward, include its exact Origin too:
# export CORS_ORIGINS='https://<production-host>,http://localhost:<local-forward-port>'
```

For every `docker-compose` command against `deploy/aws/docker-compose-aws.yml` (including build, up, down, restart, logs, and status), keep `CORS_ORIGINS` exported in the shell or pass `--env-file .env`; Compose checks the required variable for every command.

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
docker-compose --env-file .env -f deploy/aws/docker-compose-aws.yml build backend

# Frontend only
docker-compose --env-file .env -f deploy/aws/docker-compose-aws.yml build frontend
```

### Start/Stop Services

```bash
# Start all
docker-compose --env-file .env -f deploy/aws/docker-compose-aws.yml up -d

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

Set in `/home/ssm-user/shadowcheck/.env` or export them in the shell before running the deployment commands. All `docker-compose` commands against `deploy/aws/docker-compose-aws.yml` require `CORS_ORIGINS` exported in the shell or passed with `--env-file .env`.

```bash
DB_PASSWORD=your_db_password
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
CORS_ORIGINS=https://<production-host>
# Add this form only when the browser UI is reached through that local SSM forward:
# CORS_ORIGINS=https://<production-host>,http://localhost:<local-forward-port>
```

After deployment, verify a browser Origin with a preflight request. Send the request to the browser-facing production frontend host on HTTPS port 443; `/api/health` is registered by `server/src/api/routes/v1/health.ts:9` and proxied to the API by `deploy/aws/configs/nginx.conf:97-103`. Replace the placeholder with the exact production host used in the browser:

```bash
curl -i -X OPTIONS 'https://<production-host>/api/health' \
  -H 'Origin: https://<production-host>' \
  -H 'Access-Control-Request-Method: POST'
```

Confirm `Access-Control-Allow-Origin` echoes the Origin. A health check without an Origin header can pass even when browser requests are rejected.

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
docker start shadowcheck_web_api shadowcheck_web_redis
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
