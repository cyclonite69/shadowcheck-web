# ShadowCheck AWS Deployment Flow

## Visual Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL MACHINE                                │
│                                                                   │
│  1. Launch EC2 Instance                                          │
│     ./deploy/aws/scripts/launch-shadowcheck-spot.sh              │
│                                                                   │
│     Creates:                                                      │
│     • t4g.large ARM spot instance                                │
│     • 100GB XFS data volume                                      │
│     • Security groups + IAM role                                 │
│     • SSM access configured                                      │
│                                                                   │
│  2. Connect via SSM                                              │
│     aws ssm start-session --target i-XXXXX --region us-east-1    │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EC2 INSTANCE                                 │
│                                                                   │
│  3. System Setup (setup-instance.sh)                             │
│     curl -fsSL https://raw.../setup-instance.sh | sudo bash      │
│                                                                   │
│     Installs:                                                     │
│     ✓ System utilities (htop, jq, ripgrep, ncdu, tmux)          │
│     ✓ Docker + Docker Compose                                    │
│     ✓ Node.js 20+                                                │
│     ✓ PostgreSQL client tools (pgcli)                            │
│     ✓ Shell aliases (sc, sclogs, scdb, etc.)                     │
│                                                                   │
│     Configures:                                                   │
│     ✓ System tuning for PostgreSQL                               │
│     ✓ Directory structure                                         │
│     ✓ SPAL repository (then disables it)                         │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Clone Repository                                             │
│     cd /home/ssm-user                                            │
│     git clone https://github.com/.../shadowcheck-static.git      │
│     cd shadowcheck                                               │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Complete Deployment (deploy-complete.sh)                     │
│     ./deploy/aws/scripts/deploy-complete.sh                      │
│                                                                   │
│     Orchestrates:                                                 │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ 5a. Verify System Setup                                 │ │
│     │     • Check utilities installed                         │ │
│     │     • Verify Docker running                             │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ 5b. Deploy PostgreSQL (deploy-postgres.sh)             │ │
│     │     • Format XFS volume                                 │ │
│     │     • Create SSL certificates                           │ │
│     │     • Configure PostgreSQL (optimized)                  │ │
│     │     • Generate database password                        │ │
│     │     • Start PostGIS container                           │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ 5c. Configure Environment                               │ │
│     │     • Copy .env.example → .env.aws                      │ │
│     │     • Auto-populate DB_PASSWORD                         │ │
│     │     • Auto-populate PUBLIC_IP                           │ │
│     │     • Prompt for MAPBOX_TOKEN                           │ │
│     │     • Prompt for SESSION_SECRET                         │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ 5d. Deploy Application (scs_rebuild.sh)         │ │
│     │     • Pull latest code                                  │ │
│     │     • Build TypeScript (server + client)                │ │
│     │     • Build Docker containers                           │ │
│     │     • Start services                                    │ │
│     │       - shadowcheck_postgres                            │ │
│     │       - shadowcheck_backend                             │ │
│     │       - shadowcheck_frontend                            │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ 5e. Initialize Admin User (optional)                    │ │
│     │     • Run init-admin-user.sh script                     │ │
│     │     • Generates random password                         │ │
│     │     • Creates admin user with force_password_change     │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Verification                                                 │
│     • Check containers: docker ps                                │
│     • Check logs: docker logs shadowcheck_backend                │
│     • Check database: pgcli postgresql://...                     │
│     • Check disk: df -h /var/lib/postgresql                      │
│     • Access frontend: http://PUBLIC_IP:3000                     │
│     • Access backend: http://PUBLIC_IP:3001                      │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ✅ DEPLOYMENT COMPLETE                                          │
│                                                                   │
│  Running Services:                                               │
│  • PostgreSQL 18 + PostGIS 3.6 (port 5432, localhost only)      │
│  • Backend API (port 3001, IP-restricted)                        │
│  • Frontend (port 3000, public)                                  │
│                                                                   │
│  Credentials:                                                     │
│  • DB password: /home/ssm-user/secrets/db_password.txt           │
│  • Admin user: admin (password generated by init script)         │
│  • Run ./deploy/aws/scripts/init-admin-user.sh to create         │
│  • Password is force_change required on first login              │
│                                                                   │
│  Helpful Aliases:                                                │
│  • sc        - cd to project                                     │
│  • sclogs    - tail backend logs                                 │
│  • scps      - show containers                                   │
│  • scdb      - connect to database                               │
│  • scdeploy  - deploy updates                                    │
│  • scstatus  - show system status                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Update Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL MACHINE                                │
│                                                                   │
│  1. Make Changes                                                 │
│     vim server/src/api/routes/v1/auth.ts                         │
│                                                                   │
│  2. Test Locally (optional)                                      │
│     npm run dev                                                  │
│                                                                   │
│  3. Commit and Push                                              │
│     git add .                                                    │
│     git commit -m "Fix auth issue"                               │
│     git push origin master                                       │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EC2 INSTANCE                                 │
│                                                                   │
│  4. Connect via SSM                                              │
│     aws ssm start-session --target i-XXXXX --region us-east-1    │
│                                                                   │
│  5. Deploy Update                                                │
│     cd /home/ssm-user/shadowcheck                                │
│     ./deploy/aws/scripts/scs_rebuild.sh                   │
│                                                                   │
│     Or use alias:                                                │
│     scdeploy                                                     │
│                                                                   │
│     This will:                                                    │
│     • Pull latest code from GitHub                               │
│     • Rebuild containers                                         │
│     • Restart services                                           │
│     • Apply new configuration                                    │
│                                                                   │
│  6. Verify                                                       │
│     scps      # Check containers                                 │
│     sclogs    # Check logs                                       │
│     scstatus  # Check system                                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Time Comparison

### Before Automation

```
┌──────────────────────────────────────────────────────────────┐
│ Step                                    Time                  │
├──────────────────────────────────────────────────────────────┤
│ Launch instance                         2 min                │
│ Connect via SSM                         1 min                │
│ Install Docker manually                 5 min                │
│ Install Node.js manually                3 min                │
│ Install utilities manually              5 min                │
│ Clone repository                        1 min                │
│ Deploy PostgreSQL                       3 min                │
│ Create .env.aws manually                5 min                │
│ Deploy application                      3 min                │
│ Initialize admin user                   2 min                │
├──────────────────────────────────────────────────────────────┤
│ TOTAL                                   30 min               │
└──────────────────────────────────────────────────────────────┘
```

### After Automation

```
┌──────────────────────────────────────────────────────────────┐
│ Step                                    Time                  │
├──────────────────────────────────────────────────────────────┤
│ Launch instance                         2 min                │
│ Connect via SSM                         1 min                │
│ Run setup-instance.sh                   2 min                │
│ Clone repository                        1 min                │
│ Run deploy-complete.sh                  3 min                │
├──────────────────────────────────────────────────────────────┤
│ TOTAL                                   9 min                │
│                                                               │
│ (5 min active, 4 min waiting)                                │
└──────────────────────────────────────────────────────────────┘
```

**Time Saved: 21 minutes (70% reduction)**

## File Structure

```
deploy/aws/
├── scripts/
│   ├── setup-instance.sh          ← NEW: System setup
│   ├── deploy-complete.sh         ← NEW: Orchestrator
│   ├── deploy-postgres.sh         ← Existing
│   ├── scs_rebuild.sh      ← Existing
│   └── launch-shadowcheck-spot.sh ← Existing
│
├── QUICKSTART.md                  ← NEW: 5-min guide
├── DEPLOYMENT_CHECKLIST.md        ← NEW: Verification
├── IMPLEMENTATION_SUMMARY.md      ← NEW: What changed
├── WORKFLOW.md                    ← Updated
└── README.md                      ← Updated
```

## Key Features

### Idempotency

All scripts check if work is already done:

- ✓ Won't reinstall packages
- ✓ Won't redeploy if running
- ✓ Won't overwrite configs

### Auto-Population

Automatically fills in:

- ✓ Database password
- ✓ Public IP address
- ✓ System paths

### Error Handling

- ✓ Exit on errors (`set -e`)
- ✓ Verification after each step
- ✓ Clear error messages

### Security

- ✓ SPAL repo disabled after use
- ✓ Secrets in gitignored files
- ✓ SSL/TLS enforced
- ✓ Minimal privileges

## Documentation Hierarchy

```
1. QUICKSTART.md              ← Start here (new users)
   ↓
2. DEPLOYMENT_CHECKLIST.md    ← Verify each step
   ↓
3. WORKFLOW.md                ← Daily development
   ↓
4. README.md                  ← Reference & navigation
   ↓
5. docs/                      ← Deep dives
   ├── AWS_INFRASTRUCTURE.md
   ├── POSTGRESQL_TUNING.md
   └── SECURITY_ARCHITECTURE.md
```
