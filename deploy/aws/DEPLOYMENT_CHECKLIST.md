# ShadowCheck AWS Deployment Checklist

Use this checklist to ensure all steps are completed correctly.

## Pre-Deployment

- [ ] AWS CLI installed and configured locally
- [ ] GitHub repository access configured
- [ ] Mapbox account created (get token from https://account.mapbox.com/)
- [ ] (Optional) WiGLE account created (get API key from https://wigle.net/)

## Instance Launch

- [ ] Run `./deploy/aws/scripts/launch-shadowcheck-spot.sh`
- [ ] Note instance ID (e.g., `i-035565c52ac4fa6dd`)
- [ ] Wait 2-3 minutes for instance initialization
- [ ] Verify SSM connection: `aws ssm start-session --target INSTANCE_ID --region us-east-1`

## System Setup

- [ ] Connect via SSM
- [ ] Switch to bash: `bash`
- [ ] Run system setup: `curl -fsSL https://raw.githubusercontent.com/cyclonite69/shadowcheck-static/master/deploy/aws/scripts/setup-instance.sh | sudo bash`
- [ ] Verify utilities installed:
  - [ ] `rg --version` (ripgrep)
  - [ ] `ncdu --version`
  - [ ] `htop --version`
  - [ ] `docker --version`
  - [ ] `node --version` (should be 20+)

## Repository Setup

- [ ] Clone repository: `cd /home/ssm-user && git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck`
- [ ] Navigate to project: `cd shadowcheck`
- [ ] Verify files present: `ls -la`

## Database Deployment

- [ ] Run PostgreSQL deployment: `sudo ./deploy/aws/scripts/deploy-postgres.sh`
- [ ] Verify container running: `docker ps | grep shadowcheck_postgres`
- [ ] Verify database accessible: `docker exec shadowcheck_postgres pg_isready`
- [ ] Note database password location: `/home/ssm-user/secrets/db_password.txt`

## Environment Configuration

- [ ] Copy template: `cp deploy/aws/.env.example deploy/aws/.env.aws`
- [ ] Edit configuration: `vim deploy/aws/.env.aws`
- [ ] Set `MAPBOX_TOKEN` (from Mapbox account)
- [ ] Set `SESSION_SECRET` (generate with: `openssl rand -base64 32`)
- [ ] Set `WIGLE_API_KEY` (optional)
- [ ] Verify `DB_PASSWORD` matches `/home/ssm-user/secrets/db_password.txt`
- [ ] Verify `PUBLIC_IP` matches: `curl http://169.254.169.254/latest/meta-data/public-ipv4`

## Application Deployment

- [ ] Run deployment: `./deploy/aws/scripts/deploy-from-github.sh`
- [ ] Verify containers running: `docker ps`
  - [ ] `shadowcheck_postgres`
  - [ ] `shadowcheck_backend`
  - [ ] `shadowcheck_frontend`
- [ ] Check backend logs: `docker logs shadowcheck_backend`
- [ ] Check frontend logs: `docker logs shadowcheck_frontend`

## Admin User Setup

- [ ] Copy seed file: `docker cp sql/seeds/01_create_admin_user.sql shadowcheck_postgres:/tmp/`
- [ ] Run initialization: `./deploy/aws/scripts/init-admin-user.sh`
- [ ] Verify admin user created (check script output)

## Security Configuration

- [ ] Get your public IP: `curl ifconfig.me`
- [ ] Add IP to security group: `./deploy/aws/scripts/add-ip-access.sh YOUR_IP`
- [ ] Verify access from browser

## Application Testing

- [ ] Get instance public IP: `curl http://169.254.169.254/latest/meta-data/public-ipv4`
- [ ] Access frontend: `http://INSTANCE_IP:3000`
- [ ] Access backend health: `http://INSTANCE_IP:3001/api/health`
- [ ] Login with admin credentials:
  - Username: `admin`
  - Password: `admin123`
- [ ] Change admin password immediately
- [ ] Test basic functionality:
  - [ ] Dashboard loads
  - [ ] Map displays (Mapbox token working)
  - [ ] API endpoints respond

## Database Verification

- [ ] Connect to database: `pgcli postgresql://shadowcheck_user@localhost:5432/shadowcheck_db`
- [ ] Check PostGIS extension: `SELECT PostGIS_Version();`
- [ ] Check tables exist: `\dt`
- [ ] Check admin user: `SELECT * FROM users WHERE username = 'admin';`
- [ ] Exit: `\q`

## System Verification

- [ ] Check disk space: `df -h /var/lib/postgresql`
- [ ] Check system resources: `htop` (press q to exit)
- [ ] Check container stats: `docker stats --no-stream`
- [ ] Check logs for errors: `docker logs shadowcheck_backend 2>&1 | grep -i error`

## Helpful Aliases Setup

Verify these aliases work (reload shell first: `bash`):

- [ ] `sc` - cd to shadowcheck directory
- [ ] `sclogs` - tail backend logs
- [ ] `scps` - show running containers
- [ ] `scdb` - connect to database
- [ ] `scdeploy` - deploy latest from GitHub
- [ ] `scstatus` - show system status

## Documentation Review

- [ ] Read `deploy/aws/WORKFLOW.md` for update process
- [ ] Read `deploy/aws/QUICKSTART.md` for reference
- [ ] Bookmark instance ID for future connections
- [ ] Save database password securely

## Post-Deployment

- [ ] Import initial data (if applicable)
- [ ] Configure backups (see `deploy/aws/docs/BACKUP_STRATEGY.md`)
- [ ] Set up monitoring (see `deploy/aws/docs/MONITORING.md`)
- [ ] Review security settings (see `SECURITY.md`)
- [ ] Test disaster recovery procedure

## Troubleshooting Checklist

If something doesn't work:

- [ ] Check all containers are running: `docker ps`
- [ ] Check container logs: `docker logs CONTAINER_NAME`
- [ ] Check disk space: `df -h`
- [ ] Check network connectivity: `curl http://localhost:3001/api/health`
- [ ] Verify environment variables: `cat deploy/aws/.env.aws`
- [ ] Verify database connection: `pgcli postgresql://shadowcheck_user@localhost:5432/shadowcheck_db`
- [ ] Check security group rules allow your IP
- [ ] Restart containers: `docker-compose restart`

## Maintenance Schedule

Set reminders for:

- [ ] Weekly: Check disk space and logs
- [ ] Monthly: Review security group rules
- [ ] Quarterly: Rotate database password (see `deploy/aws/docs/PASSWORD_ROTATION.md`)
- [ ] Quarterly: Update system packages: `sudo dnf upgrade -y`
- [ ] Annually: Review and update SSL certificates

## Notes

Use this space for deployment-specific notes:

```
Instance ID:
Public IP:
Deployment Date:
Database Password Location: /home/ssm-user/secrets/db_password.txt
Mapbox Token: (stored in .env.aws)
WiGLE API Key: (stored in .env.aws)

Issues encountered:


Customizations made:


```
