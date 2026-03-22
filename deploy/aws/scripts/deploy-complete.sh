#!/bin/bash
# Complete ShadowCheck deployment orchestrator
# Run this after connecting to a fresh EC2 instance via SSM

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/home/ssm-user/shadowcheck"

echo "🚀 ShadowCheck Complete Deployment"
echo "==================================="
echo ""

# Check if running as ssm-user
if [ "$USER" != "ssm-user" ]; then
  echo "⚠️  This script should be run as ssm-user"
  echo "Current user: $USER"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 1: System setup (requires sudo)
echo "Step 1/5: System Setup"
echo "====================="
if [ ! -f /usr/bin/ripgrep ] || [ ! -f /usr/bin/ncdu ]; then
  echo "Running instance setup (requires sudo)..."
  if [ -f "$SCRIPT_DIR/setup-instance.sh" ]; then
    sudo "$SCRIPT_DIR/setup-instance.sh"
  else
    echo "❌ setup-instance.sh not found at $SCRIPT_DIR"
    echo "Please run manually: sudo ./deploy/aws/scripts/setup-instance.sh"
    exit 1
  fi
else
  echo "✅ System utilities already installed"
fi
echo ""

# Step 2: Clone repository if needed
echo "Step 2/5: Repository Setup"
echo "========================="
if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Cloning repository..."
  cd /home/ssm-user
  git clone https://github.com/cyclonite69/shadowcheck-web.git shadowcheck
  cd shadowcheck
  echo "✅ Repository cloned"
else
  echo "✅ Repository already exists"
  cd "$PROJECT_ROOT"
  git pull origin master
  echo "✅ Repository updated"
fi
echo ""

# Step 3: Deploy PostgreSQL + Redis
echo "Step 3/5: PostgreSQL + Redis Deployment"
echo "======================================="
if ! docker ps | grep -q shadowcheck_postgres || ! docker ps | grep -q shadowcheck_redis; then
  echo "Deploying PostgreSQL and Redis (requires sudo)..."
  sudo "$PROJECT_ROOT/deploy/aws/scripts/deploy-postgres.sh"
  sudo "$PROJECT_ROOT/deploy/aws/scripts/deploy-redis.sh"
else
  echo "✅ PostgreSQL and Redis already running"
fi
echo ""

# Step 4: Configure environment
echo "Step 4/5: Environment Configuration"
echo "==================================="
if [ ! -f "$PROJECT_ROOT/deploy/aws/.env.aws" ]; then
  echo "Creating .env.aws from template..."
  cp "$PROJECT_ROOT/deploy/aws/.env.example" "$PROJECT_ROOT/deploy/aws/.env.aws"
  
  # Auto-populate all secrets from AWS SM
  echo "🔍 Pulling secrets from AWS Secrets Manager..."
  SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query SecretString --output text 2>/dev/null)
  
  DB_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.db_password // empty')
  MAPBOX_TOKEN=$(echo "$SECRET_JSON" | jq -r '.mapbox_token // empty')
  WIGLE_API_KEY=$(echo "$SECRET_JSON" | jq -r '.wigle_api_key // empty')
  PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")
  SESSION_SECRET=$(openssl rand -base64 32)
  
  sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" "$PROJECT_ROOT/deploy/aws/.env.aws"
  sed -i "s|MAPBOX_TOKEN=.*|MAPBOX_TOKEN=$MAPBOX_TOKEN|" "$PROJECT_ROOT/deploy/aws/.env.aws"
  sed -i "s|WIGLE_API_KEY=.*|WIGLE_API_KEY=$WIGLE_API_KEY|" "$PROJECT_ROOT/deploy/aws/.env.aws"
  sed -i "s|PUBLIC_IP=.*|PUBLIC_IP=$PUBLIC_IP|" "$PROJECT_ROOT/deploy/aws/.env.aws"
  
  # Add session secret if missing
  if ! grep -q "SESSION_SECRET" "$PROJECT_ROOT/deploy/aws/.env.aws"; then
    echo "SESSION_SECRET=$SESSION_SECRET" >> "$PROJECT_ROOT/deploy/aws/.env.aws"
  fi
  
  echo "✅ .env.aws created and auto-populated from Secrets Manager"
else
  echo "✅ .env.aws already exists"
fi
echo ""

# Step 5: Deploy application
echo "Step 5/5: Application Deployment"
echo "================================"
echo "Deploying ShadowCheck application..."
# Force non-interactive build
export DEBIAN_FRONTEND=noninteractive
"$PROJECT_ROOT/deploy/aws/scripts/scs_rebuild.sh"
echo ""

# Step 6: Initialize admin user (optional)
echo "Optional: Admin User Initialization"
echo "==================================="
read -p "Initialize admin user? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ -f "$PROJECT_ROOT/sql/seeds/01_create_admin_user.sql" ]; then
    docker cp "$PROJECT_ROOT/sql/seeds/01_create_admin_user.sql" shadowcheck_postgres:/tmp/
    "$PROJECT_ROOT/deploy/aws/scripts/init-admin-user.sh"
  else
    echo "⚠️  Admin user seed file not found"
  fi
fi
echo ""

# Final status
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "📊 System Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "💾 Database Status:"
df -h /var/lib/postgresql | tail -1
echo ""
echo "🔗 Access URLs:"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "   Frontend: https://$PUBLIC_IP"
echo "   Backend API (proxied): https://$PUBLIC_IP/api"
echo "   Backend health (local): http://$PUBLIC_IP:3001"
echo ""
echo "🔑 Credentials:"
echo "   Database password: stored in AWS Secrets Manager (shadowcheck/config)"
echo "   Admin user: run init-admin-user.sh to create (generates random password)"
echo ""
echo "📝 Useful Commands:"
echo "   sc        - cd to shadowcheck directory"
echo "   sclogs    - tail backend logs"
echo "   scps      - show running containers"
echo "   scdb      - connect to database as shadowcheck_user"
echo "   scdba     - connect to database as shadowcheck_admin"
echo "   scdeploy  - deploy latest from GitHub"
echo "   scstatus  - show system status"
echo ""
echo "📚 Documentation:"
echo "   Workflow: $PROJECT_ROOT/deploy/aws/WORKFLOW.md"
echo "   README:   $PROJECT_ROOT/deploy/aws/README.md"
