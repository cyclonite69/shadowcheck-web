# ShadowCheck AWS Deployment - Complete Guide

## 🎉 Deployment Complete!

**Access your application:**

- Frontend: http://13.216.239.240
- Backend API: http://13.216.239.240:3001

## Quick Deployment (One Command)

From your local machine:

```bash
# Deploy everything from scratch
./deploy/aws/scripts/deploy-full-stack.sh
```

Or on the AWS instance:

```bash
# Quick redeploy (containers already built)
./deploy/aws/scripts/quick-deploy.sh <your_mapbox_token>
```

## What Was Deployed

### Infrastructure

- **EC2 Instance**: t4g.large ARM64 (Graviton)
- **Storage**: 30GB XFS-formatted EBS volume
- **Network**: VPC with security groups (ports 22, 80, 3001, 5432)
- **IAM**: EC2-SSM-Role with S3ReadOnlyAccess

### Containers

1. **PostgreSQL 18 + PostGIS 3.6** (699MB)
   - Custom ARM64 image
   - 179,844 networks restored
   - 570,609 observations restored
   - 172,575 access points restored
   - Persistent XFS volume at `/var/lib/postgresql`

2. **Backend API** (397MB)
   - Node.js 20 + TypeScript
   - Express REST API
   - Host network for localhost DB access
   - Environment: production

3. **Frontend** (72MB)
   - React + Vite build
   - Nginx Alpine
   - Host network for localhost API access
   - Security headers enabled

## Architecture

```
Internet
    ↓
[Security Group: 80, 3001]
    ↓
EC2 Instance (ARM64)
    ├── Frontend (Nginx) :80
    │   └── Proxies /api/* → localhost:3001
    ├── Backend (Node.js) :3001
    │   └── Connects to localhost:5432
    └── PostgreSQL :5432 (localhost only)
        └── XFS Volume: /var/lib/postgresql
```

## Environment Variables Required

### Backend

- `NODE_ENV=production`
- `PORT=3001`
- `DB_HOST=127.0.0.1`
- `DB_USER=shadowcheck_user`
- `DB_PASSWORD=<from_postgres_container>`
- `DB_NAME=shadowcheck_db`
- `MAPBOX_TOKEN=<your_token>`

### Frontend

- None (proxies to backend)

## Manual Deployment Steps

If you need to deploy manually:

### 1. Clone Repository

```bash
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck
cd shadowcheck
```

### 2. Build Containers

```bash
# Backend
docker build -f deploy/aws/docker/Dockerfile.backend \
  -t shadowcheck/backend:latest .

# Frontend
docker build -f deploy/aws/docker/Dockerfile.frontend \
  -t shadowcheck/frontend:latest .
```

### 3. Deploy Containers

```bash
# Get DB password
export DB_PASSWORD=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD)
export MAPBOX_TOKEN=your_mapbox_token_here

# Backend
docker run -d --name shadowcheck_backend \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e DB_HOST=127.0.0.1 \
  -e DB_USER=shadowcheck_user \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=shadowcheck_db \
  -e MAPBOX_TOKEN=$MAPBOX_TOKEN \
  --restart unless-stopped \
  shadowcheck/backend:latest

# Frontend
docker run -d --name shadowcheck_frontend \
  --network host \
  --restart unless-stopped \
  shadowcheck/frontend:latest
```

## Verification

```bash
# Check containers
docker ps | grep shadowcheck

# Test backend
curl http://localhost:3001/api/health

# Test frontend
curl http://localhost:80

# Check logs
docker logs shadowcheck_backend
docker logs shadowcheck_frontend
docker logs shadowcheck_postgres
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker logs shadowcheck_backend

# Common issues:
# 1. Missing MAPBOX_TOKEN
# 2. Wrong DB_PASSWORD
# 3. PostgreSQL not running
```

### Frontend shows 502 Bad Gateway

```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Check nginx config
docker exec shadowcheck_frontend cat /etc/nginx/conf.d/default.conf
```

### Database connection failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT COUNT(*) FROM networks;"
```

## Updating the Application

```bash
cd /home/ssm-user/shadowcheck
git pull

# Rebuild containers
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# Restart
docker stop shadowcheck_backend shadowcheck_frontend
docker rm shadowcheck_backend shadowcheck_frontend

# Redeploy (use quick-deploy.sh script)
./deploy/aws/scripts/quick-deploy.sh $MAPBOX_TOKEN
```

## Key Lessons Learned

1. **Alpine images work on ARM64** - node:20-alpine and nginx:alpine have native ARM64 support
2. **Host networking simplifies deployment** - No need for custom Docker networks when everything runs on localhost
3. **Build on target architecture** - Building directly on ARM64 is faster than cross-compilation
4. **Use --ignore-scripts** - Prevents husky and other dev tools from running in production builds
5. **Create directories before USER switch** - nodejs user needs write permissions for logs
6. **Environment variables for secrets** - Don't bake secrets into images
7. **Use npm scripts** - They know the correct paths (build:frontend vs build)
8. **TypeScript output paths matter** - dist/server/server/server.js not dist/server.js

## Cost Breakdown

- **EC2 t4g.large Spot**: ~$0.03/hour = $21.60/month
- **30GB EBS gp3**: $2.40/month
- **Data transfer**: ~$1/month (minimal)
- **Total**: ~$25/month

## Security Checklist

- [x] PostgreSQL bound to localhost only
- [x] Security groups restrict access
- [x] SCRAM-SHA-256 authentication
- [x] No passwords in logs
- [x] Docker log rotation
- [x] Non-root container users
- [x] Security headers on frontend
- [x] Secrets via environment variables
- [x] Regular password rotation (60-90 days)

## Next Steps

1. **Set up SSL/TLS** - Use Let's Encrypt with Caddy or Certbot
2. **Configure domain** - Point DNS to 13.216.239.240
3. **Set up monitoring** - CloudWatch or Prometheus
4. **Configure backups** - Automated daily database dumps to S3
5. **Add CI/CD** - GitHub Actions for automated deployments

## Support

For issues or questions:

1. Check logs: `docker logs <container_name>`
2. Review troubleshooting section above
3. See `deploy/LESSONS_LEARNED.md` for detailed issues and solutions
4. Check `deploy/aws/docker/README.md` for Docker-specific help

---

**Deployment Date**: 2026-02-05  
**Version**: 1.0.0  
**Instance**: i-035565c52ac4fa6dd  
**Region**: us-east-1
