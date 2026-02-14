# ShadowCheck Deployment Workflow

## The Correct Workflow

**Always follow this pattern:**

```
Local Machine → Git → GitHub → EC2 Instance
```

### 1. Make Changes Locally

```bash
# Edit code, configs, or scripts
vim server/src/api/routes/v1/auth.ts

# Test locally if possible
npm run dev
```

### 2. Commit and Push

```bash
git add .
git commit -m "Your change description"
git push origin master
```

### 3. Deploy on EC2

```bash
# SSH or SSM into EC2 instance
aws ssm start-session --target i-035565c52ac4fa6dd --region us-east-1

# Navigate to project
cd /home/ssm-user/shadowcheck

# Deploy from GitHub
./deploy/aws/scripts/scs_rebuild.sh
```

## Initial Setup on EC2

### Automated Setup (Recommended)

**One command to set up everything:**

```bash
# 1. Connect to instance
aws ssm start-session --target i-035565c52ac4fa6dd --region us-east-1

# 2. Switch to bash
bash

# 3. Download and run setup script
curl -fsSL https://raw.githubusercontent.com/cyclonite69/shadowcheck-static/master/deploy/aws/scripts/setup-instance.sh | sudo bash

# 4. Clone repository
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck
cd shadowcheck

# 5. Run complete deployment
./deploy/aws/scripts/deploy-complete.sh
```

The `deploy-complete.sh` script will:

- ✅ Verify system setup
- ✅ Clone/update repository
- ✅ Deploy PostgreSQL with optimized settings
- ✅ Create and configure .env.aws
- ✅ Deploy application containers
- ✅ Optionally initialize admin user

### Manual Setup (If Needed)

1. **System setup:**

```bash
sudo ./deploy/aws/scripts/setup-instance.sh
```

This installs:

- System utilities (htop, jq, ripgrep, ncdu, tmux, etc.)
- Docker and Docker Compose
- Node.js 20+
- PostgreSQL client tools (pgcli)
- Helpful shell aliases

2. **Clone repository:**

```bash
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck
cd shadowcheck
```

3. **Deploy PostgreSQL:**

```bash
sudo ./deploy/aws/scripts/deploy-postgres.sh
```

4. **Create environment config:**

```bash
cp deploy/aws/.env.example deploy/aws/.env.aws
vim deploy/aws/.env.aws  # Fill in your values
```

5. **Get required values:**

```bash
# Database password
cat /home/ssm-user/secrets/db_password.txt

# Public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

6. **Deploy application:**

```bash
./deploy/aws/scripts/scs_rebuild.sh
```

7. **Initialize admin user:**

```bash
docker cp sql/seeds/01_create_admin_user.sql shadowcheck_postgres:/tmp/
./deploy/aws/scripts/init-admin-user.sh
```

## Updating the Application

### Every Time You Make Changes

```bash
# On your local machine
git add .
git commit -m "Description of changes"
git push origin master

# On EC2 instance
cd /home/ssm-user/shadowcheck
./deploy/aws/scripts/scs_rebuild.sh
```

That's it! The script will:

- Pull latest code
- Rebuild containers
- Restart services
- Apply new configuration

## What NOT to Do

❌ **Don't make changes directly on EC2:**

```bash
# BAD - changes will be lost on next deploy
vim /home/ssm-user/shadowcheck/server/src/api/routes/v1/auth.ts
```

❌ **Don't manually restart containers with different configs:**

```bash
# BAD - not tracked in git
docker run -d -e NEW_VAR=value ...
```

✅ **Instead, update .env.aws or code locally, then deploy**

## Configuration Management

### Environment Variables

**Stored in:** `deploy/aws/.env.aws` (on EC2, gitignored)

To change:

1. Edit `deploy/aws/.env.aws` on EC2
2. Run `./deploy/aws/scripts/scs_rebuild.sh`

### Code Changes

**Stored in:** Git repository

To change:

1. Edit locally
2. Commit and push
3. Run deploy script on EC2

### Database Changes

**Stored in:** `sql/migrations/` and `sql/seeds/`

To change:

1. Create migration/seed file locally
2. Commit and push
3. Run migration on EC2:

```bash
docker cp sql/migrations/new_migration.sql shadowcheck_postgres:/tmp/
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -f /tmp/new_migration.sql
```

## Troubleshooting

### "Changes not appearing after deploy"

1. Check you pushed to GitHub:

```bash
git status
git log --oneline -5
```

2. Check EC2 pulled latest:

```bash
cd /home/ssm-user/shadowcheck
git log --oneline -5
```

3. Check containers rebuilt:

```bash
docker images | grep shadowcheck
```

### "Environment variables not working"

1. Check `.env.aws` exists:

```bash
cat deploy/aws/.env.aws
```

2. Check script loaded it:

```bash
source deploy/aws/.env.aws
echo $MAPBOX_TOKEN
```

### "Database changes not applied"

1. Check migration file copied:

```bash
docker exec shadowcheck_postgres ls -la /tmp/*.sql
```

2. Check migration ran:

```bash
docker logs shadowcheck_postgres | grep migration
```

## Best Practices

1. **Always test locally first** (when possible)
2. **Commit small, focused changes**
3. **Write descriptive commit messages**
4. **Keep .env.aws in sync with .env.example**
5. **Document any manual steps** in deployment scripts
6. **Never commit secrets** to git (.env.aws is gitignored)
7. **Use migrations for database changes**
8. **Tag releases** for production deployments

## Quick Reference

```bash
# Local workflow
git add .
git commit -m "Description"
git push

# EC2 deployment
cd /home/ssm-user/shadowcheck
./deploy/aws/scripts/scs_rebuild.sh

# Check status
docker ps
docker logs shadowcheck_backend
docker logs shadowcheck_frontend

# Rollback (if needed)
git checkout <previous-commit>
./deploy/aws/scripts/scs_rebuild.sh
```

## Quick Iteration Workflow (Active Development)

When you need to iterate quickly and test on the actual EC2 environment:

### One-Time Setup

Configure git on EC2 so you can commit from there:

```bash
# From your local machine
./deploy/aws/scripts/setup-git-on-ec2.sh <your_github_username> <your_github_token>
```

Get a GitHub personal access token from: https://github.com/settings/tokens  
Required scopes: `repo` (full control)

### Iteration Cycle

```bash
# 1. Connect via SSM
aws ssm start-session --target i-035565c52ac4fa6dd --region us-east-1

# 2. Make changes
cd /home/ssm-user/shadowcheck
vim server/src/api/routes/v1/auth.ts

# 3. Test immediately
./deploy/aws/scripts/scs_rebuild.sh

# 4. If it works, commit from EC2
git add .
git commit -m "Fix auth issue"
git push

# 5. Pull on local machine to stay in sync
exit  # exit SSM session
git pull
```

**Benefits:**

- Fastest iteration (no local → GitHub → EC2 cycle)
- Test on real environment immediately
- See actual logs and behavior
- Still tracked in git

**When to use:**

- Debugging production issues
- Testing environment-specific behavior
- Rapid prototyping
- Working with AWS-specific features
