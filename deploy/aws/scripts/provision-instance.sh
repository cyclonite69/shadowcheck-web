#!/bin/bash
# provision-instance.sh — Soup-to-nuts EC2 provisioning via SSM
# Non-interactive: no prompts, no read -p, safe for send-command
#
# Usage (local machine):
#   aws ssm send-command --instance-id i-XXXX \
#     --document-name AWS-RunShellScript \
#     --parameters 'commands=["sudo -iu ssm-user bash /home/ssm-user/shadowcheck/deploy/aws/scripts/provision-instance.sh"]'
#
# Or after SSM session:
#   sudo -iu ssm-user bash ~/shadowcheck/deploy/aws/scripts/provision-instance.sh
#
# Prerequisites:
#   - EC2 role has secretsmanager:GetSecretValue + PutSecretValue on shadowcheck/*
#   - Data volume attached at /dev/nvme1n1 (or /dev/sdf)
#   - Internet access for git clone + docker pull

set -euo pipefail

REPO_URL="https://github.com/cyclonite69/shadowcheck-web.git"
PROJECT_ROOT="/home/ssm-user/shadowcheck"
SECRETS_DIR="/home/ssm-user/secrets"
AWS_SECRET_NAME="shadowcheck/config"
AWS_REGION="${AWS_REGION:-us-east-1}"

log() { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { log "FATAL: $*"; exit 1; }

########################################
# Phase 1: System packages
########################################
phase_system() {
  log "=== Phase 1: System Setup ==="

  if command -v docker &>/dev/null && command -v node &>/dev/null; then
    log "Docker and Node already installed, skipping system setup"
    return 0
  fi

  # Need root for package installs
  if [ "$EUID" -ne 0 ]; then
    log "Elevating to root for system setup..."
    sudo bash "$0" --system-only
    return $?
  fi

  dnf upgrade -y -q

  # SPAL repo for ripgrep/ncdu
  if ! dnf list installed spal-release &>/dev/null; then
    dnf install -y spal-release
    dnf config-manager --set-enabled amazonlinux-spal
    dnf clean all && dnf makecache
  fi

  dnf install -y \
    htop lsof strace jq tree git tmux \
    bind-utils iproute nmap-ncat \
    ripgrep ncdu

  dnf config-manager --set-disabled amazonlinux-spal

  # Docker
  if ! command -v docker &>/dev/null; then
    dnf install -y docker
    systemctl enable --now docker
    usermod -aG docker ssm-user
  fi

  # Node.js 20
  if ! command -v node &>/dev/null || [[ $(node -v | cut -dv -f2 | cut -d. -f1) -lt 20 ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  fi

  # Kernel tuning for PostgreSQL
  if ! grep -q "kernel.shmmax" /etc/sysctl.conf; then
    cat >> /etc/sysctl.conf << 'EOF'
kernel.shmmax = 2147483648
kernel.shmall = 524288
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF
    sysctl -p
  fi

  # Directories
  mkdir -p "$PROJECT_ROOT" "$SECRETS_DIR" /home/ssm-user/backups /var/lib/pgadmin /var/lib/redis
  chown -R ssm-user:ssm-user /home/ssm-user/{shadowcheck,secrets,backups}
  chown -R 5050:5050 /var/lib/pgadmin
  chown -R 999:999 /var/lib/redis
  chmod 700 "$SECRETS_DIR"

  log "System setup complete"
}

# Handle --system-only for sudo elevation
if [[ "${1:-}" == "--system-only" ]]; then
  phase_system
  exit 0
fi

########################################
# Phase 2: Repository
########################################
phase_repo() {
  log "=== Phase 2: Repository ==="

  if [ -d "$PROJECT_ROOT/.git" ]; then
    cd "$PROJECT_ROOT"
    git pull origin master
    log "Repository updated"
  else
    cd /home/ssm-user
    git clone "$REPO_URL" shadowcheck
    cd "$PROJECT_ROOT"
    log "Repository cloned"
  fi
}

########################################
# Phase 3: PostgreSQL
########################################
phase_postgres() {
  log "=== Phase 3: PostgreSQL ==="

  if docker ps --format '{{.Names}}' | grep -q shadowcheck_postgres; then
    log "PostgreSQL already running"
    return 0
  fi

  # This script needs root for volume mount
  if [ ! -f "$PROJECT_ROOT/deploy/aws/scripts/deploy-postgres.sh" ]; then
    fail "deploy-postgres.sh not found"
  fi

  sudo bash "$PROJECT_ROOT/deploy/aws/scripts/deploy-postgres.sh"
  log "PostgreSQL deployed"
}

########################################
# Phase 4: Secrets from AWS SM
########################################
phase_secrets() {
  log "=== Phase 4: Secrets (from AWS SM) ==="

  # Pull secret blob from AWS SM to extract db_password for PostgreSQL container
  local secret_json
  secret_json=$(aws secretsmanager get-secret-value \
    --secret-id "$AWS_SECRET_NAME" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text 2>/dev/null) || {
    log "WARNING: Could not read AWS SM ($AWS_SECRET_NAME). Continuing with local secrets only."
    return 0
  }

  log "Loaded secrets from AWS SM"

  # Extract db_password to file (for docker-compose postgres secret)
  log "Secrets ready (app reads directly from AWS SM at startup)"
}

########################################
# Phase 5: Build & Deploy App
########################################
phase_deploy() {
  log "=== Phase 5: Build & Deploy ==="

  cd "$PROJECT_ROOT"

  # Build images
  log "Building backend image..."
  docker build -q -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .

  log "Building frontend image..."
  docker build -q -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

  # Stop old containers
  docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
  docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

  # Build env file
  local env_file
  env_file=$(mktemp)

  local db_password
  db_password=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD 2>/dev/null || cat "$SECRETS_DIR/db_password.txt" 2>/dev/null || echo "")
  local public_ip
  public_ip=$(curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

  # Robust Podman/Docker socket detection
  local podman_sock=""
  if [ -n "${DOCKER_HOST:-}" ] && [[ "$DOCKER_HOST" == unix://* ]]; then
    podman_sock="${DOCKER_HOST#unix://}"
  fi
  if [ ! -S "$podman_sock" ]; then
    podman_sock=$(podman info --format '{{.Host.RemoteSocket.Path}}' 2>/dev/null || echo "")
  fi
  if [ ! -S "$podman_sock" ]; then
    # Fallback to common paths
    for path in "/run/user/$(id -u)/podman/podman.sock" "/run/podman/podman.sock" "/var/run/docker.sock"; do
      if [ -S "$path" ]; then
        podman_sock="$path"
        break
      fi
    done
  fi

  local docker_opts=""
  if [ -S "$podman_sock" ]; then
    log "Detected socket at $podman_sock"
    docker_opts="-v $podman_sock:/var/run/docker.sock --group-add $(stat -c '%g' "$podman_sock") -e DOCKER_HOST=unix:///var/run/docker.sock"
  else
    log "WARNING: No Docker/Podman socket detected. PgAdmin controls will be disabled."
  fi

  cat > "$env_file" <<ENVEOF
NODE_ENV=production
PORT=3001
ADMIN_ALLOW_DOCKER=true
PGADMIN_COMPOSE_FILE=/app/docker/infrastructure/docker-compose.postgres.yml
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
CORS_ORIGINS=http://${public_ip},https://${public_ip},http://localhost,https://localhost
SHADOWCHECK_AWS_SECRET=$AWS_SECRET_NAME
AWS_DEFAULT_REGION=$AWS_REGION
ENVEOF

  # Start backend
  docker run -d --name shadowcheck_backend \
    --network host \
    --env-file "$env_file" \
    -e DB_PASSWORD="$db_password" \
    -e DB_ADMIN_PASSWORD="$db_password" \
    $docker_opts \
    --restart unless-stopped \
    shadowcheck/backend:latest

  # Start frontend
  docker run -d --name shadowcheck_frontend \
    --network host \
    --restart unless-stopped \
    shadowcheck/frontend:latest

  rm -f "$env_file"

  sleep 5
  log "Containers started"
}

########################################
# Phase 6: Verify
########################################
phase_verify() {
  log "=== Phase 6: Verify ==="

  local ok=true

  if docker ps --format '{{.Names}}' | grep -q shadowcheck_postgres; then
    log "OK: PostgreSQL running"
  else
    log "FAIL: PostgreSQL not running"
    ok=false
  fi

  if docker ps --format '{{.Names}}' | grep -q shadowcheck_backend; then
    log "OK: Backend running"
  else
    log "FAIL: Backend not running"
    ok=false
  fi

  if docker ps --format '{{.Names}}' | grep -q shadowcheck_frontend; then
    log "OK: Frontend running"
  else
    log "FAIL: Frontend not running"
    ok=false
  fi

  # Health check
  sleep 2
  local health
  health=$(curl -s --connect-timeout 5 http://localhost:3001/api/health 2>/dev/null || echo "")
  if echo "$health" | grep -q '"status"'; then
    log "OK: Backend health check passed"
  else
    log "WARN: Backend health check failed (may still be starting)"
    log "  Check: docker logs shadowcheck_backend"
  fi

  echo ""
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAME|shadowcheck"
  echo ""

  local public_ip
  public_ip=$(curl -s --connect-timeout 3 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
  log "Frontend: http://$public_ip"
  log "Backend:  http://$public_ip:3001"

  if [ "$ok" = true ]; then
    log "=== Provisioning complete ==="
  else
    log "=== Provisioning completed with warnings ==="
  fi
}

########################################
# Main
########################################
main() {
  log "=== ShadowCheck Instance Provisioning ==="
  log "Instance: $(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo 'unknown')"

  phase_system
  phase_repo
  phase_postgres
  phase_secrets
  phase_deploy
  phase_verify
}

main "$@"
