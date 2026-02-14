#!/bin/bash
# Complete EC2 instance setup for ShadowCheck
# Run this script after instance launch to configure everything

set -e

echo "🚀 ShadowCheck Instance Setup"
echo "=============================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run with sudo"
   exit 1
fi

# 1. System Update
echo "📦 Updating system packages..."
dnf upgrade -y --releasever=2023.10.20260202
echo "✅ System updated"
echo ""

# 2. Install SPAL repository for additional packages
echo "📦 Installing SPAL repository..."
if ! dnf list installed spal-release &>/dev/null; then
  dnf install -y spal-release
  dnf config-manager --set-enabled amazonlinux-spal
  dnf clean all
  dnf makecache
  echo "✅ SPAL repository enabled"
else
  echo "✅ SPAL already installed"
fi
echo ""

# 3. Install system utilities
echo "🛠️  Installing system utilities..."
dnf install -y \
  htop lsof strace tcpdump \
  bind-utils iproute traceroute nmap-ncat \
  jq tree \
  sysstat psmisc util-linux \
  chrony tmux \
  git

# Install SPAL packages (ripgrep, ncdu)
dnf install -y ripgrep ncdu

echo "✅ System utilities installed"
echo ""

# 4. Disable SPAL repo (best practice - only enable when needed)
echo "🔒 Disabling SPAL repository..."
dnf config-manager --set-disabled amazonlinux-spal
echo "✅ SPAL disabled (re-enable with: dnf config-manager --set-enabled amazonlinux-spal)"
echo ""

# 5. Install Docker if not present
echo "🐳 Checking Docker installation..."
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  dnf install -y docker
  systemctl enable docker
  systemctl start docker
  usermod -aG docker ssm-user
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi
echo ""

# 6. Install Docker Compose if not present
echo "🐳 Checking Docker Compose installation..."
if ! command -v docker-compose &>/dev/null; then
  echo "Installing Docker Compose..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "✅ Docker Compose installed"
else
  echo "✅ Docker Compose already installed"
fi
echo ""

# 7. Install Node.js 20 if not present
echo "📦 Checking Node.js installation..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
  echo "Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
  echo "✅ Node.js installed"
else
  echo "✅ Node.js 20+ already installed"
fi
echo ""

# 8. Configure PostgreSQL-optimized settings
echo "⚙️  Configuring system for PostgreSQL..."

# Increase shared memory
if ! grep -q "kernel.shmmax" /etc/sysctl.conf; then
  cat >> /etc/sysctl.conf << 'SYSCTL'

# PostgreSQL optimizations
kernel.shmmax = 2147483648
kernel.shmall = 524288
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
SYSCTL
  sysctl -p
  echo "✅ System tuning applied"
else
  echo "✅ System already tuned"
fi
echo ""

# 9. Create directory structure
echo "📁 Creating directory structure..."
mkdir -p /home/ssm-user/shadowcheck
mkdir -p /home/ssm-user/secrets
mkdir -p /home/ssm-user/backups
chown -R ssm-user:ssm-user /home/ssm-user/shadowcheck
chown -R ssm-user:ssm-user /home/ssm-user/secrets
chown -R ssm-user:ssm-user /home/ssm-user/backups
chmod 700 /home/ssm-user/secrets
echo "✅ Directories created"
echo ""

# 10. Install pgcli for easier database management
echo "🗄️  Installing pgcli..."
if ! command -v pgcli &>/dev/null; then
  pip3 install --user pgcli
  echo "✅ pgcli installed"
else
  echo "✅ pgcli already installed"
fi
echo ""

# 11. Symlink scs_rebuild into PATH (works in non-interactive SSM sessions too)
echo "🔗 Installing scs_rebuild to PATH..."
ln -sf /home/ssm-user/shadowcheck/deploy/aws/scripts/scs_rebuild.sh /usr/local/bin/scs_rebuild
echo "✅ scs_rebuild available system-wide"
echo ""

# 12. Create helpful aliases
echo "⚡ Creating helpful aliases..."
if ! grep -q "shadowcheck aliases" /home/ssm-user/.bashrc; then
  cat >> /home/ssm-user/.bashrc << 'ALIASES'

# ShadowCheck aliases
alias sc='cd /home/ssm-user/shadowcheck'
alias sclogs='docker logs -f shadowcheck_backend'
alias scps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias scdb='pgcli postgresql://shadowcheck_user@localhost:5432/shadowcheck_db'
alias scdeploy='scs_rebuild'
alias scstatus='docker ps && echo "" && df -h /var/lib/postgresql'
ALIASES
  chown ssm-user:ssm-user /home/ssm-user/.bashrc
  echo "✅ Aliases added to .bashrc"
else
  echo "✅ Aliases already configured"
fi
echo ""

# 13. Display system information
echo "📊 System Information:"
echo "===================="
echo "OS: $(cat /etc/system-release)"
echo "Kernel: $(uname -r)"
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker-compose --version)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# 13. Display installed utilities
echo "🛠️  Installed Utilities:"
echo "====================="
echo "htop: $(htop --version 2>&1 | head -1)"
echo "jq: $(jq --version)"
echo "ripgrep: $(rg --version | head -1)"
echo "ncdu: $(ncdu --version)"
echo "tmux: $(tmux -V)"
echo ""

echo "✅ Instance setup complete!"
echo ""
echo "📝 Next Steps:"
echo "============="
echo "1. Clone repository:"
echo "   cd /home/ssm-user"
echo "   git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck"
echo ""
echo "2. Deploy PostgreSQL:"
echo "   sudo /home/ssm-user/shadowcheck/deploy/aws/scripts/deploy-postgres.sh"
echo ""
echo "3. Configure environment:"
echo "   cd /home/ssm-user/shadowcheck"
echo "   cp deploy/aws/.env.example deploy/aws/.env.aws"
echo "   vim deploy/aws/.env.aws"
echo ""
echo "4. Deploy application:"
echo "   ./deploy/aws/scripts/scs_rebuild.sh"
echo ""
echo "5. Initialize admin user:"
echo "   ./deploy/aws/scripts/init-admin-user.sh"
echo ""
echo "💡 Helpful aliases (reload shell first: bash):"
echo "   sc        - cd to shadowcheck directory"
echo "   sclogs    - tail backend logs"
echo "   scps      - show running containers"
echo "   scdb      - connect to database with pgcli"
echo "   scdeploy  - deploy latest from GitHub"
echo "   scstatus  - show container and disk status"
