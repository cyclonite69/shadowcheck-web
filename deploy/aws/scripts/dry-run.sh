#!/bin/bash
# Dry-run deployment validator
# Shows what would happen without executing commands

echo "🔍 ShadowCheck Deployment Dry Run"
echo "=================================="
echo ""
echo "This will validate your deployment without making changes."
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
PASS=0
WARN=0
FAIL=0

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARN++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

echo "1. System Utilities Check"
echo "========================="

# Check utilities
if command -v htop &>/dev/null; then
  check_pass "htop installed"
else
  check_warn "htop not installed (will be installed)"
fi

if command -v jq &>/dev/null; then
  check_pass "jq installed"
else
  check_warn "jq not installed (will be installed)"
fi

if command -v rg &>/dev/null; then
  check_pass "ripgrep installed"
else
  check_warn "ripgrep not installed (will be installed)"
fi

if command -v ncdu &>/dev/null; then
  check_pass "ncdu installed"
else
  check_warn "ncdu not installed (will be installed)"
fi

if command -v tmux &>/dev/null; then
  check_pass "tmux installed"
else
  check_warn "tmux not installed (will be installed)"
fi

if command -v git &>/dev/null; then
  check_pass "git installed"
else
  check_fail "git not installed (required)"
fi

echo ""
echo "2. Docker Check"
echo "==============="

if command -v docker &>/dev/null; then
  check_pass "Docker installed"
  if systemctl is-active --quiet docker 2>/dev/null; then
    check_pass "Docker service running"
  else
    check_warn "Docker service not running (will be started)"
  fi
else
  check_warn "Docker not installed (will be installed)"
fi

if command -v docker-compose &>/dev/null; then
  check_pass "Docker Compose installed"
else
  check_warn "Docker Compose not installed (will be installed)"
fi

echo ""
echo "3. Node.js Check"
echo "================"

if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 20 ]; then
    check_pass "Node.js $NODE_VERSION installed (>= 20 required)"
  else
    check_warn "Node.js $NODE_VERSION installed (will upgrade to 20+)"
  fi
else
  check_warn "Node.js not installed (will install 20+)"
fi

echo ""
echo "4. Repository Check"
echo "==================="

if [ -d "/home/ssm-user/shadowcheck/.git" ]; then
  check_pass "Repository exists at /home/ssm-user/shadowcheck"
  cd /home/ssm-user/shadowcheck
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
  check_pass "Current branch: $CURRENT_BRANCH"
  
  if git diff --quiet 2>/dev/null; then
    check_pass "No uncommitted changes"
  else
    check_warn "Uncommitted changes present"
  fi
else
  check_warn "Repository not cloned (will clone from GitHub)"
fi

echo ""
echo "5. PostgreSQL Check"
echo "==================="

if docker ps | grep -q shadowcheck_postgres; then
  check_pass "PostgreSQL container running"
  
  if docker exec shadowcheck_postgres pg_isready -U shadowcheck_user &>/dev/null; then
    check_pass "PostgreSQL accepting connections"
  else
    check_warn "PostgreSQL not ready"
  fi
else
  check_warn "PostgreSQL not running (will be deployed)"
fi

if [ -f "/home/ssm-user/secrets/db_password.txt" ]; then
  check_pass "Database password exists"
else
  check_warn "Database password not found (will be generated)"
fi

echo ""
echo "6. Environment Configuration"
echo "============================"

if [ -f "/home/ssm-user/shadowcheck/deploy/aws/.env.aws" ]; then
  check_pass ".env.aws exists"
  
  # Check required variables
  source /home/ssm-user/shadowcheck/deploy/aws/.env.aws 2>/dev/null || true
  
  [ -n "$DB_PASSWORD" ] && check_pass "DB_PASSWORD set" || check_warn "DB_PASSWORD not set"
  [ -n "$MAPBOX_TOKEN" ] && check_pass "MAPBOX_TOKEN set" || check_warn "MAPBOX_TOKEN not set (required)"
  [ -n "$SESSION_SECRET" ] && check_pass "SESSION_SECRET set" || check_warn "SESSION_SECRET not set (required)"
  [ -n "$PUBLIC_IP" ] && check_pass "PUBLIC_IP set" || check_warn "PUBLIC_IP not set"
else
  check_warn ".env.aws not found (will be created from template)"
fi

echo ""
echo "7. Disk Space Check"
echo "==================="

if mountpoint -q /var/lib/postgresql 2>/dev/null; then
  check_pass "PostgreSQL volume mounted"
  
  DISK_USAGE=$(df -h /var/lib/postgresql | tail -1 | awk '{print $5}' | sed 's/%//')
  if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}% (< 80%)"
  else
    check_warn "Disk usage: ${DISK_USAGE}% (>= 80%)"
  fi
else
  check_warn "PostgreSQL volume not mounted (will be mounted)"
fi

echo ""
echo "8. Application Containers"
echo "========================="

if docker ps | grep -q shadowcheck_backend; then
  check_pass "Backend container running"
else
  check_warn "Backend not running (will be deployed)"
fi

if docker ps | grep -q shadowcheck_frontend; then
  check_pass "Frontend container running"
else
  check_warn "Frontend not running (will be deployed)"
fi

echo ""
echo "9. Network Connectivity"
echo "======================="

if curl -s http://169.254.169.254/latest/meta-data/public-ipv4 &>/dev/null; then
  PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
  check_pass "Public IP: $PUBLIC_IP"
else
  check_warn "Cannot retrieve public IP (not on EC2?)"
fi

if curl -s http://localhost:3001/api/health &>/dev/null; then
  check_pass "Backend API responding"
else
  check_warn "Backend API not responding"
fi

echo ""
echo "10. Shell Aliases"
echo "================="

if grep -q "shadowcheck aliases" /home/ssm-user/.bashrc 2>/dev/null; then
  check_pass "Shell aliases configured"
else
  check_warn "Shell aliases not configured (will be added)"
fi

echo ""
echo "═══════════════════════════════════════"
echo "Summary"
echo "═══════════════════════════════════════"
echo -e "${GREEN}✓ Passed:${NC}  $PASS"
echo -e "${YELLOW}⚠ Warnings:${NC} $WARN"
echo -e "${RED}✗ Failed:${NC}  $FAIL"
echo ""

if [ $FAIL -gt 0 ]; then
  echo "❌ Critical issues found. Deployment may fail."
  echo ""
  echo "Recommended actions:"
  echo "  1. Install missing required packages"
  echo "  2. Fix failed checks above"
  echo "  3. Run dry-run again"
  exit 1
elif [ $WARN -gt 0 ]; then
  echo "⚠️  Warnings found. Deployment will install/configure missing items."
  echo ""
  echo "What will happen during deployment:"
  [ $WARN -gt 0 ] && echo "  • Install missing system utilities"
  ! command -v docker &>/dev/null && echo "  • Install Docker and Docker Compose"
  ! command -v node &>/dev/null && echo "  • Install Node.js 20+"
  [ ! -d "/home/ssm-user/shadowcheck/.git" ] && echo "  • Clone repository from GitHub"
  ! docker ps | grep -q shadowcheck_postgres && echo "  • Deploy PostgreSQL with PostGIS"
  [ ! -f "/home/ssm-user/shadowcheck/deploy/aws/.env.aws" ] && echo "  • Create .env.aws from template"
  ! docker ps | grep -q shadowcheck_backend && echo "  • Build and deploy application containers"
  echo ""
  echo "✅ Ready to proceed with deployment."
  echo ""
  echo "Run: ./deploy/aws/scripts/deploy-complete.sh"
else
  echo "✅ All checks passed! System is fully configured."
  echo ""
  echo "To update application:"
  echo "  scdeploy"
  echo ""
  echo "To check status:"
  echo "  scstatus"
fi

echo ""
echo "📚 Documentation:"
echo "  Quick Start: deploy/aws/QUICKSTART.md"
echo "  Checklist:   deploy/aws/DEPLOYMENT_CHECKLIST.md"
echo "  Reference:   deploy/aws/QUICK_REFERENCE.md"
