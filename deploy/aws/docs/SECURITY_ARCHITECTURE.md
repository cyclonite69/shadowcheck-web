# AWS Security Architecture

## Network Isolation

### Container Network Topology

```
Internet
    │
    ├─> Port 3001 (API) ──> shadowcheck_api container
    │                            │
    │                            ├─> Internal Network
    │                            │
    └─> Port 5432 (blocked) ──X  └─> shadowcheck_postgres container
                                         (localhost only)
```

### Security Layers

**1. Network Segmentation**

- PostgreSQL bound to `127.0.0.1:5432` (localhost only)
- API exposed on `3001` (public, behind security group)
- Internal Docker network for container-to-container communication
- No direct external access to database

**2. Container Isolation**

- `security_opt: no-new-privileges` - Prevents privilege escalation
- `cap_drop: ALL` - Drops all Linux capabilities
- `cap_add: [minimal]` - Only adds required capabilities
- `read_only: true` - API filesystem is read-only
- `tmpfs` for temporary files - No persistent writable storage

**3. AWS Security Group**

```
Inbound:
- Port 3001 (HTTP/API): Your IP only (68.41.168.87/32)
- Port 5432 (PostgreSQL): BLOCKED (no external access)
- SSH: BLOCKED (SSM only)

Outbound:
- All traffic allowed (for updates, S3)
```

**4. Application Security**

- Database credentials via environment variables (not in image)
- HTTPS enforcement via `FORCE_HTTPS=true`
- CORS restricted to specific origins
- Rate limiting enabled
- SQL injection prevention (parameterized queries)

**5. Logging Security**

- PostgreSQL: `log_statement = 'none'` (no password logging)
- Docker: 10MB × 3 files max (prevents log-based attacks)
- Logs rotated automatically

## Security Best Practices

### Principle of Least Privilege

**PostgreSQL Container:**

- Only capabilities: CHOWN, SETUID, SETGID, DAC_OVERRIDE
- No network access except internal bridge
- Bound to localhost only

**API Container:**

- Only capability: NET_BIND_SERVICE (for port 3001)
- Read-only filesystem
- Temporary files in tmpfs (memory, not disk)
- No shell access

### Defense in Depth

**Layer 1: AWS Security Group**

- Firewall at network level
- IP whitelist (single IP)
- Port restrictions

**Layer 2: Docker Network**

- Internal bridge network
- Container-to-container only
- No direct database exposure

**Layer 3: Container Security**

- Capability restrictions
- Read-only filesystems
- No privilege escalation

**Layer 4: Application Security**

- Authentication required
- Input validation
- Parameterized queries
- Rate limiting

**Layer 5: Database Security**

- SCRAM-SHA-256 authentication
- SSL/TLS required
- Password rotation (60-90 days)
- No password logging

## Attack Surface Reduction

### What's Exposed

- ✅ API on port 3001 (authenticated, rate-limited)

### What's NOT Exposed

- ❌ PostgreSQL port 5432 (localhost only)
- ❌ SSH port 22 (SSM only)
- ❌ Container shells (no exec without SSM)
- ❌ Filesystem (read-only)
- ❌ Logs with credentials (password logging disabled)

## Monitoring & Auditing

### Health Checks

```bash
# API health
curl http://localhost:3001/api/health

# Database health
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user
```

### Security Auditing

```bash
# Check container capabilities
docker inspect shadowcheck_api | jq '.[0].HostConfig.CapDrop'
docker inspect shadowcheck_api | jq '.[0].HostConfig.CapAdd'

# Check network isolation
docker network inspect shadowcheck_internal

# Check read-only filesystem
docker inspect shadowcheck_api | jq '.[0].HostConfig.ReadonlyRootfs'
```

### Log Monitoring

```bash
# Check for suspicious activity
docker logs shadowcheck_api | grep -i "error\|fail\|unauthorized"

# Check database connections
docker exec shadowcheck_postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

## Incident Response

### Compromised API Container

```bash
# Stop container
docker stop shadowcheck_api

# Inspect logs
docker logs shadowcheck_api > incident-api.log

# Database remains isolated and protected
# Rotate credentials
./scripts/rotate-db-password.sh

# Rebuild and redeploy
docker pull shadowcheck/api:latest
docker-compose up -d api
```

### Compromised Database

```bash
# Stop all services
docker-compose down

# Restore from backup
gunzip -c backup-latest.sql.gz | docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db

# Rotate all credentials
./scripts/rotate-db-password.sh

# Restart with new credentials
docker-compose up -d
```

## Compliance

### Data Protection

- Database not directly accessible from internet
- Credentials encrypted in transit (SSL/TLS)
- Credentials not logged
- Regular password rotation

### Access Control

- SSM-only instance access (no SSH keys)
- IP-restricted API access
- Database localhost-only binding
- Container capability restrictions

### Audit Trail

- All API requests logged
- Database connections tracked
- Container events logged
- CloudWatch integration available

## Security Checklist

- [ ] Security group restricts PostgreSQL to localhost
- [ ] API exposed only to whitelisted IP
- [ ] Containers run with minimal capabilities
- [ ] API filesystem is read-only
- [ ] Database bound to 127.0.0.1 only
- [ ] SSL/TLS enabled for database
- [ ] Password logging disabled
- [ ] Docker logs limited (10MB × 3)
- [ ] Health checks configured
- [ ] Backup strategy in place
- [ ] Password rotation scheduled (60-90 days)
- [ ] Monitoring alerts configured

## References

- Docker Security Best Practices: https://docs.docker.com/engine/security/
- PostgreSQL Security: https://www.postgresql.org/docs/18/security.html
- AWS Security Groups: https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
- OWASP Container Security: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
