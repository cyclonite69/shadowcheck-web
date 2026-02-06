#!/bin/bash
# Complete ShadowCheck AWS Deployment Script
# This script sets up the entire environment from scratch

set -e

INSTANCE_ID="i-035565c52ac4fa6dd"
REGION="us-east-1"

echo "🚀 ShadowCheck Complete Deployment"
echo "=================================="
echo ""

# 1. Install git if needed
echo "📦 Installing dependencies..."
aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":[
    "sudo yum install -y git"
  ]}' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId'

sleep 10

# 2. Clone/update repository
echo "📥 Cloning repository..."
aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":[
    "cd /home/ssm-user",
    "if [ -d shadowcheck ]; then cd shadowcheck && git pull; else git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck; fi"
  ]}' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId'

sleep 10

# 3. Build containers
echo "🔨 Building Docker containers..."
CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":[
    "cd /home/ssm-user/shadowcheck",
    "echo \"Building backend...\"",
    "docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .",
    "echo \"Building frontend...\"",
    "docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .",
    "echo \"✅ Containers built successfully\""
  ]}' \
  --region $REGION \
  --timeout-seconds 600 \
  --output text \
  --query 'Command.CommandId')

echo "Waiting for build to complete (this takes ~3-5 minutes)..."
sleep 300

# 4. Deploy containers
echo "🚢 Deploying containers..."
aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":[
    "cd /home/ssm-user/shadowcheck",
    "export DB_PASSWORD=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD)",
    "export MAPBOX_TOKEN=your_mapbox_token_here",
    "docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true",
    "docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true",
    "docker run -d --name shadowcheck_backend --network host -e NODE_ENV=production -e PORT=3001 -e DB_HOST=127.0.0.1 -e DB_USER=shadowcheck_user -e DB_PASSWORD=$DB_PASSWORD -e DB_NAME=shadowcheck_db -e MAPBOX_TOKEN=$MAPBOX_TOKEN --restart unless-stopped shadowcheck/backend:latest",
    "docker run -d --name shadowcheck_frontend --network host --restart unless-stopped shadowcheck/frontend:latest",
    "sleep 5",
    "docker ps | grep shadowcheck"
  ]}' \
  --region $REGION \
  --output text \
  --query 'Command.CommandId'

sleep 15

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Services running:"
echo "  - PostgreSQL: 127.0.0.1:5432"
echo "  - Backend API: http://localhost:3001"
echo "  - Frontend: http://localhost:80"
echo ""
echo "⚠️  Remember to set MAPBOX_TOKEN in the deployment script!"
