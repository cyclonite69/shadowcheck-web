# Deployment Guide

Production deployment guide for ShadowCheck-Static.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Traditional Deployment](#traditional-deployment)
- [Cloud Deployments](#cloud-deployments)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup & Recovery](#backup--recovery)
- [Security Hardening](#security-hardening)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Server Requirements

**Minimum:**

- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD
- OS: Ubuntu 20.04+ / Debian 11+ / RHEL 8+

**Recommended:**

- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- OS: Ubuntu 22.04 LTS

### Software Requirements

- Docker 20.10+ and Docker Compose 2.0+
- OR Node.js 20+ and PostgreSQL 18+
- Nginx or Apache (for reverse proxy)
- SSL certificate (Let's Encrypt recommended)

## Deployment Options

### 1. Docker Compose (Recommended)

Best for:

- Quick deployment
- Easy scaling
- Development/staging environments

### 2. Traditional (Systemd)

Best for:

- Full control over services
- Integration with existing infrastructure
- Custom configurations

### 3. Cloud Platforms

- AWS (ECS, RDS, ElastiCache)
- Google Cloud (Cloud Run, Cloud SQL)
- Azure (Container Instances, PostgreSQL)
- DigitalOcean (App Platform, Managed Database)

## Docker Deployment

### 1. Prepare Server

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Clone Repository

```bash
git clone https://github.com/your-org/ShadowCheckStatic.git
cd ShadowCheckStatic
```

### 3. Configure Environment

```bash
# Create production environment file
cp .env.example .env

# Edit with production values
nano .env
```

**Production `.env` example:**

```env
# Database
DB_USER=shadowcheck_user
DB_HOST=postgres
DB_NAME=shadowcheck
DB_PASSWORD=<strong-random-password>
DB_PORT=5432

# Server
PORT=3001
NODE_ENV=production
FORCE_HTTPS=true

# Security
API_KEY=<generate-strong-key>
MAPBOX_TOKEN=<your-mapbox-token>

# CORS (whitelist your domains)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Enrichment APIs (optional)
OPENCAGE_API_KEY=<your-key>
LOCATIONIQ_API_KEY=<your-key>
ABSTRACT_API_KEY=<your-key>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# PgAdmin (for database management)
PGADMIN_EMAIL=admin@yourdomain.com
PGADMIN_PASSWORD=<strong-password>
PGADMIN_PORT=5050
```

### 4. Generate Secrets

```bash
# Generate strong API key
openssl rand -hex 32

# Generate database password
openssl rand -base64 32
```

### 5. Build and Start Services

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

### 6. Initialize Database

```bash
# Run migrations
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/00_init_schema.sql

# Verify
docker-compose exec api curl http://localhost:3001/api/dashboard-metrics
```

### 7. Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt-get install nginx -y

# Create configuration
sudo nano /etc/nginx/sites-available/shadowcheck
```

**Nginx configuration:**

```nginx
upstream shadowcheck_api {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api/ {
        proxy_pass http://shadowcheck_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files
    location / {
        proxy_pass http://shadowcheck_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Caching for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://shadowcheck_api;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/shadowcheck /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 9. Configure Firewall

```bash
# Install UFW
sudo apt-get install ufw -y

# Allow SSH (IMPORTANT: do this first!)
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable
sudo ufw status
```

## Traditional Deployment

### 1. Install Dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 18
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install postgresql-18 postgresql-18-postgis-3 -y

# Install Redis (optional, for caching)
sudo apt-get install redis-server -y
```

### 2. Setup Database

```bash
# Create database user
sudo -u postgres psql << EOF
CREATE USER shadowcheck_user WITH PASSWORD 'your-password';
CREATE DATABASE shadowcheck OWNER shadowcheck_user;
\c shadowcheck
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS app;
GRANT ALL ON SCHEMA app TO shadowcheck_user;
EOF

# Run migrations
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/00_init_schema.sql
```

### 3. Deploy Application

```bash
# Create app user
sudo useradd -r -m -d /opt/shadowcheck -s /bin/bash shadowcheck

# Clone repository
cd /opt/shadowcheck
sudo -u shadowcheck git clone https://github.com/your-org/ShadowCheckStatic.git app
cd app

# Install dependencies
sudo -u shadowcheck npm ci --production

# Create environment file
sudo -u shadowcheck cp .env.example .env
sudo -u shadowcheck nano .env
```

### 4. Create Systemd Service

```bash
sudo nano /etc/systemd/system/shadowcheck.service
```

**Service file:**

```ini
[Unit]
Description=ShadowCheck SIGINT Forensics Platform
After=network.target postgresql.service

[Service]
Type=simple
User=shadowcheck
Group=shadowcheck
WorkingDirectory=/opt/shadowcheck/app
EnvironmentFile=/opt/shadowcheck/app/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=shadowcheck

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/shadowcheck/app/data /opt/shadowcheck/app/logs

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable shadowcheck
sudo systemctl start shadowcheck
sudo systemctl status shadowcheck
```

### 5. Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/shadowcheck
```

```
/opt/shadowcheck/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 shadowcheck shadowcheck
    sharedscripts
    postrotate
        systemctl reload shadowcheck > /dev/null 2>&1 || true
    endscript
}
```

## Cloud Deployments

### AWS Deployment

#### Using ECS + RDS

1. **Create RDS PostgreSQL Instance**
   - Engine: PostgreSQL 18
   - Instance class: db.t3.medium
   - Storage: 50 GB SSD
   - Enable Multi-AZ for production
   - Enable automated backups

2. **Create ECR Repository**

   ```bash
   aws ecr create-repository --repository-name shadowcheck-static
   ```

3. **Build and Push Docker Image**

   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.us-east-1.amazonaws.com

   # Build image
   docker build -t shadowcheck-static .

   # Tag image
   docker tag shadowcheck-static:latest your-account-id.dkr.ecr.us-east-1.amazonaws.com/shadowcheck-static:latest

   # Push image
   docker push your-account-id.dkr.ecr.us-east-1.amazonaws.com/shadowcheck-static:latest
   ```

4. **Create ECS Task Definition**
   - Use Fargate launch type
   - CPU: 2 vCPU
   - Memory: 4 GB
   - Environment variables from Secrets Manager
   - CloudWatch Logs enabled

5. **Setup Application Load Balancer**
   - HTTPS listener (port 443)
   - Target group pointing to ECS service
   - Health check: `/api/dashboard-metrics`

6. **Configure Auto Scaling**
   - Min tasks: 2
   - Max tasks: 10
   - Scale on CPU > 70%

### DigitalOcean App Platform

1. **Create App**
   - Connect GitHub repository
   - Detect Dockerfile automatically

2. **Configure Environment**
   - Add environment variables
   - Use DO Managed PostgreSQL

3. **Deploy**
   - Automatic deployments on git push
   - Custom domain support
   - Free SSL certificates

## Environment Configuration

### Production Environment Variables

```env
# Required
NODE_ENV=production
PORT=3001
DB_USER=shadowcheck_user
DB_HOST=your-db-host
DB_NAME=shadowcheck
DB_PASSWORD=<from-secrets-manager>
API_KEY=<strong-random-key>
MAPBOX_TOKEN=<your-token>

# Security
FORCE_HTTPS=true
CORS_ORIGINS=https://yourdomain.com

# Optional
REDIS_HOST=your-redis-host
REDIS_PORT=6379
LOG_LEVEL=info
```

### Secrets Management

**AWS Secrets Manager:**

```bash
# Store secret
aws secretsmanager create-secret \
    --name shadowcheck/db-password \
    --secret-string "your-password"

# Retrieve in application
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
```

**Environment-based:**

```bash
# Use system keyring (Linux)
npm install keytar
```

```javascript
const keytar = require('keytar');
const password = await keytar.getPassword('shadowcheck', 'db-password');
```

## Database Setup

### PostgreSQL Configuration

Edit `/etc/postgresql/18/main/postgresql.conf`:

```ini
# Connection settings
max_connections = 200
shared_buffers = 1GB
effective_cache_size = 4GB
maintenance_work_mem = 256MB
work_mem = 16MB

# Write-ahead log
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
checkpoint_completion_target = 0.9

# Query planning
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_min_duration_statement = 1000

# Performance monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

### Database Backup Strategy

**Automated Backups:**

```bash
#!/bin/bash
# /opt/shadowcheck/backup.sh

BACKUP_DIR="/backups/shadowcheck"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

# Create backup
pg_dump -U shadowcheck_user -d shadowcheck_db -F c -f "$BACKUP_DIR/shadowcheck_$DATE.dump"

# Compress
gzip "$BACKUP_DIR/shadowcheck_$DATE.dump"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/shadowcheck_$DATE.dump.gz" s3://your-bucket/backups/

# Delete old backups
find $BACKUP_DIR -name "*.dump.gz" -mtime +$KEEP_DAYS -delete
```

Schedule with cron:

```bash
# Daily at 2 AM
0 2 * * * /opt/shadowcheck/backup.sh
```

## SSL/TLS Configuration

### Let's Encrypt (Free)

```bash
# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com

# Auto-renewal (configured automatically)
sudo systemctl status certbot.timer
```

### Custom Certificate

```nginx
# Nginx configuration
ssl_certificate /etc/ssl/certs/your-cert.pem;
ssl_certificate_key /etc/ssl/private/your-key.pem;

# Optional: OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/ssl/certs/chain.pem;
```

## Monitoring & Logging

### Application Logging

**Structured logging with Winston:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});
```

### Health Monitoring

**Create health endpoint:**

```javascript
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    });
  }
});
```

**Monitoring with Uptime Kuma:**

```bash
docker run -d --restart=always \
  -p 3002:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma \
  louislam/uptime-kuma:1
```

### Metrics with Prometheus

**Install Prometheus client:**

```bash
npm install prom-client
```

**Add metrics endpoint:**

```javascript
const client = require('prom-client');
const register = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Backup & Recovery

### Full System Backup

```bash
#!/bin/bash
# Full backup script

BACKUP_ROOT="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
pg_dump -U shadowcheck_user -d shadowcheck_db -F c -f "$BACKUP_ROOT/db_$DATE.dump"

# Application files
tar -czf "$BACKUP_ROOT/app_$DATE.tar.gz" /opt/shadowcheck/app

# Environment configuration
cp /opt/shadowcheck/app/.env "$BACKUP_ROOT/env_$DATE"

# Upload to remote storage
rsync -avz $BACKUP_ROOT/ user@backup-server:/backups/shadowcheck/
```

### Disaster Recovery

**Recovery steps:**

1. **Restore Database**

   ```bash
   pg_restore -U shadowcheck_user -d shadowcheck_db backup.dump
   ```

2. **Restore Application**

   ```bash
   tar -xzf app_backup.tar.gz -C /opt/shadowcheck/
   ```

3. **Restore Configuration**

   ```bash
   cp env_backup /opt/shadowcheck/app/.env
   ```

4. **Restart Services**
   ```bash
   sudo systemctl restart shadowcheck
   ```

## Security Hardening

### Server Hardening

```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Enable firewall
sudo ufw enable

# Install fail2ban
sudo apt-get install fail2ban -y
sudo systemctl enable fail2ban

# Keep system updated
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install unattended-upgrades -y
```

### Application Security

- Enable HTTPS only (`FORCE_HTTPS=true`)
- Use strong API keys (32+ characters)
- Whitelist CORS origins
- Enable rate limiting
- Sanitize all user input
- Use prepared statements (prevent SQL injection)
- Set security headers (CSP, HSTS, X-Frame-Options)
- Regular security audits (`npm audit`)

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for frequent queries
CREATE INDEX CONCURRENTLY idx_locations_bssid_time
  ON app.locations_legacy(bssid, time) WHERE time >= 946684800000;

CREATE INDEX CONCURRENTLY idx_networks_type_lastseen
  ON app.networks_legacy(type, last_seen);

-- Analyze tables
ANALYZE app.networks_legacy;
ANALYZE app.locations_legacy;

-- Vacuum regularly
VACUUM ANALYZE;
```

### Application Optimization

**Enable Redis caching:**

```javascript
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Cache dashboard metrics (5 minutes)
const cacheKey = 'dashboard:metrics';
const cached = await client.get(cacheKey);
if (cached) {
  return JSON.parse(cached);
}

// Fetch from database
const metrics = await getDashboardMetrics();
await client.setex(cacheKey, 300, JSON.stringify(metrics));
```

**Enable compression:**

```javascript
const compression = require('compression');
app.use(compression());
```

## Troubleshooting

### High CPU Usage

```bash
# Check Node.js process
top -p $(pgrep -f "node server.js")

# Enable profiling
node --prof server.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

### High Memory Usage

```bash
# Check memory
free -h
docker stats

# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" node server.js
```

### Database Connection Issues

```bash
# Check connections
SELECT count(*) FROM pg_stat_activity;

# Check max connections
SHOW max_connections;

# Terminate idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND state_change < NOW() - INTERVAL '1 hour';
```

### Slow API Responses

```bash
# Enable query logging
ALTER DATABASE shadowcheck SET log_min_duration_statement = 1000;

# Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

For API documentation, see [API.md](API.md).
For development setup, see [DEVELOPMENT.md](DEVELOPMENT.md).
For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
