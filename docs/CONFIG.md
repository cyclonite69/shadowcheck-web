# Configuration Guide

This document describes all configuration options for ShadowCheckStatic.

## Configuration Files

| File                               | Purpose                        |
| ---------------------------------- | ------------------------------ |
| `.env`                             | Main environment configuration |
| `.env.example`                     | Template for `.env`            |
| `.env.local`                       | Local overrides (gitignored)   |
| `server/src/config/database.ts`    | Database configuration         |
| `server/src/utils/serverConfig.ts` | Server configuration           |
| `config/servers.json`              | Server definitions             |

## Environment Variables

### Database Configuration

| Variable        | Required | Default | Description                                            |
| --------------- | -------- | ------- | ------------------------------------------------------ |
| `DB_USER`       | Yes      | -       | Database username                                      |
| `DB_ADMIN_USER` | Yes      | -       | Admin database username                                |
| `DB_HOST`       | Yes      | -       | Database host                                          |
| `DB_NAME`       | Yes      | -       | Database name                                          |
| `DB_PORT`       | No       | `5432`  | Database port                                          |
| `DB_PASSWORD`   | Yes      | -       | Database password (see [Secrets](#secrets-management)) |

### Server Configuration

| Variable       | Required | Default       | Description                  |
| -------------- | -------- | ------------- | ---------------------------- |
| `PORT`         | No       | `3001`        | Server port                  |
| `NODE_ENV`     | No       | `development` | Environment mode             |
| `FORCE_HTTPS`  | No       | `false`       | Force HTTPS redirect         |
| `CORS_ORIGINS` | No       | -             | Comma-separated CORS origins |

### Threat Detection

| Variable           | Required | Default | Description                       |
| ------------------ | -------- | ------- | --------------------------------- |
| `THREAT_THRESHOLD` | No       | `40`    | Minimum threat score threshold    |
| `MIN_OBSERVATIONS` | No       | `2`     | Minimum observations for analysis |

### Admin Controls

| Variable               | Required | Default | Description                    |
| ---------------------- | -------- | ------- | ------------------------------ |
| `ADMIN_ALLOW_DOCKER`   | No       | `false` | Allow Docker controls in admin |
| `PGADMIN_COMPOSE_FILE` | No       | -       | Path to pgAdmin compose file   |

## Secrets Management

Secrets are loaded in priority order:

1. **Docker secrets** (`/run/secrets/*`)
2. **System keyring** (via keyringService)
3. **Environment variables**

### Required Secrets

| Secret Key          | Description             |
| ------------------- | ----------------------- |
| `db_password`       | Database password       |
| `db_admin_password` | Admin database password |
| `mapbox_token`      | Mapbox API token        |

### Optional Secrets

| Secret Key              | Description            |
| ----------------------- | ---------------------- |
| `api_key`               | API authentication key |
| `wigle_api_key`         | WiGLE API key          |
| `wigle_api_token`       | WiGLE API token        |
| `locationiq_api_key`    | LocationIQ geocoding   |
| `opencage_api_key`      | OpenCage geocoding     |
| `smarty_auth_id`        | Smarty geocoding       |
| `smarty_auth_token`     | Smarty geocoding       |
| `aws_access_key_id`     | AWS credentials        |
| `aws_secret_access_key` | AWS credentials        |

### Setting Secrets via Keyring

```bash
# Set a secret
node scripts/keyring-cli.js set db_password

# Get a secret
node scripts/keyring-cli.js get db_password

# Delete a secret
node scripts/keyring-cli.js delete db_password
```

### Setting Secrets via Environment

```bash
export DB_PASSWORD=your_password
export MAPBOX_TOKEN=pk.your_token
```

## Frontend Configuration

Frontend environment variables must be prefixed with `VITE_`:

| Variable            | Description               |
| ------------------- | ------------------------- |
| `VITE_MAPBOX_TOKEN` | Mapbox token for frontend |
| `VITE_API_BASE`     | API base URL              |
| `VITE_DEV_MODE`     | Development mode flag     |

Place these in `.env.local` for local development.

## Configuration in Development

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:

   ```bash
   nano .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Configuration in Production

### Docker Secrets

Create Docker secrets in `/run/secrets/`:

```bash
echo "your_password" | docker secret create db_password -
```

### Environment File

Use a production `.env` file with strong passwords:

```bash
# Generate strong passwords
openssl rand -base64 32

# Set in .env
DB_PASSWORD=<generated_password>
DB_ADMIN_PASSWORD=<generated_password>
MAPBOX_TOKEN=<your_mapbox_token>
```

### Environment Variables in Docker

```bash
docker run \
  -e DB_HOST=shadowcheck_postgres \
  -e DB_USER=shadowcheck_user \
  -e DB_NAME=shadowcheck_db \
  -e PORT=3001 \
  shadowcheck/static:latest
```

## Server Configuration

### Database Configuration

File: [`server/src/config/database.ts`](server/src/config/database.ts)

```typescript
{
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'shadowcheck_db',
  user: process.env.DB_USER,
  password: secrets.get('db_password'),
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### Server Configuration

File: [`server/src/utils/serverConfig.ts`](server/src/utils/serverConfig.ts)

```typescript
{
  port: parseInt(process.env.PORT || '3001'),
  host: '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
  forceHttps: process.env.FORCE_HTTPS === 'true',
}
```

## Configuration Validation

The application validates configuration on startup:

```typescript
// Required configurations
const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required config: ${key}`);
  }
});
```

## Docker Compose Configuration

### Development

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  shadowcheck:
    build: .
    ports:
      - '3001:3001'
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
    depends_on:
      - postgres
```

### Production

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgis/postgis:15-3.3
    volumes:
      - postgres_data:/var/lib/postgresql/data
    env_file:
      - .env.production

  shadowcheck:
    build: .
    ports:
      - '3001:3001'
    depends_on:
      - postgres
    secrets:
      - db_password
      - mapbox_token
```

## Troubleshooting

### Missing Configuration

```
Error: Missing required config: DB_HOST
```

**Fix**: Ensure `.env` file exists and contains all required variables.

### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix**: Check that PostgreSQL is running and `DB_HOST` is correct.

### Secret Not Found

```
Error: Secret not found: db_password
```

**Fix**: Set the secret via keyring, environment, or Docker secrets.

### Invalid Environment

```
Error: NODE_ENV must be 'production' or 'development'
```

**Fix**: Set `NODE_ENV` to a valid value.

## Related Documentation

- [Development Guide](DEVELOPMENT.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Security Guidelines](SECURITY.md)
- [Secrets Management](security/SECRETS_MANAGEMENT.md)
- [AWS Infrastructure](../deploy/aws/docs/AWS_INFRASTRUCTURE.md)
