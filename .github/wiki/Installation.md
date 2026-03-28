# Installation Guide

**Docs version (repo):** [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)

Complete setup instructions for ShadowCheck development and production environments.

---

## Prerequisites

### Required Software

| Software   | Version | Purpose                                     |
| ---------- | ------- | ------------------------------------------- |
| Node.js    | 22+     | Runtime environment                         |
| PostgreSQL | 18+     | Database with PostGIS extension             |
| Docker     | 20.10+  | Containerization (optional but recommended) |
| Git        | 2.30+   | Version control                             |

### System Requirements

**Minimum:**

- CPU: 2 cores
- RAM: 4 GB
- Storage: 20 GB SSD

**Recommended:**

- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD

---

## Quick Installation

### 1. Clone Repository

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL

#### Option A: Docker (Recommended)

```bash
# Start PostgreSQL with PostGIS
docker-compose up -d postgres

# Verify it's running
docker ps | grep postgres
```

#### Option B: Local PostgreSQL

```sql
-- Create database users
CREATE ROLE shadowcheck_user WITH LOGIN PASSWORD 'your_password';
CREATE ROLE shadowcheck_admin WITH LOGIN PASSWORD 'admin_password';

-- Create database
CREATE DATABASE shadowcheck_db OWNER shadowcheck_admin;
\c shadowcheck_db
CREATE EXTENSION postgis;
```

### 4. Configure Environment

```bash
# Configure non-secret runtime vars
export DB_USER=shadowcheck_user
export DB_HOST=postgres
export DB_NAME=shadowcheck_db
export DB_PORT=5432
```

**Essential environment variables:**

````env
# Database
DB_USER=shadowcheck_user
DB_HOST=postgres
DB_NAME=shadowcheck_db
DB_PORT=5432
```,old_string:
# Server
PORT=3001
NODE_ENV=development

# Frontend
MAPBOX_TOKEN=pk.your_mapbox_token_here
````

### 5. Set Secrets

Store secrets in **AWS Secrets Manager**:

- `db_password`
- `db_admin_password`
- `mapbox_token`

### 6. Run Migrations

```bash
# Apply security migration
psql -U shadowcheck_admin -d shadowcheck_db -f sql/migrations/20260129_implement_db_security.sql
```

### 7. Start Development Server

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
npm run dev:frontend
```

Access the application:

- Backend API: http://localhost:3001
- Frontend: http://localhost:5173

---

## DevContainer Setup (Recommended)

### Prerequisites

- Docker Desktop
- VS Code with Dev Containers extension

### Steps

1. Open in DevContainer (VS Code will prompt)
2. Wait for container build (includes Node.js 22, PostgreSQL 18, PostGIS)
3. Start developing:
   ```bash
   npm run dev          # Backend
   npm run dev:frontend # Frontend
   ```

---

## Production Deployment

### Local Development

```bash
# Configure environment
export DB_USER=shadowcheck_user
export DB_HOST=postgres
export DB_NAME=shadowcheck_db
export DB_PORT=5432

# Start infrastructure
docker-compose up -d
```

### Home Lab Deployment

```bash
# Automated setup (detects RAM, configures PostgreSQL)
./deploy/homelab/scripts/setup.sh

# Manual setup
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d
docker-compose up -d
```

See [deploy/homelab/README.md](../../deploy/homelab/README.md) for hardware requirements.

### AWS Production

```bash
# Launch Spot instance with persistent storage
./deploy/aws/scripts/launch-shadowcheck-spot.sh

# Connect via SSM
aws ssm start-session --target i-INSTANCE_ID --region us-east-1
```

See [deploy/aws/README.md](../../deploy/aws/README.md) for AWS infrastructure details.

---

## Security Setup

### Password Rotation

```bash
# Rotate database password (auto-detects environment)
./scripts/rotate-db-password.sh
```

Recommended schedule: Every 60-90 days

See `deploy/aws/docs/PASSWORD_ROTATION.md` for detailed procedures.

---

## Verification

```bash
# Test API
curl http://localhost:3001/api/dashboard-metrics

# Run tests
npm test
```

---

## Next Steps

- [Development Guide](Development)
- [API Reference](API-Reference)
- [Architecture](Architecture)
