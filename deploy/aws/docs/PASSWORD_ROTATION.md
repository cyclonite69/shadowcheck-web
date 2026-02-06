# Database Password Rotation Guide

## Overview

ShadowCheck uses multiple password storage mechanisms depending on the environment:

- **Local Development**: Docker secrets (`secrets/db_password.txt`) + optional keyring
- **AWS Production**: Environment variables in Docker Compose + PostgreSQL user password

This guide covers rotating passwords in both environments.

## Quick Rotation (Automated)

Use the automated rotation script:

```bash
# Local environment
./scripts/rotate-db-password.sh

# AWS environment (via SSM)
aws ssm start-session --target i-INSTANCE_ID --region us-east-1
sudo /home/ssm-user/scripts/rotate-db-password.sh
```

The script will:
1. Generate a secure 32-character password
2. Update all password storage locations
3. Update PostgreSQL user password
4. Restart affected services
5. Display the new connection string

## Manual Rotation

### Local Development

**1. Generate new password:**
```bash
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo $NEW_PASSWORD
```

**2. Update Docker secret:**
```bash
echo "$NEW_PASSWORD" > secrets/db_password.txt
chmod 600 secrets/db_password.txt
```

**3. Update keyring (optional):**
```bash
node -e "
  const keyring = require('./server/src/services/keyringService.ts');
  keyring.default.setCredential('db_password', '$NEW_PASSWORD')
    .then(() => console.log('Updated'))
    .catch(console.error);
"
```

**4. Update PostgreSQL:**
```bash
docker exec shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "ALTER USER shadowcheck_user WITH PASSWORD '$NEW_PASSWORD';"
```

**5. Restart API:**
```bash
docker-compose restart api
```

### AWS Production

**1. Connect via SSM:**
```bash
aws ssm start-session --target i-INSTANCE_ID --region us-east-1
```

**2. Generate new password:**
```bash
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo $NEW_PASSWORD
```

**3. Update PostgreSQL:**
```bash
docker exec shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "ALTER USER shadowcheck_user WITH PASSWORD '$NEW_PASSWORD';"
```

**4. Update environment file:**
```bash
echo "DB_PASSWORD=$NEW_PASSWORD" > /home/ssm-user/.env
chmod 600 /home/ssm-user/.env
```

**5. Restart PostgreSQL:**
```bash
cd /home/ssm-user
docker-compose restart postgres
```

## Password Storage Locations

### Local Development
- `secrets/db_password.txt` - Docker secret (primary)
- System keyring - Optional fallback via keyringService
- `.env` file - Not recommended (gitignored)

### AWS Production
- `/home/ssm-user/.env` - Environment variable for Docker Compose
- PostgreSQL user password - Set via `ALTER USER`
- No secrets manager - Cost optimization

## Security Best Practices

1. **Rotate passwords every 90 days** or after:
   - Team member departure
   - Suspected credential exposure
   - Security incident

2. **Password requirements:**
   - Minimum 32 characters
   - Alphanumeric with special characters
   - Generated via cryptographically secure method

3. **Access control:**
   - Secrets files: `chmod 600` (owner read/write only)
   - Never commit passwords to git
   - Use SSM for AWS access (no SSH keys)

4. **Audit trail:**
   - Log rotation events
   - Track who performed rotation
   - Document reason for rotation

### 5. Logging Security**
- PostgreSQL configured with `log_statement = 'none'` to prevent password exposure
- Docker logs limited to 10MB × 3 files (30MB max per container)
- Bash history configured to exclude password commands
- Space-prefixed commands not logged (`HISTCONTROL=ignorespace`)
- See `docker/infrastructure/postgresql-security.conf` for logging configuration

## Troubleshooting

### "FATAL: password authentication failed"

**Cause:** Mismatch between stored password and PostgreSQL user password.

**Fix:**
```bash
# Check which password is being used
docker exec shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "SELECT usename, valuntil FROM pg_user WHERE usename = 'shadowcheck_user';"

# Reset to known password
docker exec shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "ALTER USER shadowcheck_user WITH PASSWORD 'your_password';"

# Update secrets file
echo "your_password" > secrets/db_password.txt
```

### "Connection refused" after rotation

**Cause:** PostgreSQL container not restarted or crashed.

**Fix:**
```bash
# Check container status
docker ps -a | grep postgres

# Restart if stopped
docker-compose up -d postgres

# Check logs
docker logs shadowcheck_postgres
```

### Keyring update fails

**Cause:** Keyring service not available or locked.

**Fix:** Keyring is optional. The application will fall back to Docker secrets or environment variables.

## Rotation Schedule

Recommended rotation schedule:

- **Development**: Every 90 days or on-demand
- **Production**: Every 60 days or after security events
- **Admin password**: Every 30 days (higher privilege)

## Admin Password Rotation

For the `shadowcheck_admin` user (used for imports/backups):

```bash
# Generate password
ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Update PostgreSQL
docker exec shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "ALTER USER shadowcheck_admin WITH PASSWORD '$ADMIN_PASSWORD';"

# Update secrets
echo "$ADMIN_PASSWORD" > secrets/db_admin_password.txt
chmod 600 secrets/db_admin_password.txt

# Restart services
docker-compose restart api
```

## Verification

After rotation, verify connectivity:

```bash
# Local
psql "postgresql://shadowcheck_user:NEW_PASSWORD@localhost:5432/shadowcheck_db" -c "SELECT version();"

# AWS (from your machine)
psql "postgresql://shadowcheck_user:NEW_PASSWORD@INSTANCE_IP:5432/shadowcheck_db?sslmode=require" -c "SELECT version();"

# Test API health
curl http://localhost:3001/api/health
```

## Emergency Access

If locked out:

1. **Local:** Reset via postgres superuser in Docker
2. **AWS:** Connect via SSM, reset via postgres superuser
3. **Last resort:** Recreate data volume from backup

See `docs/AWS_INFRASTRUCTURE.md` for backup/restore procedures.

## Log Security

### PostgreSQL Logging Configuration

Both local and AWS environments are configured to prevent password exposure in logs:

**Settings applied:**
```
log_statement = 'none'        # No SQL statement logging
log_connections = off         # No connection logging
log_disconnections = off      # No disconnection logging
log_duration = off            # No query duration logging
```

**Why this matters:**
- Prevents passwords from appearing in PostgreSQL logs during `ALTER USER` commands
- Prevents connection strings with embedded passwords from being logged
- Reduces risk of credential exposure through log files

**Location:**
- AWS: `/var/lib/postgresql/postgresql.conf` (in launch template)
- Local: `docker/infrastructure/postgresql-security.conf` (reference)

### Docker Logging Limits

All containers have log rotation configured:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

This limits each container to 30MB of logs (10MB × 3 files), preventing:
- Disk space exhaustion
- Excessive log retention
- Increased attack surface from old logs

### Checking Logs Safely

**View recent logs without passwords:**
```bash
# Last 50 lines (safe)
docker logs --tail 50 shadowcheck_postgres

# Avoid full log dumps
docker logs shadowcheck_postgres | grep -v "password"
```

**Clear logs after rotation:**
```bash
# Truncate Docker logs
truncate -s 0 $(docker inspect --format='{{.LogPath}}' shadowcheck_postgres)
```
